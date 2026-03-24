const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
class ApiClient {
    constructor(baseUrl) {
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.baseUrl = baseUrl;
    }
    async request(endpoint, options = {}) {
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
            const error = await response.json();
            throw new Error(`API Error: ${error.message} (${error.code})`);
        }
        return response.json();
    }
    async search(query) {
        return this.request('/api/search', {
            method: 'POST',
            body: JSON.stringify(query),
        });
    }
    async orchestrate(request) {
        return this.request('/api/orchestrate', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }
    async preview(resourceId, limit = 50) {
        return this.request('/api/preview', {
            method: 'POST',
            body: JSON.stringify({ resource_id: resourceId, limit }),
        });
    }
    async getDataset(datasetId) {
        return this.request(`/api/datasets/${datasetId}`);
    }
}
export const apiClient = new ApiClient(apiBase);
//# sourceMappingURL=api.js.map