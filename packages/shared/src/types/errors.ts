export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_TIMEOUT'
  | 'INVALID_MODEL_OUTPUT'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}
