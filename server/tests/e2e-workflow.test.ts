import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { gemmaService } from '../src/services/gemma-service.js';
import { learningService } from '../src/services/learning-service.js';
import { profileService } from '../src/services/profile-service.js';
import { candidateService } from '../src/services/candidate-service.js';

describe('End-to-End Workflow & Integration Suite', () => {
  const app = createApp();
  const testUserId = 'test_user_e2e';
  const testAuthHeader = `Bearer ${testUserId}`;
  const testContactRef = 'wa:sarah_connor';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('executes full assistant lifecycle: generate -> edit & confirm draft -> profile update -> inbox dismiss', async () => {
    // ─── Step 1: Generate Replies (Tri-Layer Context) ──────────────
    const mockReplyResponse = {
      requestId: 'req_e2e_123',
      contactRef: testContactRef,
      options: [
        { id: 'opt_brief', style: 'brief' as const, text: "Can't make it today. Will call tomorrow." },
        { id: 'opt_warm', style: 'warm' as const, text: "Hey Sarah! So sorry but I won't be able to make it today. Let's catch up tomorrow!" },
        { id: 'opt_direct', style: 'direct' as const, text: "I have a conflict today and won't be able to attend. I will follow up tomorrow." },
      ],
      model: 'google/gemma-3-12b-it',
    };

    vi.spyOn(gemmaService, 'generateReplies').mockResolvedValue(mockReplyResponse);

    const generateRes = await request(app)
      .post('/v1/replies/generate')
      .set('Authorization', testAuthHeader)
      .send({
        contactRef: testContactRef,
        context: {
          activeContactName: 'Sarah Connor',
          messages: [
            { role: 'them', text: 'Hey, are we still meeting up today at 3pm?', timestamp: '14:20' },
          ],
        },
      });

    expect(generateRes.status).toBe(200);
    expect(generateRes.body.options).toHaveLength(3);
    expect(generateRes.body.options.map((o: { style: string }) => o.style)).toEqual(['brief', 'warm', 'direct']);

    // ─── Step 2: Confirm Edited Draft (Deterministic Learning) ─────
    const chosenOption = generateRes.body.options[1]; // warm
    const userEditedDraft = "Hey Sarah! So sorry, won't make it today. Cheers!";

    vi.spyOn(learningService, 'processConfirmedDraftEdit').mockResolvedValue({
      eventId: 'evt_e2e_456',
      signalsIdentified: 2,
      profileUpdated: true,
      signals: [
        {
          trait: 'greeting_habit',
          value: 'Cheers!',
          confidence: 'medium',
          evidenceCount: 3,
          firstObserved: '2026-10-21T00:00:00Z',
          lastObserved: '2026-10-22T00:00:00Z',
        },
      ],
    });

    const confirmRes = await request(app)
      .post('/v1/replies/confirm-draft')
      .set('Authorization', testAuthHeader)
      .send({
        eventId: 'evt_e2e_456',
        contactRef: testContactRef,
        originalOption: {
          id: chosenOption.id,
          style: chosenOption.style,
          text: chosenOption.text,
        },
        confirmedDraft: userEditedDraft,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.profileUpdated).toBe(true);
    expect(confirmRes.body.signalsIdentified).toBe(2);

    // ─── Step 3: Verify Profile Learned State ─────────────────────
    vi.spyOn(profileService, 'getContactProfile').mockResolvedValue({
      userId: testUserId,
      contactRef: testContactRef,
      formalityScore: 0.35,
      preferredLength: 'concise',
      inferredTone: 'warm',
      explicitOverrides: { tone: 'warm' },
      styleSignals: [
        {
          trait: 'greeting_habit',
          value: 'Cheers!',
          confidence: 'medium',
          evidenceCount: 3,
          firstObserved: '2026-10-21T00:00:00Z',
          lastObserved: '2026-10-22T00:00:00Z',
        },
      ],
      updatedAt: '2026-10-22T00:00:00Z',
    });

    const profileRes = await request(app)
      .get(`/v1/contacts/${encodeURIComponent(testContactRef)}/profile`)
      .set('Authorization', testAuthHeader);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.inferredTone).toBe('warm');
    expect(profileRes.body.styleSignals[0].value).toBe('Cheers!');

    // ─── Step 4: Sync & Dismiss Candidate in Inbox ────────────────
    vi.spyOn(candidateService, 'syncCandidates').mockResolvedValue({
      syncedCount: 1,
      activeCount: 1,
    });

    const syncRes = await request(app)
      .post('/v1/inbox/sync')
      .set('Authorization', testAuthHeader)
      .send({
        candidates: [
          {
            contactRef: testContactRef,
            contactName: 'Sarah Connor',
            revision: 'rev_sarah_1',
            lastMessageDirection: 'incoming',
            lastMessageTimestamp: '14:20',
            unreadCount: 1,
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.syncedCount).toBe(1);

    // Dismiss candidate
    vi.spyOn(candidateService, 'dismissCandidate').mockResolvedValue(true);

    const dismissRes = await request(app)
      .post('/v1/inbox/dismiss')
      .set('Authorization', testAuthHeader)
      .send({
        contactRef: testContactRef,
        revision: 'rev_sarah_1',
      });

    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body.success).toBe(true);
    expect(dismissRes.body.status).toBe('dismissed');
  });
});
