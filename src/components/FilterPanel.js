import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FilterPanel.tsx
 * Faceted filtering for discovery refinement
 */
import React from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { X, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
export const FilterPanel = ({ facets, onClose }) => {
    const [expandedSections, setExpandedSections] = React.useState(new Set(['organizations', 'formats', 'recency']));
    const { filters, addFilter, removeFilter } = useDiscoveryStore();
    const toggleSection = (section) => {
        const next = new Set(expandedSections);
        if (next.has(section)) {
            next.delete(section);
        }
        else {
            next.add(section);
        }
        setExpandedSections(next);
    };
    const FilterSection = ({ title, key: sectionKey, items, }) => {
        const isExpanded = expandedSections.has(sectionKey);
        return (_jsxs("div", { className: "border-b border-gray-200 dark:border-gray-800 py-4", children: [_jsxs("button", { onClick: () => toggleSection(sectionKey), className: "flex items-center justify-between w-full hover:bg-gray-50 dark:hover:bg-gray-900/30 p-2 -m-2 rounded transition-colors", children: [_jsx("h3", { className: "font-semibold text-gray-900 dark:text-gray-50", children: title }), _jsx(ChevronDown, { className: clsx('w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-180') })] }), isExpanded && (_jsx("div", { className: "mt-3 space-y-2", children: items.map((item) => (_jsxs("label", { className: "flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/30 p-2 -m-2 rounded transition-colors", children: [_jsx("input", { type: "checkbox", className: "w-4 h-4 text-primary-500 rounded focus:ring-2 focus:ring-primary-500", checked: 
                                // This is a simplified check - in production, iterate through filters array
                                false, onChange: (e) => {
                                    if (e.target.checked) {
                                        addFilter('organizations', item.label);
                                    }
                                    else {
                                        removeFilter('organizations', item.label);
                                    }
                                } }), _jsx("span", { className: "ml-2 text-sm text-gray-700 dark:text-gray-300 flex-1", children: item.label }), _jsx("span", { className: "text-xs text-gray-500 dark:text-gray-500", children: item.count })] }, item.label))) }))] }));
    };
    return (_jsxs("div", { className: "card h-full flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800", children: [_jsx("h2", { className: "font-bold text-lg text-gray-900 dark:text-gray-50", children: "Filter by" }), onClose && (_jsx("button", { onClick: onClose, className: "btn-ghost p-2 -m-2", children: _jsx(X, { className: "w-5 h-5" }) }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [_jsx(FilterSection, { title: "Publisher", items: facets.organizations }, "organizations"), _jsx(FilterSection, { title: "Format", items: facets.formats }, "formats"), _jsx(FilterSection, { title: "Updated", items: facets.recency }, "recency")] }), _jsxs("div", { className: "p-4 border-t border-gray-200 dark:border-gray-800 space-y-2", children: [_jsx("button", { className: "btn-primary w-full", children: "Apply Filters" }), _jsx("button", { onClick: () => useDiscoveryStore.setState({ filters: {} }), className: "btn-secondary w-full", children: "Clear All" })] })] }));
};
//# sourceMappingURL=FilterPanel.js.map