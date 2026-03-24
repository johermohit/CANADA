/**
 * FilterPanel.tsx
 * Faceted filtering for discovery refinement
 */

import React from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { FilterState, SearchResponse } from '@/lib/types';
import { X, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface FilterPanelProps {
  facets: SearchResponse['facets'];
  onClose?: () => void;
  onApply?: () => void;
}

const RECENCY_LABEL_TO_DAYS: Record<string, number> = {
  'Last 7 days': 7,
  'Last 30 days': 30,
  'Last 90 days': 90,
};

export const FilterPanel: React.FC<FilterPanelProps> = ({ facets, onClose, onApply }) => {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['organizations', 'formats', 'recency'])
  );

  const { filters, addFilter, removeFilter, setFilters } = useDiscoveryStore();

  const isChecked = (key: keyof FilterState, label: string) => {
    if (key === 'recency_days') {
      return filters.recency_days === RECENCY_LABEL_TO_DAYS[label];
    }

    const current = filters[key];
    return Array.isArray(current) ? current.includes(label) : false;
  };

  const toggleFilter = (key: keyof FilterState, label: string, checked: boolean) => {
    if (key === 'recency_days') {
      const nextDays = checked ? RECENCY_LABEL_TO_DAYS[label] : undefined;
      setFilters({ ...filters, recency_days: nextDays });
      return;
    }

    if (checked) {
      addFilter(key, label);
      return;
    }

    removeFilter(key, label);
  };

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const FilterSection = ({
    title,
    sectionKey,
    filterKey,
    items,
  }: {
    title: string;
    sectionKey: string;
    filterKey: keyof FilterState;
    items: Array<{ label: string; count: number }>;
  }) => {
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div className="border-b border-gray-200 dark:border-gray-800 py-4">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full hover:bg-gray-50 dark:hover:bg-gray-900/30 p-2 -m-2 rounded transition-colors"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
          <ChevronDown
            className={clsx('w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-180')}
          />
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <label key={item.label} className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/30 p-2 -m-2 rounded transition-colors">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                  checked={isChecked(filterKey, item.label)}
                  onChange={(e) => {
                    toggleFilter(filterKey, item.label, e.target.checked);
                  }}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex-1">{item.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-500">{item.count}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="font-bold text-lg text-gray-900 dark:text-gray-50">Filter by</h2>
        {onClose && (
          <button onClick={onClose} className="btn-ghost p-2 -m-2">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <FilterSection title="Publisher" sectionKey="organizations" filterKey="organizations" items={facets.organizations} />
        <FilterSection title="Format" sectionKey="formats" filterKey="formats" items={facets.formats} />
        <FilterSection title="Updated" sectionKey="recency" filterKey="recency_days" items={facets.recency} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        <button className="btn-primary w-full" onClick={onApply}>Apply Filters</button>
        <button
          onClick={() => setFilters({})}
          className="btn-secondary w-full"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};
