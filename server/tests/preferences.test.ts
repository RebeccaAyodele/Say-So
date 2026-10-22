import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { preferenceService } from '../src/services/preference-service.js';

describe('Preferences Route (/v1/preferences)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/v1/preferences');
    expect(res.status).toBe(401);
  });

  it('GET /v1/preferences returns user preferences', async () => {
    vi.spyOn(preferenceService, 'getUserPreferences').mockResolvedValue({
      userId: 'test_user_1',
      defaultTone: 'warm',
      defaultReplyLength: 'short',
      contextWindowSize: 20,
      learningMode: 'automatic',
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    });

    const res = await request(app)
      .get('/v1/preferences')
      .set('Authorization', 'Bearer test_user_1');

    expect(res.status).toBe(200);
    expect(res.body.defaultTone).toBe('warm');
    expect(res.body.userId).toBe('test_user_1');
  });

  it('PUT /v1/preferences updates preferences with valid payload', async () => {
    vi.spyOn(preferenceService, 'updateUserPreferences').mockResolvedValue({
      userId: 'test_user_1',
      defaultTone: 'formal',
      defaultReplyLength: 'medium',
      contextWindowSize: 15,
      learningMode: 'hybrid',
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    });

    const res = await request(app)
      .put('/v1/preferences')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        defaultTone: 'formal',
        defaultReplyLength: 'medium',
        contextWindowSize: 15,
        learningMode: 'hybrid',
      });

    expect(res.status).toBe(200);
    expect(res.body.defaultTone).toBe('formal');
    expect(res.body.contextWindowSize).toBe(15);
  });

  it('PUT /v1/preferences returns 400 on invalid payload', async () => {
    const res = await request(app)
      .put('/v1/preferences')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        contextWindowSize: 500, // exceeds max limit (e.g. 50)
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });
});
