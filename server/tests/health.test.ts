import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as dbConnection from '../src/db/connection.js';

describe('GET /v1/health', () => {
  it('returns ok status when database is connected', async () => {
    vi.spyOn(dbConnection, 'isDatabaseConnected').mockReturnValue(true);

    const app = createApp();
    const res = await request(app).get('/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('sayso-api');
    expect(res.body.checks.database).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns degraded status when database is disconnected', async () => {
    vi.spyOn(dbConnection, 'isDatabaseConnected').mockReturnValue(false);

    const app = createApp();
    const res = await request(app).get('/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toBe('disconnected');
  });
});
