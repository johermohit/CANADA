/**
 * POST /api/search
 * Fast metadata search using Supabase
 */

import { SearchQuery, SearchResponse } from '../src/lib/types';
import { searchDatasets, getOrganizations, getAvailableFormats, getJurisdictions, getSubjects, getFrequencies, getCollectionTypes, getResourceTypes, getLanguages, getKeywordsChips } from './supabase.js';
import {
  createErrorResponse,
  getErrorMessage,
  logApiError,
  logApiInfo,
  parseRequestBody,
  sendJson,
  sendOptions,
} from './utils.js';

export default async function handler(req: any, res: any) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  const route = '/api/search';
  const origin = req.headers?.origin;

  if (req.method === 'OPTIONS') {
    sendOptions(res, origin);
    return;
  }

  if (req.method !== 'POST') {
    const { error, status } = createErrorResponse('METHOD_NOT_ALLOWED', 'Only POST allowed', 405, requestId);
    sendJson(res, status, error, origin);
    return;
  }

  try {
    const startedAt = Date.now();
    logApiInfo({ requestId, route, method: req.method, message: 'search request received' });
    const body: SearchQuery = parseRequestBody<SearchQuery>(req.body);

    const hasResolvedFilters =
      (Array.isArray(body.keywords) && body.keywords.length > 0) ||
      (Array.isArray(body.organizations) && body.organizations.length > 0) ||
      (Array.isArray(body.formats) && body.formats.length > 0) ||
      typeof body.recency_days === 'number';

    const hasIntent = typeof body.intent === 'string' && body.intent.trim().length > 0;

    if (!hasResolvedFilters && !hasIntent) {
      const { error, status } = createErrorResponse(
        'INVALID_REQUEST',
        'Provide resolved filters or a non-empty intent field',
        400,
        requestId
      );
      sendJson(res, status, error, origin);
      return;
    }

    const keywords = hasResolvedFilters
      ? body.keywords
      : body.intent
          ?.toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 2);

    const startTime = Date.now();

    const limit = body.limit || 12;
    const offset = body.offset || 0;

    const { total, visible, has_more, datasets } = await searchDatasets({
      keywords,
      organizations: body.organizations,
      jurisdictions: body.jurisdictions,
      subjects: body.subjects,
      subject_query: body.subject_query,
      formats: body.formats,
      frequencies: body.frequencies,
      collection_types: body.collection_types,
      resource_types: body.resource_types,
      languages: body.languages,
      recency_days: body.recency_days,
      limit,
      offset,
    });

    // gather facets for the UI
    const [orgs, formats, jurisdictions, subjects, frequencies, collectionTypes, resourceTypes, languages, keywordsFacet, recency] = await Promise.all([
      getOrganizations(),
      getAvailableFormats(),
      getJurisdictions(),
      getSubjects(),
      getFrequencies(),
      getCollectionTypes(),
      getResourceTypes(),
      getLanguages(),
      getKeywordsChips(),
      Promise.resolve([
        { label: 'Last 7 days', count: 0 },
        { label: 'Last 30 days', count: 0 },
        { label: 'Last 90 days', count: 0 },
      ]),
    ]);

    const response: SearchResponse = {
      total,
      visible,
      offset,
      limit,
      has_more,
      datasets,
      facets: {
        organizations: orgs,
        jurisdictions: jurisdictions,
        subjects: subjects,
        formats: formats,
        frequencies: frequencies,
        collection_types: collectionTypes,
        resource_types: resourceTypes,
        languages: languages,
        keywords: keywordsFacet,
        recency,
      },
    };

    logApiInfo({
      requestId,
      route,
      method: req.method,
      message: 'search completed',
      extra: { duration_ms: Date.now() - startedAt, total, visible, datasets: datasets.length },
    });

    sendJson(res, 200, response, origin);
    return;
  } catch (error: any) {
    logApiError({
      requestId,
      route,
      method: req.method,
      message: 'search failed',
      error,
    });
    const { error: errResponse, status } = createErrorResponse(
      'SEARCH_ERROR',
      getErrorMessage(error) || 'Search failed',
      500,
      requestId
    );
    sendJson(res, status, errResponse, origin);
    return;
  }
}
