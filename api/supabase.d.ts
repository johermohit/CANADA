export declare function getSupabaseClient(): import("@supabase/supabase-js").SupabaseClient<unknown, {
    PostgrestVersion: string;
}, never, never, {
    PostgrestVersion: string;
}>;
/**
 * Search datasets in Supabase with filters
 */
export declare function searchDatasets(filters: {
    keywords?: string[];
    organizations?: string[];
    formats?: string[];
    recency_days?: number;
    limit?: number;
    offset?: number;
}): Promise<{
    total: number;
    datasets: never[];
}>;
/**
 * Get a single dataset with its resources
 */
export declare function getDataset(datasetId: string): Promise<{
    resources: never[];
}>;
/**
 * Get organizations/publishers for faceted filtering
 */
export declare function getOrganizations(): Promise<{
    label: string;
    count: number;
}[]>;
/**
 * Get available formats for filtering
 */
export declare function getAvailableFormats(): Promise<{
    label: string;
    count: number;
}[]>;
//# sourceMappingURL=supabase.d.ts.map