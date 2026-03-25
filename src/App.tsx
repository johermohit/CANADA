/**
 * App.tsx
 * Main application shell
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { Dataset, FilterState, SearchResponse } from '@/lib/types';
import { SearchInput } from './components/SearchInput';
import { DatasetCard } from './components/DatasetCard';
import { FilterPanel } from './components/FilterPanel';
import { AlertTriangle, Settings, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';

const EMPTY_FACETS: SearchResponse['facets'] = {
  organizations: [],
  jurisdictions: [],
  subjects: [],
  formats: [],
  frequencies: [],
  collection_types: [],
  resource_types: [],
  languages: [],
  keywords: [],
  recency: [],
};

const RECENCY_DAYS_TO_LABEL: Record<number, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
};

const FILTER_ARRAY_KEYS: Array<
  'keywords' |
  'organizations' |
  'jurisdictions' |
  'subjects' |
  'formats' |
  'frequencies' |
  'collection_types' |
  'resource_types' |
  'languages'
> = [
  'keywords',
  'organizations',
  'jurisdictions',
  'subjects',
  'formats',
  'frequencies',
  'collection_types',
  'resource_types',
  'languages',
];

const FILTER_QUERY_KEYS = [...FILTER_ARRAY_KEYS, 'subject_query', 'recency_days'] as const;

function parseFiltersFromUrl(search: string): FilterState {
  const params = new URLSearchParams(search);
  const parsed: FilterState = {};

  FILTER_ARRAY_KEYS.forEach((key) => {
    const values = params
      .getAll(key)
      .map((v) => v.trim())
      .filter(Boolean);

    if (values.length > 0) {
      parsed[key] = values;
    }
  });

  const subjectQuery = params.get('subject_query')?.trim();
  if (subjectQuery) {
    parsed.subject_query = subjectQuery;
  }

  const recencyRaw = params.get('recency_days');
  if (recencyRaw) {
    const recency = Number(recencyRaw);
    if (Number.isFinite(recency) && recency > 0) {
      parsed.recency_days = Math.round(recency);
    }
  }

  return parsed;
}

function writeFiltersToUrl(filters: FilterState) {
  const params = new URLSearchParams(window.location.search);

  FILTER_QUERY_KEYS.forEach((key) => {
    params.delete(key);
  });

  FILTER_ARRAY_KEYS.forEach((key) => {
    const values = filters[key];
    if (Array.isArray(values)) {
      values
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((value) => params.append(key, value));
    }
  });

  if (filters.subject_query?.trim()) {
    params.set('subject_query', filters.subject_query.trim());
  }

  if (typeof filters.recency_days === 'number') {
    params.set('recency_days', String(filters.recency_days));
  }

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl);
  }
}

function toSortedFacetEntries(map: Map<string, number>, limit = 40) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function deriveFacetsFromDatasets(datasets: Dataset[]): SearchResponse['facets'] {
  const organizations = new Map<string, { label: string; value: string; count: number }>();
  const jurisdictions = new Map<string, number>();
  const subjects = new Map<string, number>();
  const formats = new Map<string, number>();
  const frequencies = new Map<string, number>();
  const collectionTypes = new Map<string, number>();
  const resourceTypes = new Map<string, number>();
  const languages = new Map<string, number>();
  const keywords = new Map<string, number>();

  let recency7 = 0;
  let recency30 = 0;
  let recency90 = 0;

  datasets.forEach((dataset) => {
    const organizationValue = (dataset.organization_key || dataset.organization || '').trim();
    const organizationLabel = (dataset.organization || dataset.organization_key || '').trim();
    if (organizationValue) {
      const current = organizations.get(organizationValue);
      organizations.set(organizationValue, {
        label: organizationLabel || organizationValue,
        value: organizationValue,
        count: (current?.count || 0) + 1,
      });
    }

    const jurisdiction = (dataset.jurisdiction || '').trim();
    if (jurisdiction) {
      jurisdictions.set(jurisdiction, (jurisdictions.get(jurisdiction) || 0) + 1);
    }

    const subjectRaw = (dataset.subject || '').trim();
    if (subjectRaw) {
      subjectRaw.split(/[,;]+/).forEach((part) => {
        const value = part.trim();
        if (!value) return;
        subjects.set(value, (subjects.get(value) || 0) + 1);
      });
    }

    (dataset.formats || []).forEach((format) => {
      const value = format.trim();
      if (!value) return;
      formats.set(value, (formats.get(value) || 0) + 1);
    });

    const frequency = (dataset.update_frequency || '').trim();
    if (frequency) {
      frequencies.set(frequency, (frequencies.get(frequency) || 0) + 1);
    }

    const collectionType = (dataset.collection_type || '').trim();
    if (collectionType) {
      collectionTypes.set(collectionType, (collectionTypes.get(collectionType) || 0) + 1);
    }

    const datasetLanguage = (dataset.language || '').trim();
    if (datasetLanguage) {
      languages.set(datasetLanguage, (languages.get(datasetLanguage) || 0) + 1);
    }

    (dataset.resources || []).forEach((resource) => {
      const resourceType = (resource.resource_type || '').trim();
      if (resourceType) {
        resourceTypes.set(resourceType, (resourceTypes.get(resourceType) || 0) + 1);
      }

      const resourceLanguage = (resource.language || '').trim();
      if (resourceLanguage) {
        languages.set(resourceLanguage, (languages.get(resourceLanguage) || 0) + 1);
      }
    });

    (dataset.keywords || []).forEach((keyword) => {
      const value = keyword.trim();
      if (!value) return;
      keywords.set(value, (keywords.get(value) || 0) + 1);
    });

    if (dataset.metadata_modified) {
      const modifiedAt = new Date(dataset.metadata_modified).getTime();
      if (Number.isFinite(modifiedAt)) {
        const ageMs = Date.now() - modifiedAt;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays <= 7) recency7 += 1;
        if (ageDays <= 30) recency30 += 1;
        if (ageDays <= 90) recency90 += 1;
      }
    }
  });

  return {
    organizations: Array.from(organizations.values()).sort((a, b) => b.count - a.count).slice(0, 40),
    jurisdictions: toSortedFacetEntries(jurisdictions),
    subjects: toSortedFacetEntries(subjects),
    formats: toSortedFacetEntries(formats),
    frequencies: toSortedFacetEntries(frequencies),
    collection_types: toSortedFacetEntries(collectionTypes),
    resource_types: toSortedFacetEntries(resourceTypes),
    languages: toSortedFacetEntries(languages),
    keywords: toSortedFacetEntries(keywords),
    recency: [
      { label: 'Last 7 days', count: recency7 },
      { label: 'Last 30 days', count: recency30 },
      { label: 'Last 90 days', count: recency90 },
    ],
  };
}

export const App: React.FC = () => {
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [resolvedQuery, setResolvedQuery] = useState<FilterState | null>(null);
  const hasHydratedFiltersFromUrl = useRef(false);
  const hasCompletedInitialLoad = useRef(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check system preference or localStorage
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const {
    datasets,
    loading,
    total,
    hasMore,
    error,
    filters,
    showFilters,
    toggleFilters,
    removeFilter,
    setFilters,
    setLoading,
    setDatasets,
    setTotal,
    setHasMore,
    setError,
    facets,
    setFacets,
  } = useDiscoveryStore();

  const activeFilterChips = React.useMemo(() => {
    const chips: Array<{ key: keyof FilterState; value?: string; label: string }> = [];

    const addArrayChips = (key: keyof FilterState) => {
      const values = filters[key];
      if (Array.isArray(values)) {
        values.forEach((value) => {
          chips.push({ key, value, label: value });
        });
      }
    };

    addArrayChips('keywords');
    addArrayChips('organizations');
    addArrayChips('jurisdictions');
    addArrayChips('subjects');
    addArrayChips('formats');
    addArrayChips('frequencies');
    addArrayChips('collection_types');
    addArrayChips('resource_types');
    addArrayChips('languages');

    if (filters.subject_query?.trim()) {
      chips.push({
        key: 'subject_query',
        label: `Subject contains: ${filters.subject_query.trim()}`,
      });
    }

    if (typeof filters.recency_days === 'number') {
      chips.push({
        key: 'recency_days',
        label: RECENCY_DAYS_TO_LABEL[filters.recency_days] || `Last ${filters.recency_days} days`,
      });
    }

    return chips;
  }, [filters]);

  const displayFacets = React.useMemo(
    () => (datasets.length > 0 ? deriveFacetsFromDatasets(datasets) : facets),
    [datasets, facets]
  );

  const handleRemoveFilterChip = (key: keyof FilterState, value?: string) => {
    if (key === 'recency_days' || key === 'subject_query') {
      const nextFilters = { ...filters };
      delete nextFilters[key];
      setFilters(nextFilters);
      return;
    }

    if (value) {
      removeFilter(key, value);
      return;
    }

    removeFilter(key);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const parsed = parseFiltersFromUrl(window.location.search);
      if (Object.keys(parsed).length > 0) {
        setFilters(parsed);
        setResolvedQuery(parsed);
      }

      hasHydratedFiltersFromUrl.current = true;

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.search({
          ...parsed,
          limit: 12,
          offset: 0,
        });

        if (cancelled) return;

        setDatasets(response.datasets);
        setTotal(response.total);
        setHasMore(response.has_more);
        setFacets(response.facets || EMPTY_FACETS);
        setResolvedQuery(Object.keys(parsed).length > 0 ? parsed : {});
      } catch (err: any) {
        if (cancelled) return;
        console.error('Initial browse request failed', err);
        setError(err.message || 'Search failed');
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasCompletedInitialLoad.current = true;
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setDatasets, setError, setFacets, setFilters, setHasMore, setLoading, setTotal]);

  useEffect(() => {
    if (!hasHydratedFiltersFromUrl.current) return;
    writeFiltersToUrl(filters);
  }, [filters]);

  useEffect(() => {
    if (!hasCompletedInitialLoad.current) return;

    const timer = window.setTimeout(() => {
      void handleApplyFilters();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [filters]);

  const handleSearch = async (intent: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const offset = append ? datasets.length : 0;
      const response = append && resolvedQuery
        ? await apiClient.search({
            ...resolvedQuery,
            limit: 12,
            offset,
          })
        : await apiClient.orchestrate({
            prompt: intent,
            filters,
            limit: 12,
            offset,
          });

      if (append) {
        const nextDatasets = 'results' in response ? response.results.datasets : response.datasets;
        const existingIds = new Set(datasets.map((dataset) => dataset.id));
        const nextBatch = nextDatasets.filter((dataset) => !existingIds.has(dataset.id));
        setDatasets([...datasets, ...nextBatch]);
      } else {
        const nextDatasets = 'results' in response ? response.results.datasets : response.datasets;
        setDatasets(nextDatasets);
      }

      const resultPayload = 'results' in response ? response.results : response;
      setTotal(resultPayload.total);
      setHasMore(resultPayload.has_more);
      setFacets(resultPayload.facets || EMPTY_FACETS);
      if ('query' in response) {
        setResolvedQuery(response.query || null);
      }
      setCurrentPrompt(intent);
    } catch (err: any) {
      console.error('Search request failed', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    setResolvedQuery(filters);

    if (currentPrompt) {
      await handleSearch(currentPrompt, false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.search({
        ...filters,
        limit: 12,
        offset: 0,
      });
      setDatasets(response.datasets);
      setTotal(response.total);
      setHasMore(response.has_more);
      setFacets(response.facets || EMPTY_FACETS);
    } catch (err: any) {
      console.error('Filter apply request failed', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (loading || !resolvedQuery) return;
    handleSearch(currentPrompt, true);
  };

  return (
    <div className={clsx('min-h-screen bg-white dark:bg-gray-950 transition-colors')}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
                🍁 Canadian Data Discovery
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Explore open government data playfully
              </p>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="btn-ghost p-2"
              aria-label="Toggle dark mode"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <SearchInput onSearch={handleSearch} isLoading={loading} />

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => toggleFilters()}
              className="btn-secondary text-sm inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters {activeFilterChips.length > 0 ? `(${activeFilterChips.length})` : ''}
            </button>
            {activeFilterChips.length > 0 && (
              <button
                onClick={() => setFilters({})}
                className="btn-ghost text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Filters (desktop always visible) */}
          <aside className="hidden lg:block lg:col-span-1 h-fit sticky top-24">
            <FilterPanel facets={displayFacets} onApply={handleApplyFilters} />
          </aside>

          {/* Mobile filter drawer */}
          {showFilters && (
            <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => toggleFilters()}>
              <div className="absolute right-0 top-0 h-full w-full max-w-sm p-3" onClick={(e) => e.stopPropagation()}>
                <FilterPanel
                  facets={displayFacets}
                  onApply={() => {
                    handleApplyFilters();
                    toggleFilters();
                  }}
                  onClose={() => toggleFilters()}
                />
              </div>
            </div>
          )}

          {/* Right: Results */}
          <div className={clsx('lg:col-span-3')}>
            {activeFilterChips.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.key}:${chip.value || chip.label}`}
                    onClick={() => handleRemoveFilterChip(chip.key, chip.value)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <span>{chip.label}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="card bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-300 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-danger-900 dark:text-danger-100 text-sm font-medium">
                      Search could not complete
                    </p>
                    <p className="text-danger-800 dark:text-danger-300 text-sm mt-1 break-words">
                      {error}
                    </p>
                    <p className="text-danger-700 dark:text-danger-400 text-xs mt-2">
                      Check Vercel function logs if this is production, or run `vercel dev` locally.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card p-4 space-y-3">
                    <div className="skeleton h-6 w-3/4 rounded" />
                    <div className="skeleton h-4 w-full rounded" />
                    <div className="skeleton h-4 w-2/3 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!loading && datasets.length === 0 && !error && (
              <div className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                  Start exploring by typing what data interests you
                </p>
                <p className="text-gray-400 dark:text-gray-600 text-sm">
                  E.g., "agricultural statistics", "climate data by province"
                </p>
              </div>
            )}

            {!loading && datasets.length > 0 && (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Showing {datasets.length} of {total} result{total !== 1 ? 's' : ''}
                  </h2>
                  <button
                    onClick={() => toggleFilters()}
                    className="btn-secondary text-sm lg:hidden"
                  >
                    {showFilters ? 'Hide Filters' : `Show Filters${activeFilterChips.length ? ` (${activeFilterChips.length})` : ''}`}
                  </button>
                </div>
                <div className="space-y-4">
                  {datasets.map((dataset) => (
                    <DatasetCard key={dataset.id} dataset={dataset} />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-6">
                    <button onClick={handleLoadMore} className="btn-secondary w-full" disabled={loading}>
                      {loading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Data sourced from{' '}
            <a
              href="https://open.canada.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              open.canada.ca
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
