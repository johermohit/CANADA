import { OrchestrateRequest, OrchestrateResponse, SearchQuery, SearchResponse, PreviewResponse } from './types';
declare class ApiClient {
    private baseUrl;
    constructor(baseUrl: string);
    private request;
    search(query: SearchQuery): Promise<SearchResponse>;
    orchestrate(request: OrchestrateRequest): Promise<OrchestrateResponse>;
    preview(resourceId: string, limit?: number): Promise<PreviewResponse>;
    getDataset(datasetId: string): Promise<unknown>;
}
export declare const apiClient: ApiClient;
export {};
//# sourceMappingURL=api.d.ts.map