import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './utils';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    const url = validateEnv('VITE_SUPABASE_URL');
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

  let query = client.from('datasets').select('*', { count: 'exact' });

  // Add keyword filters
  if (keywords.length > 0) {
    const keywordFilter = keywords.map((k) => `title.ilike.%${k}%`).join(',');
    query = query.or(keywordFilter);
  }

  // Add organization filters
  if (organizations.length > 0) {
    query = query.in('organization', organizations);
  }

  // Add recency filter
  if (filters.recency_days) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - filters.recency_days);
    query = query.gte('metadata_modified', sinceDate.toISOString());
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Fetch resources for format aggregation
  if (data && data.length > 0) {
    const datasetIds = data.map((d: any) => d.id);
    const { data: resources, error: resourceError } = await client
      .from('resources')
      .select('package_id, format')
      .in('package_id', datasetIds);

    if (!resourceError && resources) {
      // Aggregate formats by dataset
      const formatsByDataset: { [key: string]: Set<string> } = {};
      resources.forEach((r: any) => {
        if (!formatsByDataset[r.package_id]) {
          formatsByDataset[r.package_id] = new Set();
        }
        if (r.format) {
          formatsByDataset[r.package_id].add(r.format.toUpperCase());
        }
      });

      // Enrich datasets with formats
      data.forEach((d: any) => {
        d.formats = Array.from(formatsByDataset[d.id] || []);
      });
    }
  }

  return {
    total: count || 0,
    datasets: data || [],
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
    ...dataset,
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
