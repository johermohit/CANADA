/**
 * App.tsx
 * Main application shell
 */

import React, { useState, useEffect } from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { SearchResponse } from '@/lib/types';
import { SearchInput } from './components/SearchInput';
import { DatasetCard } from './components/DatasetCard';
import { FilterPanel } from './components/FilterPanel';
import { AlertTriangle, Settings } from 'lucide-react';
import clsx from 'clsx';

const EMPTY_FACETS: SearchResponse['facets'] = {
  organizations: [],
  formats: [],
  recency: [],
};

export const App: React.FC = () => {
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [facets, setFacets] = useState<SearchResponse['facets']>(EMPTY_FACETS);
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
    setLoading,
    setDatasets,
    setTotal,
    setHasMore,
    setError,
  } = useDiscoveryStore();

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

  const handleSearch = async (intent: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const offset = append ? datasets.length : 0;
      const response = await apiClient.orchestrate({
        prompt: intent,
        filters,
        limit: 12,
        offset,
      });

      if (append) {
        const existingIds = new Set(datasets.map((dataset) => dataset.id));
        const nextBatch = response.results.datasets.filter((dataset) => !existingIds.has(dataset.id));
        setDatasets([...datasets, ...nextBatch]);
      } else {
        setDatasets(response.results.datasets);
      }

      setTotal(response.results.total);
      setHasMore(response.results.has_more);
      setFacets(response.results.facets || EMPTY_FACETS);
      setCurrentPrompt(intent);
    } catch (err: any) {
      console.error('Search request failed', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    if (!currentPrompt) return;
    handleSearch(currentPrompt, false);
  };

  const handleLoadMore = () => {
    if (!currentPrompt || loading) return;
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Filters (mobile: collapsible) */}
          {showFilters && (
            <aside className="lg:col-span-1 h-fit sticky top-24">
              <FilterPanel
                facets={facets}
                onApply={handleApplyFilters}
                onClose={() => toggleFilters()}
              />
            </aside>
          )}

          {/* Right: Results */}
          <div className={clsx('lg:col-span-3')}>
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
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
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
