import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { AppError, errorHandler } from '../src/middleware/error-handler.js';

function createErrorTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/app-error', () => {
    throw new AppError('NOT_FOUND', 'Custom resource not found', 404, { id: 'item_123' });
  });

  app.post('/zod-error', (req: Request, res: Response) => {
    const TestSchema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });
    const parsed = TestSchema.parse(req.body);
    res.status(200).json(parsed);
  });

  app.get('/unhandled-error', () => {
    throw new Error('Database crash occurred');
  });

  app.use(errorHandler);
  return app;
}

describe('Standard Error Handler', () => {
  const app = createErrorTestApp();

  it('handles AppError with custom code and statusCode', async () => {
    const res = await request(app).get('/app-error');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Custom resource not found');
    expect(res.body.error.details).toEqual({ id: 'item_123' });
  });

  it('formats ZodError with INVALID_REQUEST and issue details', async () => {
    const res = await request(app)
      .post('/zod-error')
      .send({ name: 'a' }); // missing age, name too short

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  it('handles unexpected exceptions with INTERNAL_ERROR', async () => {
    const res = await request(app).get('/unhandled-error');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Database crash occurred');
  });
});
