import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './utils.js';

type SupabaseRow = Record<string, any>;

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function getFirstText(row: SupabaseRow, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = asText(row[key]);
    if (value) return value;
  }
  return fallback;
}

function normalizeDataset(row: SupabaseRow) {
  const resourceCount =
    Number(row.resource_count ?? row.num_resources ?? row.resources_count ?? row.resourceCount ?? 0) || 0;

  return {
    ...row,
    id: getFirstText(row, ['id', 'dataset_id', 'name', 'identifier'], `dataset-${resourceCount || 'unknown'}`),
    title: getFirstText(row, ['title', 'name', 'dataset_name', 'identifier'], 'Untitled dataset'),
    description: getFirstText(row, ['description', 'notes', 'summary', 'abstract'], ''),
    organization: getFirstText(row, ['organization', 'owner_org', 'publisher', 'publisher_name'], ''),
    metadata_modified: getFirstText(
      row,
      ['metadata_modified', 'modified', 'updated_at', 'last_modified'],
      new Date().toISOString()
    ),
    resource_count: resourceCount,
    formats: Array.isArray(row.formats) ? row.formats : [],
  };
}

function rowMatchesKeywords(row: SupabaseRow, keywords: string[]) {
  if (!keywords.length) return true;

  const haystack = [
    row.title,
    row.name,
    row.dataset_name,
    row.description,
    row.notes,
    row.summary,
    row.organization,
    row.owner_org,
    row.tags,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => asText(value).toLowerCase())
    .join(' ');

  return keywords.every((keyword) => haystack.includes(keyword.toLowerCase()));
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
  const { keywords = [], organizations = [], formats = [], limit = 20, offset = 0 } = filters;

  const applyBaseFilters = (query: any) => {
    if (organizations.length > 0) {
      query = query.in('organization', organizations);
    }

    if (filters.recency_days) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - filters.recency_days);
      query = query.gte('metadata_modified', sinceDate.toISOString());
    }

    return query;
  };

  const applyKeywordServerFilter = (query: any) => {
    if (keywords.length === 0) {
      return query;
    }

    const keywordFilter = keywords
      .map((keyword) =>
        ['name', 'notes', 'organization', 'owner_org']
          .map((column) => `${column}.ilike.%${keyword}%`)
          .join(',')
      )
      .join(',');

    return query.or(keywordFilter);
  };

  const fetchResourcesForFormats = async (rows: SupabaseRow[]) => {
    if (!rows.length) return rows;

    const datasetIds = rows.map((row) => row.id).filter(Boolean);
    if (!datasetIds.length) return rows;

    const { data: resources, error: resourceError } = await client
      .from('resources')
      .select('package_id, format')
      .in('package_id', datasetIds);

    if (resourceError || !resources) {
      return rows;
    }

    const formatsByDataset: { [key: string]: Set<string> } = {};
    resources.forEach((resource: any) => {
      if (!formatsByDataset[resource.package_id]) {
        formatsByDataset[resource.package_id] = new Set();
      }
      if (resource.format) {
        formatsByDataset[resource.package_id].add(String(resource.format).toUpperCase());
      }
    });

    return rows.map((row) => ({
      ...row,
      formats: Array.from(formatsByDataset[row.id] || []),
    }));
  };

  const runQuery = async (useKeywordServerFilter: boolean) => {
    let query = client.from('datasets').select('*', { count: 'exact' });
    query = applyBaseFilters(query);
    if (useKeywordServerFilter) {
      query = applyKeywordServerFilter(query);
    }
    query = query.range(offset, offset + limit - 1);
    return query;
  };

  let data: SupabaseRow[] | null = null;
  let count: number | null = null;
  let error: any = null;

  try {
    ({ data, count, error } = await runQuery(true));
  } catch (serverFilterError: any) {
    const message = String(serverFilterError?.message || serverFilterError || '');
    if (!message.includes('does not exist')) {
      throw serverFilterError;
    }

    ({ data, count, error } = await runQuery(false));
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    if (keywords.length > 0) {
      const normalized = (data || []).filter((row) => rowMatchesKeywords(row, keywords));
      const withFormats = await fetchResourcesForFormats(normalized);
      return {
        total: normalized.length,
        datasets: withFormats.map(normalizeDataset),
      };
    }

    const withFormats = await fetchResourcesForFormats(data || []);
    return {
      total: count || 0,
      datasets: withFormats.map(normalizeDataset),
    };
  }

  if (error) {
    const message = String(error.message || error);
    if (message.includes('does not exist') && keywords.length > 0) {
      ({ data, count, error } = await runQuery(false));
    }
  }

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  const rows = data || [];
  const withFormats = await fetchResourcesForFormats(rows);
  const normalized = keywords.length > 0 ? withFormats.filter((row) => rowMatchesKeywords(row, keywords)) : withFormats;

  return {
    total: keywords.length > 0 ? normalized.length : count || 0,
    datasets: normalized.map(normalizeDataset),
  };
}

/**
 * Get a single dataset with its resources
 */
export async function getDataset(datasetId: string) {
  const client = getSupabaseClient();

  const { data: dataset, error } = await client
    .from('datasets')
    .select('*')
    .eq('id', datasetId)
    .single();

  if (error || !dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  // Fetch associated resources
  const { data: resources } = await client
    .from('resources')
    .select('*')
    .eq('package_id', datasetId);

  return {
    ...normalizeDataset(dataset as SupabaseRow),
    resources: resources || [],
  };
}

/**
 * Get organizations/publishers for faceted filtering
 */
export async function getOrganizations() {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('datasets')
    .select('organization')
    .not('organization', 'is', null);

  if (error) {
    return [];
  }

  const orgs = new Map<string, number>();
  data?.forEach((row: any) => {
    if (row.organization) {
      orgs.set(row.organization, (orgs.get(row.organization) || 0) + 1);
    }
  });

  return Array.from(orgs.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
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
