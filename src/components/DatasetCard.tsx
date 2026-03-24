/**
 * DatasetCard.tsx
 * Individual dataset card showing quick-look information
 */

import React from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { Dataset } from '@/lib/types';
import { FileText, Calendar, Building2, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface DatasetCardProps {
  dataset: Dataset;
  isSelected?: boolean;
}

export const DatasetCard: React.FC<DatasetCardProps> = ({ dataset, isSelected }) => {
  const selectDataset = useDiscoveryStore((state) => state.selectDataset);
  const selectedDatasetId = useDiscoveryStore((state) => state.selectedDatasetId);

  const isActive = selectedDatasetId === dataset.id;

  const formatBadges = dataset.formats || [];
  const recencyText = formatDistanceToNow(new Date(dataset.metadata_modified), {
    addSuffix: true,
  });

  return (
    <div
      className={clsx(
        'card p-4 cursor-pointer transition-all animate-slide-up',
        isActive && 'ring-2 ring-primary-500 shadow-card-hover'
      )}
      onClick={() => selectDataset(isActive ? null : dataset.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400">
            {dataset.title}
          </h3>
        </div>
        <ChevronDown
          className={clsx(
            'w-5 h-5 text-gray-400 transition-transform flex-shrink-0',
            isActive && 'rotate-180'
          )}
        />
      </div>

      {/* Description */}
      {dataset.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{dataset.description}</p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-3">
        <div className="flex items-center gap-1">
          <FileText className="w-4 h-4" />
          <span>{dataset.resource_count} resource{dataset.resource_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>{recencyText}</span>
        </div>
      </div>

      {/* Quick Look badges */}
      {formatBadges.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Available in:</span>
          {formatBadges.slice(0, 4).map((fmt) => (
            <span key={fmt} className="badge-primary text-xs">
              {fmt}
            </span>
          ))}
          {formatBadges.length > 4 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">+{formatBadges.length - 4}</span>
          )}
        </div>
      )}

      {/* Publisher chip */}
      {dataset.organization && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{dataset.organization}</span>
        </div>
      )}

      {/* Expanded state */}
      {isActive && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 animate-fade-in">
          <button className="btn-primary w-full text-sm">View Details</button>
        </div>
      )}
    </div>
  );
};
