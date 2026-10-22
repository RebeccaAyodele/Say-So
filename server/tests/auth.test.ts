import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error-handler.js';

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
});
