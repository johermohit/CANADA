import { ApiError } from '../src/lib/types';
export declare function createErrorResponse(code: string, message: string, status?: number, requestId?: string): {
    error: ApiError;
    status: number;
};
export declare function generateRequestId(): string;
export declare function validateEnv(key: string): string;
export declare function corsHeaders(origin?: string): {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Max-Age': string;
};
export declare function validateObject<T>(data: unknown, schema: {
    [K in keyof T]: (v: any) => boolean;
}): data is T;
//# sourceMappingURL=utils.d.ts.map