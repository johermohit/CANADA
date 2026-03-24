/**
 * FilterPanel.tsx
 * Faceted filtering for discovery refinement
 */
import React from 'react';
import { SearchResponse } from '@/lib/types';
interface FilterPanelProps {
    facets: SearchResponse['facets'];
    onClose?: () => void;
}
export declare const FilterPanel: React.FC<FilterPanelProps>;
export {};
//# sourceMappingURL=FilterPanel.d.ts.map