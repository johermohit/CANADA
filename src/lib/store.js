import { create } from 'zustand';
const initialState = {
    datasets: [],
    loading: false,
    total: 0,
    error: null,
    filters: {},
    selectedDatasetId: null,
    expandedResourceId: null,
    showFilters: false,
};
export const useDiscoveryStore = create((set) => ({
    ...initialState,
    setDatasets: (datasets) => set({ datasets }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setFilters: (filters) => set({ filters }),
    addFilter: (key, value) => set((state) => {
        const current = state.filters[key] || [];
        const updated = Array.isArray(current)
            ? [...current, value]
            : [current, value];
        return {
            filters: { ...state.filters, [key]: updated },
        };
    }),
    removeFilter: (key, value) => set((state) => {
        if (!value) {
            const { [key]: _, ...rest } = state.filters;
            return { filters: rest };
        }
        const current = state.filters[key];
        const updated = Array.isArray(current)
            ? current.filter((v) => v !== value)
            : null;
        return {
            filters: updated
                ? { ...state.filters, [key]: updated }
                : { ...state.filters },
        };
    }),
    selectDataset: (id) => set({ selectedDatasetId: id }),
    expandResource: (id) => set({ expandedResourceId: id }),
    toggleFilters: () => set((state) => ({ showFilters: !state.showFilters })),
    reset: () => set(initialState),
}));
//# sourceMappingURL=store.js.map