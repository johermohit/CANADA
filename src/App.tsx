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
import { AlertTriangle, SlidersHorizontal, X } from 'lucide-react';
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
    <div className={clsx('min-h-screen text-[color:var(--on-surface)]')}>
      <header className="sticky top-0 z-40 glass-nav">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 lg:px-16 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="label-md">The Digital Curator</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Canadian Data Discovery</h1>
            </div>
            <a
              href="https://open.canada.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tertiary text-sm"
            >
              Source Registry
            </a>
          </div>

          <SearchInput onSearch={handleSearch} isLoading={loading} />

          <div className="mt-4 flex items-center gap-2 lg:hidden">
            <button
              onClick={() => toggleFilters()}
              className="btn-secondary text-sm"
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

      <main className="max-w-[1200px] mx-auto px-4 sm:px-10 lg:px-16 py-10">
        <section className="hero-gradient hero-asymmetry rounded-[2rem] px-6 sm:px-10 lg:px-14 py-10 mb-9 shadow-[0_22px_44px_-22px_rgba(0,60,107,0.7)]">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-end">
            <div className="lg:col-span-3">
              <p className="label-md !text-[#d4e7fa]">Accessible Transparency</p>
              <h2 className="text-[clamp(2.1rem,5.2vw,3.5rem)] font-extrabold tracking-[-0.04em] leading-[0.94] mt-2">
                Curated intelligence for Canada&apos;s public datasets.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-[#d6e7f8] max-w-2xl">
                Discover high-signal records first, then dive deeper only where the evidence is strongest.
              </p>
            </div>
            <div className="lg:col-span-2 lg:justify-self-end">
              <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-md">
                <p className="label-md !text-[#e4f0fc]">New Discovery</p>
                <p className="text-4xl font-extrabold tracking-tight mt-1">{total.toLocaleString()}</p>
                <p className="text-sm text-[#dfecfb] mt-2">datasets indexed across federal and provincial publishers</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
          <aside className="hidden lg:block sticky top-24 shell-panel p-3 h-[calc(100vh-96px)] w-full overflow-hidden self-start">
            <FilterPanel facets={displayFacets} onApply={handleApplyFilters} />
          </aside>

          {showFilters && (
            <div className="fixed inset-0 z-50 bg-[rgba(12,28,49,0.32)] lg:hidden" onClick={() => toggleFilters()}>
              <div className="absolute right-0 top-0 h-full w-full max-w-sm p-3 max-h-[calc(100vh-6rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
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

          <div className="min-w-0">
            {activeFilterChips.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.key}:${chip.value || chip.label}`}
                    onClick={() => handleRemoveFilterChip(chip.key, chip.value)}
                    className={clsx(
                      'chip-base',
                      chip.key === 'recency_days' ? 'chip-discovery' : 'chip-filter'
                    )}
                  >
                    <span>{chip.label}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="error-surface p-4 mb-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[color:var(--tertiary)] mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[color:var(--tertiary)] text-sm font-semibold">
                      Search could not complete
                    </p>
                    <p className="text-[color:var(--on-surface)] text-sm mt-1 break-words">
                      {error}
                    </p>
                    <p className="text-[color:var(--on-surface-variant)] text-xs mt-2">
                      Check Vercel function logs if this is production, or run `vercel dev` locally.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="space-y-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card p-5 space-y-3">
                    <div className="skeleton h-6 w-3/4 rounded" />
                    <div className="skeleton h-4 w-full rounded" />
                    <div className="skeleton h-4 w-2/3 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!loading && datasets.length === 0 && !error && (
              <div className="text-center py-16">
                <p className="text-[color:var(--on-surface-variant)] text-lg mb-2">
                  Start exploring by typing what data interests you
                </p>
                <p className="text-[color:var(--secondary)] text-sm">
                  E.g., "agricultural statistics", "climate data by province"
                </p>
              </div>
            )}

            {!loading && datasets.length > 0 && (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-tight">
                    Showing {datasets.length} of {total} result{total !== 1 ? 's' : ''}
                  </h2>
                  <button
                    onClick={() => toggleFilters()}
                    className="btn-secondary text-sm lg:hidden"
                  >
                    {showFilters ? 'Hide Filters' : `Show Filters${activeFilterChips.length ? ` (${activeFilterChips.length})` : ''}`}
                  </button>
                </div>
                <div className="space-y-8">
                  {datasets.map((dataset) => (
                    <DatasetCard key={dataset.id} dataset={dataset} />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-6">
                    <button onClick={handleLoadMore} className="btn-discovery w-full" disabled={loading}>
                      {loading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-14">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 lg:px-16 py-9 text-center">
          <p className="text-sm text-[color:var(--on-surface-variant)]">
            Data sourced from{' '}
            <a
              href="https://open.canada.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--primary)] hover:text-[color:var(--primary-container)]"
            >
              open.canada.ca
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
