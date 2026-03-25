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
        'card p-5 sm:p-6 cursor-pointer transition-all animate-slide-up',
        isActive && 'ring-2 ring-[color:var(--primary)] shadow-[0_16px_34px_-12px_rgba(0,60,107,0.35)]'
      )}
      onClick={() => selectDataset(isActive ? null : dataset.id)}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <p className="label-md mb-1">Dataset</p>
          <h3 className="text-xl sm:text-2xl font-bold text-[color:var(--on-surface)] tracking-tight line-clamp-2 hover:text-[color:var(--primary-container)]">
            {dataset.title}
          </h3>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="label-md">Impactful Resources</p>
          <p className="metric-value mt-1">{dataset.resource_count}</p>
          <ChevronDown
            className={clsx(
              'w-5 h-5 ml-auto mt-2 text-[color:var(--on-surface-variant)] transition-transform',
              isActive && 'rotate-180'
            )}
          />
        </div>
      </div>

      {dataset.description && (
        <p className="text-sm sm:text-[0.95rem] text-[color:var(--on-surface-variant)] leading-relaxed line-clamp-3 mb-4 max-w-3xl">
          {dataset.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
        <div className="chip-base chip-filter">
          <FileText className="w-3.5 h-3.5" />
          <span>{dataset.resource_count} resource{dataset.resource_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="chip-base chip-filter">
          <Calendar className="w-3.5 h-3.5" />
          <span>Updated {modifiedLabel}</span>
        </div>
      </div>

      {formatBadges.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="label-md">Available in</span>
          {formatBadges.slice(0, 4).map((fmt) => (
            <span key={fmt} className="chip-base chip-filter">
              {fmt}
            </span>
          ))}
          {formatBadges.length > 4 && (
            <span className="chip-base chip-discovery">+{formatBadges.length - 4}</span>
          )}
        </div>
      )}

      {dataset.organization && (
        <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary-fixed-dim)] px-3 py-1.5 mb-2">
          <Building2 className="w-4 h-4 text-[color:var(--primary)]" />
          <span className="text-xs font-semibold text-[color:var(--primary)]">{dataset.organization}</span>
        </div>
      )}

      {isActive && (
        <div className="mt-5 animate-fade-in space-y-4 bg-[color:var(--surface-container-low)] rounded-2xl p-4 sm:p-5">
          <div className="flex justify-end">
            <button onClick={handleMoreLike} className="btn-tertiary text-sm">More Like This</button>
          </div>
          {resources.length === 0 && (
            <p className="text-sm text-[color:var(--on-surface-variant)]">No linked resources available for this dataset.</p>
          )}

          {resources.map((resource) => {
            const preview = previewByResource[resource.id];
            const isLoading = loadingResourceId === resource.id;

            return (
              <div
                key={resource.id}
                className="rounded-2xl bg-[color:var(--surface-container-lowest)] p-4 outline outline-1 outline-[color:var(--outline-variant)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--on-surface)] truncate">{resource.name || 'Unnamed resource'}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--on-surface-variant)] flex-wrap">
                      <span className="chip-base chip-filter">{resource.format || 'UNKNOWN'}</span>
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
                  <p className="mt-2 text-xs text-[color:var(--tertiary)]">{previewErrorsByResource[resource.id]}</p>
                )}

                {preview && (
                  <div className="mt-3 viz-surface overflow-x-auto">
                    {preview.success && preview.preview ? (
                      (() => {
                        const previewData = preview.preview;
                        return (
                      <table className="w-full text-xs">
                        <thead className="bg-[color:var(--surface-container-high)]">
                          <tr>
                            {previewData.columns.slice(0, 6).map((column) => (
                              <th key={column} className="text-left px-2 py-1.5 font-medium text-[color:var(--on-surface)]">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.rows.slice(0, 5).map((row, index) => (
                            <tr key={`${resource.id}-row-${index}`} className="even:bg-[color:var(--surface)]">
                              {previewData.columns.slice(0, 6).map((column) => (
                                <td key={`${resource.id}-${column}-${index}`} className="px-2 py-1.5 text-[color:var(--on-surface-variant)]">
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
                        <p className="text-xs text-[color:var(--on-surface-variant)]">{preview.error || 'Preview unavailable for this resource.'}</p>
                        {preview.fallback_url && (
                          <a
                            href={preview.fallback_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[color:var(--primary)]"
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
