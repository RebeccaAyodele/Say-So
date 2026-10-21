import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header with Bearer token',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  // Support simplified test tokens in non-production environments
  if (config.NODE_ENV !== 'production' && (token.startsWith('test_user_') || token === 'mock_token')) {
    req.userId = token.startsWith('test_user_') ? token : 'test_user_default';
    req.userEmail = `${req.userId}@example.com`;
    next();
    return;
  }

  // Verify JWT token with Supabase JWT secret
  if (config.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, config.SUPABASE_JWT_SECRET) as { sub?: string; email?: string };
      if (!decoded.sub) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token payload: missing sub claim',
          },
        });
        return;
      }
      req.userId = decoded.sub;
      req.userEmail = decoded.email;
      next();
      return;
    } catch (err) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          details: err instanceof Error ? err.message : undefined,
        },
      });
      return;
    }
  }

  // Fallback when Supabase JWT secret is not configured in dev
  try {
    const decoded = jwt.decode(token) as { sub?: string; email?: string } | null;
    if (decoded?.sub) {
      req.userId = decoded.sub;
      req.userEmail = decoded.email;
      next();
      return;
    }
  } catch {
    // ignore
  }

  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication failed: unable to verify token',
    },
  });
}
