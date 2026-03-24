/**
 * POST /api/search
 * Fast metadata search using Supabase
 */

import { SearchQuery, SearchResponse } from '../src/lib/types';
import { searchDatasets, getOrganizations, getAvailableFormats } from './supabase';
import { createErrorResponse, corsHeaders, getErrorMessage, logApiError, logApiInfo } from './utils';

export default async function handler(req: any) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  const route = '/api/search';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req.headers.origin) });
  }

  if (req.method !== 'POST') {
    const { error, status } = createErrorResponse('METHOD_NOT_ALLOWED', 'Only POST allowed', 405, requestId);
    return new Response(JSON.stringify(error), { status, headers: corsHeaders(req.headers.origin) });
  }

  try {
    const startedAt = Date.now();
    logApiInfo({ requestId, route, method: req.method, message: 'search request received' });
    const body: SearchQuery = JSON.parse(req.body || '{}');

    if (!body.intent || typeof body.intent !== 'string') {
      const { error, status } = createErrorResponse('INVALID_REQUEST', 'Missing or invalid intent field', 400, requestId);
      return new Response(JSON.stringify(error), { status, headers: corsHeaders(req.headers.origin) });
    }

    // Simple keyword extraction from intent
    const keywords = body.intent
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2);

    const startTime = Date.now();

    const { total, datasets } = await searchDatasets({
      keywords,
      limit: body.limit || 20,
      offset: body.offset || 0,
    });

    // Fetch facet data for filters
    const [organizations, formats] = await Promise.all([
      getOrganizations(),
      getAvailableFormats(),
    ]);

    const response: SearchResponse = {
      total,
      datasets,
      facets: {
        organizations,
        formats,
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
      extra: { duration_ms: Date.now() - startedAt, total, datasets: datasets.length },
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(req.headers.origin),
      },
    });
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
    return new Response(JSON.stringify(errResponse), { status, headers: corsHeaders(req.headers.origin) });
  }
}
