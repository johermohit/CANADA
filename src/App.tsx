/**
 * App.tsx
 * Main application shell
 */

import React, { useState, useEffect } from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { SearchInput } from './components/SearchInput';
import { DatasetCard } from './components/DatasetCard';
import { FilterPanel } from './components/FilterPanel';
import { Settings } from 'lucide-react';
import clsx from 'clsx';

export const App: React.FC = () => {
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
    error,
    showFilters,
    toggleFilters,
    setLoading,
    setDatasets,
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

  const handleSearch = async (intent: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.orchestrate({ prompt: intent });
      setDatasets(response.results.datasets);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
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
                facets={
                  datasets.length > 0
                    ? {
                        organizations: [
                          { label: 'Environment Canada', count: 142 },
                          { label: 'Health Canada', count: 98 },
                          { label: 'Transport Canada', count: 76 },
                        ],
                        formats: [
                          { label: 'CSV', count: 234 },
                          { label: 'JSON', count: 156 },
                          { label: 'PDF', count: 89 },
                        ],
                        recency: [
                          { label: 'Last 7 days', count: 23 },
                          { label: 'Last 30 days', count: 67 },
                          { label: 'Last 90 days', count: 145 },
                        ],
                      }
                    : { organizations: [], formats: [], recency: [] }
                }
                onClose={() => toggleFilters()}
              />
            </aside>
          )}

          {/* Right: Results */}
          <div className={clsx('lg:col-span-3')}>
            {error && (
              <div className="card bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 p-4 mb-4">
                <p className="text-danger-800 dark:text-danger-300 text-sm">{error}</p>
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
                    {total} result{total !== 1 ? 's' : ''} found
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
