/**
 * POST /api/preview
 * Fetch live preview data from CKAN for supported formats
 */

import { PreviewRequest, PreviewResponse } from '../src/lib/types';
import { getSupabaseClient } from './supabase.js';
import {
  createErrorResponse,
  getErrorMessage,
  logApiError,
  logApiInfo,
  parseRequestBody,
  sendJson,
  sendOptions,
  validateEnv,
} from './utils.js';

const PREVIEWABLE_FORMATS = ['CSV', 'JSON', 'GEOJSON'];
const CKAN_TIMEOUT_MS = 5000;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractResourceUuidFromUrl(url: string): string | null {
  const match = (url || '').match(/\/resource\/([0-9a-fA-F-]{36})\b/);
  return match?.[1] || null;
}

async function resolvePreviewResource(resourceId: string) {
  if (isUuid(resourceId)) {
    return {
      ckanResourceId: resourceId,
      resourceMeta: {
        id: resourceId,
        name: 'Resource',
        format: 'UNKNOWN',
        url: '',
      },
    };
  }

  const client = getSupabaseClient();
  const columns = '_link, id, name, format, url';

  let resourceLookup = await client
    .from('resources')
    .select(columns)
    .eq('_link', resourceId)
    .limit(1)
    .maybeSingle();

  if (!resourceLookup.data && !resourceLookup.error) {
    resourceLookup = await client
      .from('resources')
      .select(columns)
      .eq('id', resourceId)
      .limit(1)
      .maybeSingle();
  }

  if (resourceLookup.error) {
    throw new Error(`Supabase resource lookup failed: ${resourceLookup.error.message}`);
  }

  const row = resourceLookup.data as
    | { _link?: string; id?: string; name?: string; format?: string; url?: string }
    | null;

  if (!row) {
    throw new Error('Resource not found in metadata store');
  }

  const ckanResourceId = extractResourceUuidFromUrl(row.url || '');
  if (!ckanResourceId) {
    throw new Error('Resource does not include a CKAN resource UUID in URL');
  }

  return {
    ckanResourceId,
    resourceMeta: {
      id: row._link || row.id || resourceId,
      name: row.name || 'Resource',
      format: (row.format || 'UNKNOWN').toUpperCase(),
      url: row.url || '',
    },
  };
}

async function fetchCKANPreview(resourceId: string, limit: number) {
  const ckanUrl = validateEnv('CKAN_API_URL');
  const url = `${ckanUrl}/action/datastore_search?resource_id=${resourceId}&limit=${limit}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CKAN_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`CKAN datastore_search returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('CKAN datastore not available for this resource');
    }

    const result = data.result;
    return {
      rows: result.records || [],
      columns: result.fields?.map((f: any) => f.id) || [],
      row_count: result.total_count || 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: any, res: any) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  const route = '/api/preview';
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
    logApiInfo({ requestId, route, method: req.method, message: 'preview request received' });
    const body: PreviewRequest = parseRequestBody<PreviewRequest>(req.body);
    const { resource_id, limit = 50 } = body;

    if (!resource_id) {
      const { error, status } = createErrorResponse(
        'INVALID_REQUEST',
        'Missing resource_id field',
        400,
        requestId
      );
      sendJson(res, status, error, origin);
      return;
    }

    const resolved = await resolvePreviewResource(resource_id);
    const previewData = await fetchCKANPreview(resolved.ckanResourceId, limit);

    const response: PreviewResponse = {
      success: true,
      preview: {
        resource: resolved.resourceMeta,
        rows: previewData.rows,
        columns: previewData.columns,
        row_count: previewData.row_count,
      },
    };

    logApiInfo({
      requestId,
      route,
      method: req.method,
      message: 'preview completed',
      extra: {
        duration_ms: Date.now() - startedAt,
        resource_id,
        resolved_ckan_resource_id: resolved.ckanResourceId,
        limit,
      },
    });

    sendJson(res, 200, response, origin);
    return;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logApiError({
        requestId,
        route,
        method: req.method,
        message: 'preview timed out',
        error,
      });
      const { error: errResponse, status } = createErrorResponse(
        'PREVIEW_TIMEOUT',
        'Preview fetch timed out',
        504,
        requestId
      );
      sendJson(res, status, errResponse, origin);
      return;
    }

    // Return graceful fallback
    logApiError({
      requestId,
      route,
      method: req.method,
      message: 'preview fallback used',
      error,
    });
    const response: PreviewResponse = {
      success: false,
      error: getErrorMessage(error) || 'Preview unavailable',
      fallback_url: 'https://open.canada.ca/data',
    };

    sendJson(res, 200, response, origin);
    return;
  }
}
