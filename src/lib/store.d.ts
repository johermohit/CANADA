import { FilterState, Dataset } from './types';
export interface DiscoveryState {
    datasets: Dataset[];
    loading: boolean;
    total: number;
    error: string | null;
    filters: FilterState;
    selectedDatasetId: string | null;
    expandedResourceId: string | null;
    showFilters: boolean;
    setDatasets: (datasets: Dataset[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setFilters: (filters: FilterState) => void;
    addFilter: (key: keyof FilterState, value: any) => void;
    removeFilter: (key: keyof FilterState, value?: any) => void;
    selectDataset: (id: string | null) => void;
    expandResource: (id: string | null) => void;
    toggleFilters: () => void;
    reset: () => void;
}
export declare const useDiscoveryStore: import("zustand").UseBoundStore<import("zustand").StoreApi<DiscoveryState>>;
//# sourceMappingURL=store.d.ts.map