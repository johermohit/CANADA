import { create } from 'zustand';
import { FilterState, Dataset } from './types';

export interface DiscoveryState {
  // Search results
  datasets: Dataset[];
  loading: boolean;
  total: number;
  error: string | null;

  // UI state
  filters: FilterState;
  selectedDatasetId: string | null;
  expandedResourceId: string | null;
  showFilters: boolean;

  // Actions
  setDatasets: (datasets: Dataset[]) => void;
  setTotal: (total: number) => void;
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

const initialState = {
  datasets: [],
  loading: false,
  total: 0,
  error: null,
  filters: {} as FilterState,
  selectedDatasetId: null,
  expandedResourceId: null,
  showFilters: false,
};

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
  ...initialState,

  setDatasets: (datasets) => set({ datasets }),
  setTotal: (total) => set({ total }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setFilters: (filters) => set({ filters }),
  addFilter: (key, value) =>
    set((state) => {
      const current = state.filters[key] || [];
      const updated = Array.isArray(current)
        ? [...current, value]
        : [current, value];
      return {
        filters: { ...state.filters, [key]: updated },
      };
    }),
  removeFilter: (key, value) =>
    set((state) => {
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
