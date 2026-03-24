import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SearchInput.tsx
 * Main command/search input for discovery
 */
import { useState } from 'react';
import { Search, Loader } from 'lucide-react';
import clsx from 'clsx';
export const SearchInput = ({ onSearch, isLoading = false, placeholder = 'What data are you looking for? (e.g., "agricultural data" or "climate by region")', }) => {
    const [query, setQuery] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
        }
    };
    return (_jsx("form", { onSubmit: handleSubmit, className: "w-full", children: _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: placeholder, className: clsx('input-field pl-12 pr-12 py-3 text-base', 'placeholder:text-gray-500 dark:placeholder:text-gray-400'), disabled: isLoading, autoFocus: true }), _jsx(Search, { className: clsx('w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2', 'text-gray-400 dark:text-gray-600 pointer-events-none') }), _jsx("button", { type: "submit", disabled: isLoading || !query.trim(), className: clsx('absolute right-2 top-1/2 -translate-y-1/2 p-2', 'text-gray-400 hover:text-primary-600 transition-colors', 'disabled:opacity-50 disabled:cursor-not-allowed'), children: isLoading ? (_jsx(Loader, { className: "w-5 h-5 animate-spin" })) : (_jsx("span", { className: "text-sm font-medium", children: "Search" })) })] }) }));
};
//# sourceMappingURL=SearchInput.js.map