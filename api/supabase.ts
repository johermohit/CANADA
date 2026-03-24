import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './utils.js';

type DatasetRow = {
  _link?: string;
  id?: string;
  title_translated_en?: string;
  notes_translated_en?: string;
  url?: string;
};

type ResourceRow = {
  _link?: string;
  _link_main?: string;
  id?: string;
  name?: string;
  format?: string;
  url?: string;
  size?: string;
};

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

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeDataset(row: DatasetRow, resources: ResourceRow[]) {
  const resourceCount = resources.length;
  const formats = Array.from(
    new Set(resources.map((resource) => text(resource.format).toUpperCase()).filter(Boolean))
  );

  return {
    id: text(row._link) || text(row.id) || 'unknown-dataset',
    title: text(row.title_translated_en) || 'Untitled dataset',
    description: text(row.notes_translated_en),
    organization: '',
    metadata_modified: new Date().toISOString(),
    resource_count: resourceCount,
    formats,
    resources,
  };
}

function normalizeResource(
  row: ResourceRow,
  fields: DatastoreFieldRow[],
  views: ResourceViewRow[]
) {
  return {
    id: text(row._link) || text(row.id),
    _link_main: text(row._link_main),
    name: text(row.name),
    format: text(row.format).toUpperCase(),
    url: text(row.url),
    size: text(row.size),
    datastore_fields: fields.map((field) => text(field.id)).filter(Boolean),
    resource_views: views.map((view) => text(view.view_type)).filter(Boolean),
  };
}

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

async function fetchResourcesWithMetadata(client: ReturnType<typeof createClient>, datasetLinks: string[]) {
  if (!datasetLinks.length) {
    return {
      resourcesByDataset: new Map<string, any[]>(),
    };
  }

  const { data: resources, error: resourceError } = await client
    .from('resources')
    .select('_link, _link_main, id, name, format, url, size')
    .in('_link_main', datasetLinks);

  if (resourceError) {
    throw new Error(`Supabase resources query error: ${resourceError.message}`);
  }

  const resourceRows = (resources || []) as ResourceRow[];
  const resourceLinks = resourceRows.map((row) => text(row._link)).filter(Boolean);

  const [fieldsResult, viewsResult] = await Promise.all([
    resourceLinks.length
      ? client
          .from('datastore_fields')
          .select('_link, _link_resources, id')
          .in('_link_resources', resourceLinks)
      : Promise.resolve({ data: [], error: null } as any),
    resourceLinks.length
      ? client
          .from('resource_views')
          .select('_link, _link_resources, view_type')
          .in('_link_resources', resourceLinks)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (fieldsResult.error) {
    throw new Error(`Supabase datastore_fields query error: ${fieldsResult.error.message}`);
  }

  if (viewsResult.error) {
    throw new Error(`Supabase resource_views query error: ${viewsResult.error.message}`);
  }

  const fieldsByResource = new Map<string, DatastoreFieldRow[]>();
  ((fieldsResult.data || []) as DatastoreFieldRow[]).forEach((row) => {
    const resourceLink = text(row._link_resources);
    if (!resourceLink) return;
    const current = fieldsByResource.get(resourceLink) || [];
    current.push(row);
    fieldsByResource.set(resourceLink, current);
  });

  const viewsByResource = new Map<string, ResourceViewRow[]>();
  ((viewsResult.data || []) as ResourceViewRow[]).forEach((row) => {
    const resourceLink = text(row._link_resources);
    if (!resourceLink) return;
    const current = viewsByResource.get(resourceLink) || [];
    current.push(row);
    viewsByResource.set(resourceLink, current);
  });

  const resourcesByDataset = new Map<string, any[]>();
  resourceRows.forEach((row) => {
    const datasetLink = text(row._link_main);
    if (!datasetLink) return;

    const resourceLink = text(row._link);
    const normalized = normalizeResource(
      row,
      fieldsByResource.get(resourceLink) || [],
      viewsByResource.get(resourceLink) || []
    );

    const current = resourcesByDataset.get(datasetLink) || [];
    current.push(normalized);
    resourcesByDataset.set(datasetLink, current);
  });

  return { resourcesByDataset };
}

/**
 * Search datasets using the real schema:
 * datasets(_link) -> resources(_link_main) -> datastore_fields/resource_views(_link_resources)
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
    .select('_link, id, title_translated_en, notes_translated_en, url', { count: 'exact' })
    .range(offset, offset + limit - 1);

  // As requested: match title_translated_en for the search term.
  if (keywords.length > 0) {
    keywords.forEach((keyword) => {
      query = query.ilike('title_translated_en', `%${keyword}%`);
    });
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  const datasetRows = (data || []) as DatasetRow[];
  const datasetLinks = datasetRows.map((row) => text(row._link)).filter(Boolean);

  const { resourcesByDataset } = await fetchResourcesWithMetadata(client, datasetLinks);

  let normalized = datasetRows.map((row) => {
    const datasetLink = text(row._link);
    const resources = resourcesByDataset.get(datasetLink) || [];
    return normalizeDataset(row, resources);
  });

  if (formats.length > 0) {
    const requested = new Set(formats.map((format) => format.toUpperCase()));
    normalized = normalized.filter((dataset) =>
      dataset.resources.some((resource: any) => requested.has(text(resource.format).toUpperCase()))
    );
  }

  return {
    total: formats.length > 0 ? normalized.length : count || normalized.length,
    datasets: normalized,
  };
}

/**
 * Get one dataset and all related resources/fields/views.
 */
export async function getDataset(datasetId: string) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('datasets')
    .select('_link, id, title_translated_en, notes_translated_en, url')
    .or(`_link.eq.${datasetId},id.eq.${datasetId}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  const datasetRow = data as DatasetRow;
  const datasetLink = text(datasetRow._link);
  const { resourcesByDataset } = await fetchResourcesWithMetadata(client, datasetLink ? [datasetLink] : []);

  return normalizeDataset(datasetRow, resourcesByDataset.get(datasetLink) || []);
}

/**
 * No organization column in the provided schema.
 */
export async function getOrganizations() {
  return [];
}

/**
 * Build format facets from resources table.
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
  (data || []).forEach((row: any) => {
    const value = text(row.format).toUpperCase();
    if (!value) return;
    formats.set(value, (formats.get(value) || 0) + 1);
  });

  return Array.from(formats.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
