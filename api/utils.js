// Shared API utilities and middleware
export function createErrorResponse(code, message, status = 400, requestId = generateRequestId()) {
    return {
        error: {
            code,
            message,
            request_id: requestId,
            timestamp: new Date().toISOString(),
        },
        status,
    };
}
export function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
export function validateEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}
export function corsHeaders(origin) {
    const allowedOrigins = (process.env.APP_ORIGIN || 'http://localhost:5173').split(',');
    const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}
// Zod-like schema validation (lightweight alternative)
export function validateObject(data, schema) {
    if (typeof data !== 'object' || data === null)
        return false;
    for (const [key, validator] of Object.entries(schema)) {
        if (!validator(data[key]))
            return false;
    }
    return true;
}
//# sourceMappingURL=utils.js.map