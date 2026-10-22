import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { gemmaService } from '../src/services/gemma-service.js';
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
        modelId: 'google/gemma-2-9b-it',
      },
    });

    const res = await request(app)
      .post('/v1/replies/generate')
      .set('Authorization', 'Bearer test_user_1')
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
  });

  it('POST /v1/replies/feedback records draft card interactions', async () => {
    const createSpy = vi.spyOn(LearningEventModel, 'create').mockResolvedValue({} as any);

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
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test_user_1',
        eventType: 'selected',
        originalDraft: 'opt_2',
      })
    );
  });

  it('POST /v1/replies/feedback stores confirmed draft edits for learning engine', async () => {
    const createSpy = vi.spyOn(LearningEventModel, 'create').mockResolvedValue({} as any);

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
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test_user_1',
        eventType: 'inserted',
        finalDraft: 'No wahala bro, will get back to you shortly!',
        diffSummary: 'draft_confirmed',
      })
    );
  });
});
