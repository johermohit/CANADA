/**
 * POST /api/preview
 * Fetch live preview data from CKAN for supported formats
 */

import { PreviewRequest, PreviewResponse } from '../src/lib/types';
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

async function fetchCKANPreview(resourceId: string, limit: number) {
  const ckanUrl = validateEnv('CKAN_API_URL');
  const url = `${ckanUrl}/action/datastore_search?resource_id=${resourceId}&limit=${limit}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CKAN_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`CKAN API returned ${response.status}`);
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

    // This would be more complete with direct resource lookup,
    // but for now we trust the resource_id from frontend
    const previewData = await fetchCKANPreview(resource_id, limit);

    const response: PreviewResponse = {
      success: true,
      preview: {
        resource: {
          id: resource_id,
          name: 'Resource',
          format: 'CSV',
          url: '',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          package_id: '',
        },
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
      extra: { duration_ms: Date.now() - startedAt, resource_id, limit },
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
