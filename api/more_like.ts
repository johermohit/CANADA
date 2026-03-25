import { SearchResponse } from '../src/lib/types';
import { moreLikeDatasets } from './supabase.js';
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
  const route = '/api/more_like';
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
    logApiInfo({ requestId, route, method: req.method, message: 'more_like request received' });
    const body = parseRequestBody<any>(req.body);

    const datasetId = body.id || body.dataset_id;
    if (!datasetId) {
      const { error, status } = createErrorResponse('INVALID_REQUEST', 'Missing dataset id', 400, requestId);
      sendJson(res, status, error, origin);
      return;
    }

    const limit = body.limit || 12;
    const offset = body.offset || 0;

    const results = await moreLikeDatasets(datasetId, limit, offset);

    const response: SearchResponse = {
      total: results.total,
      visible: results.visible,
      offset: results.offset,
      limit: results.limit,
      has_more: results.has_more,
      datasets: results.datasets,
      facets: {
        organizations: [],
        jurisdictions: [],
        subjects: [],
        formats: [],
        frequencies: [],
        collection_types: [],
        resource_types: [],
        languages: [],
        keywords: [],
        recency: [],
      },
    };

    sendJson(res, 200, response, origin);
    return;
  } catch (error: any) {
    logApiError({ requestId, route, method: req.method, message: 'more_like failed', error });
    const { error: errResponse, status } = createErrorResponse('MORE_LIKE_ERROR', getErrorMessage(error) || 'MoreLike failed', 500, requestId);
    sendJson(res, status, errResponse, origin);
    return;
  }
}
