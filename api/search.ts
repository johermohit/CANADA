/**
 * POST /api/search
 * Fast metadata search using Supabase
 */

import { SearchQuery, SearchResponse } from '../src/lib/types';
import { searchDatasets } from './supabase.js';
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

    if (!body.intent || typeof body.intent !== 'string') {
      const { error, status } = createErrorResponse('INVALID_REQUEST', 'Missing or invalid intent field', 400, requestId);
      sendJson(res, status, error, origin);
      return;
    }

    // Simple keyword extraction from intent
    const keywords = body.intent
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2);

    const startTime = Date.now();

    const limit = body.limit || 12;
    const offset = body.offset || 0;

    const { total, visible, has_more, datasets } = await searchDatasets({
      keywords,
      limit,
      offset,
    });

    const response: SearchResponse = {
      total,
      visible,
      offset,
      limit,
      has_more,
      datasets,
      facets: {
        organizations: [],
        formats: [],
        recency: [
          { label: 'Last 7 days', count: 0 },
          { label: 'Last 30 days', count: 0 },
          { label: 'Last 90 days', count: 0 },
        ],
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
