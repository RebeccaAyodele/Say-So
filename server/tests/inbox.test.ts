import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { candidateService } from '../src/services/candidate-service.js';

describe('Inbox Route (/v1/inbox)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /v1/inbox/sync synchronizes candidate metadata', async () => {
    vi.spyOn(candidateService, 'syncCandidates').mockResolvedValue({
      syncedCount: 2,
      activeCount: 1,
    });

    const res = await request(app)
      .post('/v1/inbox/sync')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        candidates: [
          {
            contactRef: 'contact_1',
            contactName: 'Bob',
            revision: 'rev_1',
            lastMessageDirection: 'incoming',
            lastMessageTimestamp: '2026-10-21T12:00:00.000Z',
            unreadCount: 2,
          },
          {
            contactRef: 'contact_2',
            contactName: 'Charlie',
            revision: 'rev_2',
            lastMessageDirection: 'outgoing',
            lastMessageTimestamp: '2026-10-21T11:00:00.000Z',
            unreadCount: 0,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.syncedCount).toBe(2);
    expect(res.body.activeCount).toBe(1);
  });

  it('GET /v1/inbox/candidates returns active candidates awaiting reply', async () => {
    vi.spyOn(candidateService, 'listActiveCandidates').mockResolvedValue([
      {
        userId: 'test_user_1',
        contactRef: 'contact_1',
        contactName: 'Bob',
        revision: 'rev_1',
        status: 'active',
        lastMessageDirection: 'incoming',
        lastMessageTimestamp: '2026-10-21T12:00:00.000Z',
        unreadCount: 2,
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
      },
    ]);

    const res = await request(app)
      .get('/v1/inbox/candidates')
      .set('Authorization', 'Bearer test_user_1');

    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0].contactRef).toBe('contact_1');
    expect(res.body.candidates[0].status).toBe('active');
  });

  it('POST /v1/inbox/dismiss persists dismissal status for candidate revision', async () => {
    vi.spyOn(candidateService, 'dismissCandidate').mockResolvedValue(true);

    const res = await request(app)
      .post('/v1/inbox/dismiss')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        contactRef: 'contact_1',
        revision: 'rev_1',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.contactRef).toBe('contact_1');
    expect(res.body.status).toBe('dismissed');
  });
});
