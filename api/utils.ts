// Shared API utilities and middleware

import { ApiError } from '../src/lib/types';

export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  requestId: string = generateRequestId()
): { error: ApiError; status: number } {
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

export function logApiInfo(context: {
  requestId: string;
  route: string;
  method?: string;
  message: string;
  extra?: Record<string, unknown>;
}) {
  console.info(JSON.stringify({ level: 'info', ...context, timestamp: new Date().toISOString() }));
}

export function logApiError(context: {
  requestId: string;
  route: string;
  method?: string;
  message: string;
  error?: unknown;
  extra?: Record<string, unknown>;
}) {
  const error = context.error instanceof Error
    ? { name: context.error.name, message: context.error.message, stack: context.error.stack }
    : context.error;

  console.error(
    JSON.stringify({ level: 'error', ...context, error, timestamp: new Date().toISOString() })
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export function validateEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export function corsHeaders(origin?: string) {
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
export function validateObject<T>(
  data: unknown,
  schema: { [K in keyof T]: (v: any) => boolean }
): data is T {
  if (typeof data !== 'object' || data === null) return false;
  for (const [key, validator] of Object.entries(schema) as Array<[
    string,
    (v: any) => boolean
  ]>) {
    if (!validator((data as any)[key])) return false;
  }
  return true;
}
