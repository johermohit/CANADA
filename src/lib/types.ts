// Shared types across frontend and API

export interface Dataset {
  id: string;
  title: string;
  description: string;
  organization: string;
  // Stable organization key (used for filtering)
  organization_key?: string;
  jurisdiction?: string | null;
  subject?: string | null;
  update_frequency?: string | null;
  collection_type?: string | null;
  language?: string | null;
  // keywords extracted from datasets.keywords_en (comma-separated)
  keywords?: string[];
  metadata_modified: string | null;
  resource_count: number;
  formats: string[];
  resources?: DatasetResource[];
  rank_score?: number;
}

export interface DatasetResource {
  id: string;
  _link_main: string;
  name: string;
  format: string;
  resource_type?: string;
  language?: string;
  url: string;
  size: string;
  ckan_resource_id?: string;
  datastore_active?: boolean;
  datastore_fields: string[];
  resource_views: string[];
}

export interface Resource {
  id: string;
  name: string;
  format: string;
  url: string;
  created?: string;
  last_modified?: string;
  package_id?: string;
}

export interface ResourcePreview {
  resource: Resource;
  rows: any[];
  columns: string[];
  row_count: number;
  size_bytes?: number;
}

export interface SearchQuery {
  intent?: string;
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
}

export interface SearchResponse {
  total: number;
  visible: number;
  offset: number;
  limit: number;
  has_more: boolean;
  datasets: Dataset[];
  facets: {
    organizations: Array<{ label: string; value: string; count: number }>;
    jurisdictions: Array<{ label: string; count: number }>;
    subjects: Array<{ label: string; count: number }>;
    formats: Array<{ label: string; count: number }>;
    frequencies: Array<{ label: string; count: number }>;
    collection_types: Array<{ label: string; count: number }>;
    resource_types: Array<{ label: string; count: number }>;
    languages: Array<{ label: string; count: number }>;
    keywords: Array<{ label: string; count: number }>;
    recency: Array<{ label: string; count: number }>;
  };
}

export interface OrchestrateRequest {
  prompt: string;
  filters?: FilterState;
  limit?: number;
  offset?: number;
}

export interface OrchestrateResponse {
  query: FilterState;
  results: SearchResponse;
  execution_time_ms: number;
}

export interface FilterState {
  keywords?: string[];
  organizations?: string[];
  jurisdictions?: string[];
  subjects?: string[];
  // free-text subject query for ILIKE
  subject_query?: string;
  formats?: string[];
  frequencies?: string[];
  collection_types?: string[];
  resource_types?: string[];
  languages?: string[];
  recency_days?: number;
}

export interface ApiError {
  code: string;
  message: string;
  request_id: string;
  timestamp: string;
}

export interface PreviewRequest {
  resource_id: string;
  limit?: number;
}

export interface PreviewResponse {
  success: boolean;
  preview?: ResourcePreview;
  error?: string;
  fallback_url?: string;
}
