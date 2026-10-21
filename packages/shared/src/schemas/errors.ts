import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'MODEL_UNAVAILABLE',
  'MODEL_TIMEOUT',
  'INVALID_MODEL_OUTPUT',
  'DATABASE_ERROR',
  'INTERNAL_ERROR',
]);

export const ApiErrorPayloadSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorPayloadSchema,
});
