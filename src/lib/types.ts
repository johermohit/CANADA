// Shared types across frontend and API

export interface Dataset {
  id: string;
  title: string;
  description: string;
  organization: string;
  metadata_modified: string;
  resource_count: number;
  formats: string[];
  rank_score?: number;
}

export interface Resource {
  id: string;
  name: string;
  format: string;
  url: string;
  created: string;
  last_modified: string;
  package_id: string;
}

export interface ResourcePreview {
  resource: Resource;
  rows: any[];
  columns: string[];
  row_count: number;
  size_bytes?: number;
}

export interface SearchQuery {
  intent: string;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  total: number;
  datasets: Dataset[];
  facets: {
    organizations: Array<{ label: string; count: number }>;
    formats: Array<{ label: string; count: number }>;
    recency: Array<{ label: string; count: number }>;
  };
}

export interface OrchestrateRequest {
  prompt: string;
  filters?: FilterState;
}

export interface OrchestrateResponse {
  query: FilterState;
  results: SearchResponse;
  execution_time_ms: number;
}

export interface FilterState {
  keywords?: string[];
  organizations?: string[];
  formats?: string[];
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
