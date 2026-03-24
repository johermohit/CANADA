import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * App.tsx
 * Main application shell
 */
import { useState, useEffect } from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { SearchInput } from './components/SearchInput';
import { DatasetCard } from './components/DatasetCard';
import { FilterPanel } from './components/FilterPanel';
import { Settings } from 'lucide-react';
import clsx from 'clsx';
export const App = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check system preference or localStorage
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved)
                return saved === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const { datasets, loading, total, error, showFilters, toggleFilters, setLoading, setDatasets, setError, } = useDiscoveryStore();
    useEffect(() => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
        }
        else {
            root.classList.remove('dark');
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        }
    }, [isDarkMode]);
    const handleSearch = async (intent) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.orchestrate({ prompt: intent });
            setDatasets(response.results.datasets);
        }
        catch (err) {
            setError(err.message || 'Search failed');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: clsx('min-h-screen bg-white dark:bg-gray-950 transition-colors'), children: [_jsx("header", { className: "sticky top-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50", children: "\uD83C\uDF41 Canadian Data Discovery" }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Explore open government data playfully" })] }), _jsx("button", { onClick: () => setIsDarkMode(!isDarkMode), className: "btn-ghost p-2", "aria-label": "Toggle dark mode", children: _jsx(Settings, { className: "w-5 h-5" }) })] }), _jsx(SearchInput, { onSearch: handleSearch, isLoading: loading })] }) }), _jsx("main", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-6", children: [showFilters && (_jsx("aside", { className: "lg:col-span-1 h-fit sticky top-24", children: _jsx(FilterPanel, { facets: datasets.length > 0
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
                                    : { organizations: [], formats: [], recency: [] }, onClose: () => toggleFilters() }) })), _jsxs("div", { className: clsx('lg:col-span-3'), children: [error && (_jsx("div", { className: "card bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 p-4 mb-4", children: _jsx("p", { className: "text-danger-800 dark:text-danger-300 text-sm", children: error }) })), loading && (_jsx("div", { className: "space-y-4", children: [1, 2, 3].map((i) => (_jsxs("div", { className: "card p-4 space-y-3", children: [_jsx("div", { className: "skeleton h-6 w-3/4 rounded" }), _jsx("div", { className: "skeleton h-4 w-full rounded" }), _jsx("div", { className: "skeleton h-4 w-2/3 rounded" })] }, i))) })), !loading && datasets.length === 0 && !error && (_jsxs("div", { className: "text-center py-16", children: [_jsx("p", { className: "text-gray-500 dark:text-gray-400 text-lg mb-2", children: "Start exploring by typing what data interests you" }), _jsx("p", { className: "text-gray-400 dark:text-gray-600 text-sm", children: "E.g., \"agricultural statistics\", \"climate data by province\"" })] })), !loading && datasets.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900 dark:text-gray-50", children: [total, " result", total !== 1 ? 's' : '', " found"] }), _jsx("button", { onClick: () => toggleFilters(), className: "btn-secondary text-sm lg:hidden", children: showFilters ? 'Hide Filters' : 'Show Filters' })] }), _jsx("div", { className: "space-y-4", children: datasets.map((dataset) => (_jsx(DatasetCard, { dataset: dataset }, dataset.id))) })] }))] })] }) }), _jsx("footer", { className: "border-t border-gray-200 dark:border-gray-800 mt-12", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center", children: _jsxs("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: ["Data sourced from", ' ', _jsx("a", { href: "https://open.canada.ca", target: "_blank", rel: "noopener noreferrer", className: "text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300", children: "open.canada.ca" })] }) }) })] }));
};
//# sourceMappingURL=App.js.map