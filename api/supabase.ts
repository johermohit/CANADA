import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './utils.js';

type DatasetRow = {
  _link?: string;
  id?: string;
  title_translated_en?: string;
  notes_translated_en?: string;
  url?: string;
  organization_title?: string;
  organization_name?: string;
  collection?: string;
  language?: string;
  jurisdiction?: string;
  subject?: string;
  frequency?: string;
  keywords_en?: string;
  date_modified?: string;
  metadata_modified?: string;
  metadata_created?: string;
  modified?: string;
  created?: string;
  resources?: ResourceRow[];
};

type ResourceRow = {
  _link?: string;
  _link_main?: string;
  id?: string;
  resource_id?: string;
  name?: string;
  format?: string;
  url?: string;
  size?: string;
  datastore_active?: string;
  resource_type?: string;
  language?: string;
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

function clip(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}...`;
}

function normalizeFrequency(raw?: string) {
  if (!raw) return 'Other';
  const v = String(raw).toLowerCase().trim();
  if (v.includes('daily') || v === 'day') return 'Daily';
  if (v.includes('weekly') || v === 'week') return 'Weekly';
  if (v.includes('monthly') || v === 'month') return 'Monthly';
  if (v.includes('quarter') || v.includes('quarterly')) return 'Quarterly';
  if (v.includes('year') || v.includes('annual') || v.includes('yearly')) return 'Yearly';
  if (v.includes('as need') || v.includes('as-needed') || v.includes('asneeded')) return 'As Needed';
  if (v.includes('irregular') || v.includes('unknown') || v === '') return 'Other';
  return String(raw).trim();
}

function normalizeDatasetSummary(row: DatasetRow, resources: Array<{ format?: string }>) {
  const resourceCount = resources.length;
  const formats = Array.from(
    new Set(resources.map((resource) => text(resource.format).toUpperCase()).filter(Boolean))
  );

  const metadataModified =
    text(row.metadata_modified) ||
    text(row.date_modified) ||
    text(row.modified) ||
    text(row.metadata_created) ||
    text(row.created) ||
    '';

  return {
    id: text(row._link) || text(row.id) || 'unknown-dataset',
    title: clip(text(row.title_translated_en) || 'Untitled dataset', 180),
    description: clip(text(row.notes_translated_en), 600),
    organization: text(row.organization_title) || text(row.organization_name),
    organization_key: text(row.organization_name) || undefined,
    jurisdiction: text(row.jurisdiction) || undefined,
    subject: text(row.subject) || undefined,
    update_frequency: text(row.frequency) ? normalizeFrequency(text(row.frequency)) : undefined,
    collection_type: text(row.collection) || undefined,
    language: text(row.language) || undefined,
    keywords: (text(row.keywords_en) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    metadata_modified: metadataModified || null,
    resource_count: resourceCount,
    formats,
  };
}

function normalizeResource(
  row: ResourceRow,
  fields: DatastoreFieldRow[],
  views: ResourceViewRow[]
) {
  const url = text(row.url);
  const ckanResourceIdMatch = url.match(/\/resource\/([0-9a-fA-F-]{36})\b/);
  const ckanResourceId = text(row.id) || ckanResourceIdMatch?.[1] || '';

  return {
    id: text(row._link) || text(row.id),
    _link_main: text(row._link_main),
    name: text(row.name),
    format: text(row.format).toUpperCase(),
    resource_type: text(row.resource_type) || undefined,
    language: text(row.language) || undefined,
    url,
    size: text(row.size),
    datastore_active: text(row.datastore_active).toLowerCase() === 'true',
    ckan_resource_id: ckanResourceId || undefined,
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
    .select('_link, _link_main, id, resource_id, name, format, url, size, datastore_active, resource_type, language')
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

function buildTitleOrFilter(keywords: string[]) {
  const terms = keywords
    .map((keyword) => text(keyword).trim())
    .filter(Boolean)
    .map((keyword) => keyword.replace(/,/g, ' ').replace(/\*/g, ''))
    .map((keyword) => keyword.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!terms.length) return '';

  return terms.map((keyword) => `title_translated_en.ilike.%${keyword}%`).join(',');
}

async function fetchResourceSummaries(client: ReturnType<typeof createClient>, datasetLinks: string[]) {
  if (!datasetLinks.length) {
    return new Map<string, Array<{ format?: string }>>();
  }

  const { data, error } = await client
    .from('resources')
    .select('_link_main, format')
    .in('_link_main', datasetLinks);

  if (error) {
    throw new Error(`Supabase resources query error: ${error.message}`);
  }

  const byDataset = new Map<string, Array<{ format?: string }>>();
  ((data || []) as Array<{ _link_main?: string; format?: string }>).forEach((row) => {
    const datasetLink = text(row._link_main);
    if (!datasetLink) return;
    const current = byDataset.get(datasetLink) || [];
    current.push({ format: row.format });
    byDataset.set(datasetLink, current);
  });

  return byDataset;
}

/**
 * Search datasets using the real schema:
 * datasets(_link) -> resources(_link_main) -> datastore_fields/resource_views(_link_resources)
 */
export async function searchDatasets(filters: {
  keywords?: string[];
  organizations?: string[];
  jurisdictions?: string[];
  subjects?: string[];
  subject_query?: string;
  formats?: string[];
  frequencies?: string[];
  collection_types?: string[];
  resource_types?: string[];
  languages?: string[];
  recency_days?: number;
  limit?: number;
  offset?: number;
}) {
  const client = getSupabaseClient();
  const {
    keywords = [],
    organizations = [],
    jurisdictions = [],
    subjects = [],
    subject_query,
    formats = [],
    frequencies = [],
    collection_types = [],
    resource_types = [],
    languages = [],
    recency_days,
    limit = 20,
    offset = 0,
  } = filters as any;

  let query = client
    .from('datasets')
    .select('_link, id, title_translated_en, notes_translated_en, url, organization_title, organization_name, metadata_modified, date_modified, jurisdiction, subject, frequency, collection, keywords_en', { count: 'exact' })
    .range(offset, offset + limit - 1);

  // Match ANY search token (OR semantics) in title_translated_en.
  const titleOrFilter = buildTitleOrFilter(keywords);
  if (titleOrFilter) {
    query = query.or(titleOrFilter);
  }

  if (organizations.length > 0) {
    query = query.in('organization_name', organizations);
  }

  if (jurisdictions.length > 0) {
    query = query.in('jurisdiction', jurisdictions);
  }

  if (subject_query && subject_query.trim()) {
    query = query.ilike('subject', `%${subject_query.trim()}%`);
  } else if (subjects.length > 0) {
    const subjectOr = subjects.map((s: string) => `subject.ilike.%${s}%`).join(',');
    query = query.or(subjectOr);
  }

  if (recency_days && typeof recency_days === 'number') {
    const cutoff = new Date(Date.now() - recency_days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('metadata_modified', cutoff);
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
    const joinedResources = resourcesByDataset.get(datasetLink) || [];

    return {
      ...normalizeDatasetSummary(row, joinedResources),
      resources: joinedResources,
    };
  });

  // Post-filters that rely on resource-level data or messy values
  if (formats.length > 0) {
    const requested = new Set(formats.map((format: string) => format.toUpperCase()));
    normalized = normalized.filter((dataset) =>
      dataset.formats.some((format) => requested.has(format.toUpperCase()))
    );
  }

  if (frequencies.length > 0) {
    const wanted = new Set(frequencies.map((f: string) => f.toLowerCase()));
    normalized = normalized.filter((d) => d.update_frequency && wanted.has(String(d.update_frequency).toLowerCase()));
  }

  if (collection_types.length > 0) {
    const wanted = new Set(collection_types.map((c: string) => c.toLowerCase()));
    normalized = normalized.filter((d) => d.collection_type && wanted.has(String(d.collection_type).toLowerCase()));
  }

  if (resource_types.length > 0) {
    const wanted = new Set(resource_types.map((r: string) => r.toLowerCase()));
    normalized = normalized.filter((d) => (d.resources || []).some((res) => res.resource_type && wanted.has(String(res.resource_type).toLowerCase())));
  }

  if (languages.length > 0) {
    const wanted = new Set(languages.map((l: string) => l.toLowerCase()));
    normalized = normalized.filter((d) => (d.language && wanted.has(String(d.language).toLowerCase())) || (d.resources || []).some((res) => res.language && wanted.has(String(res.language).toLowerCase())));
  }

  if (filters.keywords && filters.keywords.length > 0) {
    const wanted = new Set((filters.keywords as string[]).map((k: string) => k.toLowerCase()));
    normalized = normalized.filter((d) => (d.keywords || []).some((kw) => wanted.has(kw.toLowerCase())) || (d.title || '').toLowerCase().split(/\s+/).some((t) => wanted.has(t)));
  }

  const visible = normalized.length;
  const total = (formats.length > 0 || frequencies.length > 0 || collection_types.length > 0 || resource_types.length > 0 || languages.length > 0 || (filters.keywords && filters.keywords.length > 0)) ? normalized.length : count || normalized.length;

  return {
    total,
    visible,
    offset,
    limit,
    has_more: offset + visible < total,
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
    .select('_link, id, title_translated_en, notes_translated_en, url, organization_title, organization_name, metadata_modified, date_modified, jurisdiction, subject, frequency, collection, keywords_en')
    .or(`_link.eq.${datasetId},id.eq.${datasetId}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  const datasetRow = data as DatasetRow;
  const datasetLink = text(datasetRow._link);
  const { resourcesByDataset } = await fetchResourcesWithMetadata(client, datasetLink ? [datasetLink] : []);

  const detailedResources = resourcesByDataset.get(datasetLink) || [];

  return {
    ...normalizeDatasetSummary(datasetRow, detailedResources),
    resources: detailedResources,
  };
}

