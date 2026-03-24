import { OrchestrateRequest, OrchestrateResponse, SearchQuery, SearchResponse, PreviewRequest, PreviewResponse, ApiError } from './types';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(`API Error: ${error.message} (${error.code})`);
    }

    return response.json();
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    return this.request('/api/search', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  async orchestrate(request: OrchestrateRequest): Promise<OrchestrateResponse> {
    return this.request('/api/orchestrate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async preview(resourceId: string, limit = 50): Promise<PreviewResponse> {
    return this.request('/api/preview', {
      method: 'POST',
      body: JSON.stringify({ resource_id: resourceId, limit } as PreviewRequest),
    });
  }

  async getDataset(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}`);
  }
}

export const apiClient = new ApiClient(apiBase);
