/**
 * DatasetCard.tsx
 * Individual dataset card showing quick-look information
 */

import React from 'react';
import { useDiscoveryStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { Dataset, PreviewResponse } from '@/lib/types';
import { ExternalLink, FileText, Calendar, Building2, ChevronDown, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface DatasetCardProps {
  dataset: Dataset;
  isSelected?: boolean;
}

export const DatasetCard: React.FC<DatasetCardProps> = ({ dataset, isSelected }) => {
  const selectDataset = useDiscoveryStore((state) => state.selectDataset);
  const selectedDatasetId = useDiscoveryStore((state) => state.selectedDatasetId);
  const setDatasets = useDiscoveryStore((s) => s.setDatasets);
  const setTotal = useDiscoveryStore((s) => s.setTotal);
  const setHasMore = useDiscoveryStore((s) => s.setHasMore);
  const setFacets = useDiscoveryStore((s) => s.setFacets);
  const setLoading = useDiscoveryStore((s) => s.setLoading);
  const setError = useDiscoveryStore((s) => s.setError);
  const [previewByResource, setPreviewByResource] = React.useState<Record<string, PreviewResponse>>({});
  const [loadingResourceId, setLoadingResourceId] = React.useState<string | null>(null);
  const [previewErrorsByResource, setPreviewErrorsByResource] = React.useState<Record<string, string>>({});

  const isActive = selectedDatasetId === dataset.id;

  const formatBadges = dataset.formats || [];
  const modifiedLabel = dataset.metadata_modified
    ? new Date(dataset.metadata_modified).toLocaleDateString()
    : 'Date unavailable';

  const resources = dataset.resources || [];

  const loadPreview = async (resourceId: string, previewResourceId: string) => {
    setPreviewErrorsByResource((prev) => {
      const next = { ...prev };
      delete next[resourceId];
      return next;
    });
    setLoadingResourceId(resourceId);
    try {
      const response = await apiClient.preview(previewResourceId, 25);
      setPreviewByResource((prev) => ({ ...prev, [resourceId]: response }));
    } catch (error: any) {
      setPreviewErrorsByResource((prev) => ({
        ...prev,
        [resourceId]: error?.message || 'Preview unavailable',
      }));
    } finally {
      setLoadingResourceId(null);
    }
  };

  const handleMoreLike = async () => {
    setError(null);
    setLoading(true);
    try {
      const resp = await apiClient.moreLike(dataset.id, 12, 0);
      setDatasets(resp.datasets);
      setTotal(resp.total);
      setHasMore(resp.has_more);
      if (resp.facets) setFacets(resp.facets as any);
    } catch (err: any) {
      setError(err?.message || 'More like this failed');
    } finally {
      setLoading(false);
    }
  };

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
          <span>{modifiedLabel}</span>
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
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 animate-fade-in space-y-3">
          <div className="flex justify-end">
            <button onClick={handleMoreLike} className="btn-ghost text-sm">More Like This</button>
          </div>
          {resources.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No linked resources available for this dataset.</p>
          )}

          {resources.map((resource) => {
            const preview = previewByResource[resource.id];
            const isLoading = loadingResourceId === resource.id;

            return (
              <div
                key={resource.id}
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{resource.name || 'Unnamed resource'}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="badge-primary">{resource.format || 'UNKNOWN'}</span>
                      {resource.size && <span>{resource.size}</span>}
                      {!!resource.datastore_fields?.length && <span>{resource.datastore_fields.length} columns</span>}
                    </div>
                  </div>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2"
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Open resource URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {resource.datastore_active ? (
                    <button
                      className="btn-primary text-xs"
                      onClick={() => loadPreview(resource.id, resource.ckan_resource_id || resource.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        'View Details'
                      )}
                    </button>
                  ) : resource.format && ['WMS', 'ESRI REST', 'GEOJSON'].includes(resource.format) ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs"
                    >
                      Map View
                    </a>
                  ) : (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs"
                    >
                      Download
                    </a>
                  )}
                </div>

                {previewErrorsByResource[resource.id] && (
                  <p className="mt-2 text-xs text-danger-700 dark:text-danger-300">{previewErrorsByResource[resource.id]}</p>
                )}

                {preview && (
                  <div className="mt-3 rounded border border-gray-200 dark:border-gray-800 overflow-x-auto">
                    {preview.success && preview.preview ? (
                      (() => {
                        const previewData = preview.preview;
                        return (
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                          <tr>
                            {previewData.columns.slice(0, 6).map((column) => (
                              <th key={column} className="text-left px-2 py-1 font-medium text-gray-700 dark:text-gray-300">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.rows.slice(0, 5).map((row, index) => (
                            <tr key={`${resource.id}-row-${index}`} className="border-t border-gray-100 dark:border-gray-800">
                              {previewData.columns.slice(0, 6).map((column) => (
                                <td key={`${resource.id}-${column}-${index}`} className="px-2 py-1 text-gray-600 dark:text-gray-400">
                                  {String((row as Record<string, unknown>)[column] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                        );
                      })()
                    ) : (
                      <div className="p-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">{preview.error || 'Preview unavailable for this resource.'}</p>
                        {preview.fallback_url && (
                          <a
                            href={preview.fallback_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 dark:text-primary-400"
                          >
                            Open fallback page
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
