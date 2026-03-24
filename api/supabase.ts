import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './utils.js';

type DatastoreFieldRow = {
  _link?: string;
  _link_resources?: string;
  id?: string;
};

type ResourceViewRow = {
  _link?: string;
  _link_resources?: string;
  view_type?: string;
};

type ResourceRow = {
  _link?: string;
  _link_main?: string;
  id?: string;
  name?: string;
  format?: string;
  url?: string;
  size?: string;
  datastore_fields?: DatastoreFieldRow[];
  resource_views?: ResourceViewRow[];
};

type DatasetRow = {
  _link?: string;
  id?: string;
  title_translated_en?: string;
  notes_translated_en?: string;
  url?: string;
  resources?: ResourceRow[];
};

function normalizeDatasetRow(row: DatasetRow) {
  const resources = Array.isArray(row.resources) ? row.resources : [];

  const formats = Array.from(
    new Set(
      resources
        .map((resource) => (resource.format || '').trim().toUpperCase())
        .filter((format) => Boolean(format))
    )
  );

  return {
    id: row._link || row.id || 'unknown-dataset',
    title: row.title_translated_en || 'Untitled dataset',
    description: row.notes_translated_en || '',
    organization: '',
    metadata_modified: new Date().toISOString(),
    resource_count: resources.length,
    formats,
    resources: resources.map((resource) => ({
      id: resource._link || resource.id || '',
      name: resource.name || '',
      format: (resource.format || '').toUpperCase(),
      url: resource.url || '',
      size: resource.size || '',
      datastore_fields: Array.isArray(resource.datastore_fields)
        ? resource.datastore_fields.map((field) => field.id).filter(Boolean)
        : [],
      resource_views: Array.isArray(resource.resource_views)
        ? resource.resource_views.map((view) => view.view_type).filter(Boolean)
        : [],
    })),
  };
}

function applyClientKeywordFilter(rows: DatasetRow[], keywords: string[]) {
  if (!keywords.length) {
    return rows;
  }

  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());

  return rows.filter((row) => {
    const haystack = [row.title_translated_en || '', row.notes_translated_en || '']
      .join(' ')
      .toLowerCase();
    return normalizedKeywords.every((keyword) => haystack.includes(keyword));
  });
}

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!url) {
      throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL)');
    }
    const key = validateEnv('SUPABASE_SERVICE_ROLE_KEY');
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

/**
 * Search datasets in Supabase with filters
 */
export async function searchDatasets(filters: {
  keywords?: string[];
  organizations?: string[];
  formats?: string[];
  recency_days?: number;
  limit?: number;
  offset?: number;
}) {
  const client = getSupabaseClient();
  const { keywords = [], formats = [], limit = 20, offset = 0 } = filters;

  let query = client
    .from('datasets')
    .select(
      `
        _link,
        id,
        title_translated_en,
        notes_translated_en,
        url,
        resources (
          _link,
          _link_main,
          id,
          name,
          format,
          url,
          size,
          datastore_fields (
            _link,
            _link_resources,
            id
          ),
          resource_views (
            _link,
            _link_resources,
            view_type
          )
        )
      `,
      { count: 'exact' }
    )
    .range(offset, offset + limit - 1);

  if (keywords.length > 0) {
    const keywordOr = keywords
      .map((keyword) => [
        `title_translated_en.ilike.%${keyword}%`,
        `notes_translated_en.ilike.%${keyword}%`,
      ])
      .flat()
      .join(',');
    query = query.or(keywordOr);
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  let rows = Array.isArray(data) ? (data as DatasetRow[]) : [];

  if (keywords.length > 0) {
    rows = applyClientKeywordFilter(rows, keywords);
  }

  if (formats.length > 0) {
    const requestedFormats = new Set(formats.map((format) => format.toUpperCase()));
    rows = rows.filter((row) => {
      const resources = Array.isArray(row.resources) ? row.resources : [];
      return resources.some((resource) => requestedFormats.has((resource.format || '').toUpperCase()));
    });
  }

  const datasets = rows.map(normalizeDatasetRow);

  return {
    total: keywords.length > 0 || formats.length > 0 ? datasets.length : count || datasets.length,
    datasets,
  };
}

/**
 * Get a single dataset with its resources
 */
export async function getDataset(datasetId: string) {
  const client = getSupabaseClient();

  const { data: dataset, error } = await client
    .from('datasets')
    .select(
      `
        _link,
        id,
        title_translated_en,
        notes_translated_en,
        url,
        resources (
          _link,
          _link_main,
          id,
          name,
          format,
          url,
          size,
          datastore_fields (
            _link,
            _link_resources,
            id
          ),
          resource_views (
            _link,
            _link_resources,
            view_type
          )
        )
      `
    )
    .or(`_link.eq.${datasetId},id.eq.${datasetId}`)
    .single();

  if (error || !dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  return {
    ...normalizeDatasetRow(dataset as DatasetRow),
  };
}

/**
 * Get organizations/publishers for faceted filtering
 */
export async function getOrganizations() {
  // Current schema has no organization column in datasets.
  // Keep API contract stable by returning an empty facet.
  return [];
}

/**
 * Get available formats for filtering
 */
export async function getAvailableFormats() {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('resources')
    .select('format')
    .not('format', 'is', null);

  if (error) {
    return [];
  }

  const formats = new Map<string, number>();
  data?.forEach((row: any) => {
    const fmt = row.format?.toUpperCase();
    if (fmt) {
      formats.set(fmt, (formats.get(fmt) || 0) + 1);
    }
  });

  return Array.from(formats.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
