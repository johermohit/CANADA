/**
 * POST /api/orchestrate
 * Translate natural language intent into filters and run search
 * This is where the "smart orchestration" happens
 */

import { OrchestrateRequest, OrchestrateResponse, FilterState } from '../src/lib/types';
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

// Simple intent parser (can be replaced with LLM call)
function parseIntent(prompt: string): FilterState {
  const lower = prompt.toLowerCase();

  // Extract keywords
  const keywords = prompt
    .split(/[\s,]+/)
    .filter((w) => w.length > 3 && !['data', 'show', 'find', 'about'].includes(w.toLowerCase()));

  // Detect organizations
  const orgKeywords: { [key: string]: string[] } = {
    environment: ['environment', 'ec', 'enviro', 'climate'],
    health: ['health', 'hc', 'phac', 'disease'],
    transport: ['transport', 'tc', 'rail', 'highway', 'aviation'],
    agriculture: ['agriculture', 'aac', 'crop', 'farm'],
    justice: ['justice', 'rcmp', 'correction'],
  };

  const possibleOrgs: string[] = [];
  for (const [org, keywords] of Object.entries(orgKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      possibleOrgs.push(org);
    }
  }

  // Detect formats
  const formatKeywords: { [key: string]: string[] } = {
    CSV: ['csv', 'spreadsheet', 'table'],
    JSON: ['json', 'api', 'rest'],
    PDF: ['pdf', 'document', 'report'],
    GEOJSON: ['map', 'geojson', 'location', 'geo'],
  };

  const possibleFormats: string[] = [];
  for (const [fmt, keywords] of Object.entries(formatKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      possibleFormats.push(fmt);
    }
  }

  // Detect recency
  let recencyDays: number | undefined;
  if (lower.includes('recent') || lower.includes('new')) {
    recencyDays = 30;
  } else if (lower.includes('old') || lower.includes('historical')) {
    recencyDays = undefined; // No filter
  }

  return {
    keywords,
    organizations: possibleOrgs.length > 0 ? possibleOrgs : undefined,
    formats: possibleFormats.length > 0 ? possibleFormats : undefined,
    recency_days: recencyDays,
  };
}

export default async function handler(req: any, res: any) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  const route = '/api/orchestrate';
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
    logApiInfo({ requestId, route, method: req.method, message: 'orchestrate request received' });
    const body: OrchestrateRequest = parseRequestBody<OrchestrateRequest>(req.body);

    if (!body.prompt || typeof body.prompt !== 'string') {
      const { error, status } = createErrorResponse(
        'INVALID_REQUEST',
        'Missing or invalid prompt field',
        400,
        requestId
      );
      sendJson(res, status, error, origin);
      return;
    }

    const startTime = Date.now();

    // Parse intent into structured filter
    const filters = parseIntent(body.prompt);

    // Execute search with parsed filters
    const { total, datasets } = await searchDatasets({
      keywords: filters.keywords,
      organizations: filters.organizations,
      formats: filters.formats,
      recency_days: filters.recency_days,
      limit: 12,
    });

    const executionTime = Date.now() - startTime;

    const response: OrchestrateResponse = {
      query: filters,
      results: {
        total,
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
      },
      execution_time_ms: executionTime,
    };

    const payload = JSON.stringify(response);

    logApiInfo({
      requestId,
      route,
      method: req.method,
      message: 'orchestrate completed',
      extra: {
        duration_ms: Date.now() - startedAt,
        total,
        datasets: datasets.length,
        payload_bytes: payload.length,
      },
    });

    sendJson(res, 200, response, origin);
    return;
  } catch (error: any) {
    logApiError({
      requestId,
      route,
      method: req.method,
      message: 'orchestrate failed',
      error,
    });
    const { error: errResponse, status } = createErrorResponse(
      'ORCHESTRATE_ERROR',
      getErrorMessage(error) || 'Orchestration failed',
      500,
      requestId
    );
    sendJson(res, status, errResponse, origin);
    return;
  }
}