/**
 * Build organization facets from dataset organization columns.
 */
export async function getOrganizations() {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('datasets')
    .select('organization_title, organization_name');

  if (error) {
    return [];
  }

  // Build counts keyed by organization_name (stable key) and choose the most frequent title as label
  const orgMap = new Map<string, { titleCounts: Map<string, number>; total: number }>();
  (data || []).forEach((row: any) => {
    const name = text(row.organization_name) || text(row.organization_title);
    if (!name) return;
    const title = text(row.organization_title) || name;
    const entry = orgMap.get(name) || { titleCounts: new Map<string, number>(), total: 0 };
    entry.total += 1;
    entry.titleCounts.set(title, (entry.titleCounts.get(title) || 0) + 1);
    orgMap.set(name, entry);
  });

  const out: Array<{ label: string; value: string; count: number }> = [];
  orgMap.forEach((entry, name) => {
    // choose mode title
    let modeTitle = name;
    let best = 0;
    entry.titleCounts.forEach((cnt, t) => {
      if (cnt > best) {
        best = cnt;
        modeTitle = t;
      }
    });
    out.push({ label: modeTitle, value: name, count: entry.total });
  });

  return out.sort((a, b) => b.count - a.count);
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

export async function getJurisdictions() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('datasets').select('jurisdiction').not('jurisdiction', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const v = text(row.jurisdiction).trim();
    if (!v) return;
    map.set(v, (map.get(v) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getSubjects() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('datasets').select('subject').not('subject', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const raw = text(row.subject || '');
    raw.split(/[,;]+/).forEach((part) => {
      const v = part.trim();
      if (!v) return;
      map.set(v, (map.get(v) || 0) + 1);
    });
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getFrequencies() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('datasets').select('frequency').not('frequency', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const normalized = normalizeFrequency(text(row.frequency));
    if (!normalized) return;
    map.set(normalized, (map.get(normalized) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getCollectionTypes() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('datasets').select('collection').not('collection', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const v = text(row.collection).trim();
    if (!v) return;
    map.set(v, (map.get(v) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getResourceTypes() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('resources').select('resource_type').not('resource_type', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const v = text(row.resource_type).trim();
    if (!v) return;
    map.set(v, (map.get(v) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getLanguages() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('resources').select('language').not('language', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  ((data || []) as any[]).forEach((row) => {
    const v = text(row.language).trim();
    if (!v) return;
    map.set(v, (map.get(v) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getKeywordsChips() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('datasets').select('keywords_en').not('keywords_en', 'is', null);
  if (error) return [];
  const map = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const raw = text(row.keywords_en || '');
    raw.split(',').forEach((part) => {
      const v = part.trim();
      if (!v) return;
      map.set(v, (map.get(v) || 0) + 1);
    });
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function moreLikeDatasets(datasetId: string, limit = 12, offset = 0) {
  const client = getSupabaseClient();
  // Get the canonical dataset
  const dataset = await getDataset(datasetId);
  const subjects = (dataset.subject || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const organizations = dataset.organization_key ? [dataset.organization_key] : [];

  // Use the same search pipeline with broad OR semantics
  const results = await searchDatasets({
    keywords: [],
    organizations: organizations.length ? organizations : undefined,
    subjects: subjects.length ? subjects : undefined,
    limit,
    offset,
  } as any);

  return results;
}
