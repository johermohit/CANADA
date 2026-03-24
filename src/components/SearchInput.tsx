/**
 * SearchInput.tsx
 * Main command/search input for discovery
 */

import React, { useState } from 'react';
import { Search, Loader } from 'lucide-react';
import clsx from 'clsx';

interface SearchInputProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  isLoading = false,
  placeholder = 'What data are you looking for? (e.g., "agricultural data" or "climate by region")',
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            'input-field pl-12 pr-12 py-3 text-base',
            'placeholder:text-gray-500 dark:placeholder:text-gray-400'
          )}
          disabled={isLoading}
          autoFocus
        />

        <Search
          className={clsx(
            'w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2',
            'text-gray-400 dark:text-gray-600 pointer-events-none'
          )}
        />

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className={clsx(
            'absolute right-2 top-1/2 -translate-y-1/2 p-2',
            'text-gray-400 hover:text-primary-600 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <span className="text-sm font-medium">Search</span>
          )}
        </button>
      </div>
    </form>
  );
};
