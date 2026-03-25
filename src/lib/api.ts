import { OrchestrateRequest, OrchestrateResponse, SearchQuery, SearchResponse, PreviewRequest, PreviewResponse, ApiError } from './types';

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    const normalized = configured.replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      const isProductionLikeHost = !isLocalhostHost(window.location.hostname);
      const isLocalConfiguredHost = /localhost|127\.0\.0\.1|::1/.test(normalized);

      if (isProductionLikeHost && isLocalConfiguredHost) {
        console.warn(
          `Ignoring VITE_API_BASE_URL=${configured} on ${window.location.hostname}; using same-origin /api routes instead.`
        );
        return '';
      }
    }

    return normalized;
  }

  return import.meta.env.DEV ? 'http://localhost:3000' : '';
}

const apiBase = resolveApiBaseUrl();

function formatApiError(endpoint: string, status: number, payload?: Partial<ApiError> & { error?: string }) {
  const code = payload?.code || `HTTP_${status}`;
  const message = payload?.message || payload?.error || `Request failed with status ${status}`;
  const requestId = payload?.request_id ? ` (request ${payload.request_id})` : '';
  return `${endpoint} failed: ${message} [${code}]${requestId}`;
}

async function readErrorPayload(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return { message: text || response.statusText };
  }

  try {
    return await response.json();
  } catch {
    return { message: response.statusText };
  }
}

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

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (error: any) {
      const hint = import.meta.env.DEV
        ? 'If you are in local dev, run `vercel dev` or point VITE_API_BASE_URL at the API server.'
        : 'Check your deployed Vercel API routes and env vars.';
      throw new Error(`Network error calling ${endpoint} at ${url}. ${hint}`);
    }

    if (!response.ok) {
      const error = (await readErrorPayload(response)) as Partial<ApiError> & { error?: string };
      throw new Error(formatApiError(endpoint, response.status, error));
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return (await response.text()) as T;
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

  async moreLike(datasetId: string, limit = 12, offset = 0): Promise<SearchResponse> {
    return this.request('/api/more_like', {
      method: 'POST',
      body: JSON.stringify({ id: datasetId, limit, offset }),
    });
  }

  async getDataset(datasetId: string) {
    return this.request(`/api/datasets/${datasetId}`);
  }
}

export const apiClient = new ApiClient(apiBase);
