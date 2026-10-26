import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { gemmaService } from '../src/services/gemma-service.js';
import { learningService } from '../src/services/learning-service.js';
import { LearningEventModel } from '../src/db/models/index.js';

describe('Replies Route (/v1/replies)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests to /generate', async () => {
    const res = await request(app).post('/v1/replies/generate').send({});
    expect(res.status).toBe(401);
  });

  it('rejects requests with empty context messages', async () => {
    const res = await request(app)
      .post('/v1/replies/generate')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        contactRef: 'contact_123',
        context: { messages: [] },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST /v1/replies/generate returns 3 validated reply options', async () => {
    vi.spyOn(gemmaService, 'generateReplies').mockResolvedValue({
      requestId: 'req_test_123',
      options: [
        { id: 'opt_1', style: 'brief', text: "I'll let you know." },
        { id: 'opt_2', style: 'warm', text: "No wahala, I'll let you know 😊" },
        { id: 'opt_3', style: 'direct', text: "Sure, I'll confirm and get back to you." },
      ],
      model: {
        provider: 'openrouter',
        modelId: 'google/gemma-3-12b-it',
      },
    });

    const res = await request(app)
      .post('/v1/replies/generate')
      .set('Authorization', 'Bearer test_user_generation')
      .send({
        contactRef: 'contact_123',
        context: {
          activeContactName: 'Bisi',
          messages: [{ role: 'them', text: 'Can you send me the details today?' }],
        },
        instructions: 'Keep it natural and concise.',
      });

    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe('req_test_123');
    expect(res.body.options).toHaveLength(3);
    expect(res.body.options[0].style).toBe('brief');
    expect(res.body.options[1].style).toBe('warm');
    expect(res.body.options[2].style).toBe('direct');
    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(res.headers['x-ratelimit-remaining']).toBe('9');
  });

  it('limits repeated reply generation for the same authenticated user', async () => {
    vi.spyOn(gemmaService, 'generateReplies').mockResolvedValue({
      requestId: 'req_rate_limit',
      options: [
        { id: 'opt_1', style: 'brief', text: 'Sure.' },
        { id: 'opt_2', style: 'warm', text: 'Absolutely.' },
        { id: 'opt_3', style: 'direct', text: 'Will do.' },
      ],
      model: { provider: 'test', modelId: 'test' },
    });

    const body = {
      contactRef: 'contact_rate_limit',
      context: { messages: [{ role: 'them', text: 'Hello' }] },
    };

    for (let i = 0; i < 10; i += 1) {
      const allowed = await request(app)
        .post('/v1/replies/generate')
        .set('Authorization', 'Bearer test_user_rate_limit')
        .send(body);
      expect(allowed.status).toBe(200);
    }

    const limited = await request(app)
      .post('/v1/replies/generate')
      .set('Authorization', 'Bearer test_user_rate_limit')
      .send(body);

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toMatch(/^[1-9]\d*$/);
    expect(limited.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('POST /v1/replies/feedback records draft card interactions', async () => {
    const res = await request(app)
      .post('/v1/replies/feedback')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        requestId: 'req_test_123',
        optionId: 'opt_2',
        feedbackType: 'selected',
        contactRef: 'contact_123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.eventId).toBeDefined();
  });

  it('POST /v1/replies/feedback records insertion without duplicating learning', async () => {
    const learnSpy = vi.spyOn(learningService, 'processConfirmedDraftEdit').mockResolvedValue({
      eventId: 'evt_learn_1',
      signalsIdentified: 1,
      profileUpdated: true,
      signals: [],
    });

    const res = await request(app)
      .post('/v1/replies/feedback')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        requestId: 'req_test_123',
        optionId: 'opt_2',
        feedbackType: 'inserted',
        confirmedDraft: 'No wahala bro, will get back to you shortly!',
        contactRef: 'contact_123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(learnSpy).not.toHaveBeenCalled();
  });

  it('POST /v1/replies/confirm-draft directly processes draft edits', async () => {
    const learnSpy = vi.spyOn(learningService, 'processConfirmedDraftEdit').mockResolvedValue({
      eventId: 'evt_direct_1',
      signalsIdentified: 2,
      profileUpdated: true,
      signals: [],
    });

    const res = await request(app)
      .post('/v1/replies/confirm-draft')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        eventId: 'evt_direct_1',
        contactRef: 'contact_123',
        originalOption: { id: 'opt_1', style: 'brief', text: 'Sure.' },
        confirmedDraft: 'No wahala, sure thing!',
      });

    expect(res.status).toBe(200);
    expect(res.body.profileUpdated).toBe(true);
    expect(res.body.signalsIdentified).toBe(2);
    expect(learnSpy).toHaveBeenCalledWith(
      'test_user_1',
      expect.objectContaining({
        eventId: 'evt_direct_1',
        confirmedDraft: 'No wahala, sure thing!',
      })
    );
  });
});
