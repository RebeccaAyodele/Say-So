import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@sayso/shared';

export class AppError extends Error {
  constructor(
    public code:
      | 'INVALID_REQUEST'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'RATE_LIMITED'
      | 'MODEL_UNAVAILABLE'
      | 'MODEL_TIMEOUT'
      | 'INVALID_MODEL_OUTPUT'
      | 'DATABASE_ERROR'
      | 'INTERNAL_ERROR',
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ApiErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || undefined;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  console.error('[Error]', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      requestId,
    },
  });
}
