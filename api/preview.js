/**
 * POST /api/preview
 * Fetch live preview data from CKAN for supported formats
 */
import { createErrorResponse, corsHeaders, validateEnv } from './utils';
const PREVIEWABLE_FORMATS = ['CSV', 'JSON', 'GEOJSON'];
const CKAN_TIMEOUT_MS = 5000;
async function fetchCKANPreview(resourceId, limit) {
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
            columns: result.fields?.map((f) => f.id) || [],
            row_count: result.total_count || 0,
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
export default async function handler(req) {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders(req.headers.origin) });
    }
    if (req.method !== 'POST') {
        const { error, status } = createErrorResponse('METHOD_NOT_ALLOWED', 'Only POST allowed', 405, requestId);
        return new Response(JSON.stringify(error), { status, headers: corsHeaders(req.headers.origin) });
    }
    try {
        const body = JSON.parse(req.body || '{}');
        const { resource_id, limit = 50 } = body;
        if (!resource_id) {
            const { error, status } = createErrorResponse('INVALID_REQUEST', 'Missing resource_id field', 400, requestId);
            return new Response(JSON.stringify(error), { status, headers: corsHeaders(req.headers.origin) });
        }
        // This would be more complete with direct resource lookup,
        // but for now we trust the resource_id from frontend
        const previewData = await fetchCKANPreview(resource_id, limit);
        const response = {
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
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(req.headers.origin),
            },
        });
    }
    catch (error) {
        if (error.name === 'AbortError') {
            const { error: errResponse, status } = createErrorResponse('PREVIEW_TIMEOUT', 'Preview fetch timed out', 504, requestId);
            return new Response(JSON.stringify(errResponse), {
                status,
                headers: corsHeaders(req.headers.origin),
            });
        }
        // Return graceful fallback
        const response = {
            success: false,
            error: error?.message || 'Preview unavailable',
            fallback_url: 'https://open.canada.ca/data',
        };
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(req.headers.origin),
            },
        });
    }
}
//# sourceMappingURL=preview.js.map