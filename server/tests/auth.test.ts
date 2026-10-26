import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';

function createAuthTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/protected', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      message: 'Access granted',
      userId: req.userId,
      userEmail: req.userEmail,
    });
  });

  app.use(errorHandler);
  return app;
}

describe('requireAuth Middleware', () => {
  const app = createAuthTestApp();

  it('rejects requests with missing Authorization header', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('Missing or malformed Authorization header');
  });

  it('rejects requests with non-Bearer Authorization header', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts dev/test token in non-production environment', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer test_user_456');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('test_user_456');
    expect(res.body.userEmail).toBe('test_user_456@example.com');
  });

  it('accepts mock_token in non-production environment', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer mock_token');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('test_user_default');
  });

  it('requires a verified Supabase JWT with the authenticated audience', async () => {
    const originalEnv = config.NODE_ENV;
    const originalSecret = config.SUPABASE_JWT_SECRET;
    const originalUrl = config.SUPABASE_URL;
    (config as Record<string, unknown>).NODE_ENV = 'production';
    (config as Record<string, unknown>).SUPABASE_JWT_SECRET = 'test-secret';
    (config as Record<string, unknown>).SUPABASE_URL = 'https://example.supabase.co';
    const valid = jwt.sign(
      { sub: 'user_1', email: 'user@example.com', aud: 'authenticated' },
      'test-secret',
      { issuer: 'https://example.supabase.co/auth/v1', expiresIn: '1h' },
    );
    try {
      const accepted = await request(app).get('/protected').set('Authorization', `Bearer ${valid}`);
      expect(accepted.status).toBe(200);

      const wrongAudience = jwt.sign({ sub: 'user_1', aud: 'wrong' }, 'test-secret', {
        issuer: 'https://example.supabase.co/auth/v1', expiresIn: '1h',
      });
      const rejected = await request(app).get('/protected').set('Authorization', `Bearer ${wrongAudience}`);
      expect(rejected.status).toBe(401);
    } finally {
      (config as Record<string, unknown>).NODE_ENV = originalEnv;
      (config as Record<string, unknown>).SUPABASE_JWT_SECRET = originalSecret;
      (config as Record<string, unknown>).SUPABASE_URL = originalUrl;
    }
  });
});
