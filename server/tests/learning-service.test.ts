import { describe, it, expect, vi, beforeEach } from 'vitest';
import { learningService } from '../src/services/learning-service.js';
import { profileService } from '../src/services/profile-service.js';
import {
  UserProfileModel,
  ContactProfileModel,
  LearningEventModel,
} from '../src/db/models/index.js';
import type { ProcessLearningEventRequest, UserStyleProfile } from '@sayso/shared';

describe('LearningService (Phase 4 Deterministic Engine)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseUserProfile: UserStyleProfile = {
    userId: 'user_test_1',
    styleSignals: [],
    explicitPreferences: {},
    learningMode: 'automatic',
    learningEnabled: true,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
    schemaVersion: 1,
  };

  it('rejects unchanged suggestions without creating style signals (prevents synthetic feedback loop)', async () => {
    vi.spyOn(LearningEventModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(profileService, 'getUserProfile').mockResolvedValue(baseUserProfile);
    const recordSpy = vi.spyOn(LearningEventModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const req: ProcessLearningEventRequest = {
      eventId: 'evt_1',
      originalOption: { id: 'opt_1', style: 'brief', text: "I'll let you know." },
      confirmedDraft: "I'll let you know.",
    };

    const res = await learningService.processConfirmedDraftEdit('user_test_1', req);

    expect(res.signalsIdentified).toBe(0);
    expect(res.profileUpdated).toBe(false);
    expect(res.signals).toHaveLength(0);
    expect(recordSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ processingStatus: 'no_signals' }),
      expect.anything()
    );
  });

  it('filters out factual entities (dates, times, urls, phone numbers) from style signals', () => {
    const raw = 'Let us meet on Friday at 4pm via https://zoom.us/j/12345 or call +2348012345678, no wahala';
    const stripped = learningService.stripFactualEntities(raw);

    expect(stripped).not.toContain('Friday');
    expect(stripped).not.toContain('4pm');
    expect(stripped).not.toContain('https://zoom.us');
    expect(stripped).not.toContain('+2348012345678');
    expect(stripped).toContain('no wahala');
  });

  it('extracts emoji preference when user adds emojis to an emoji-free suggestion', () => {
    const orig = 'I will send the file soon.';
    const conf = 'I will send the file soon 😊';

    const signals = learningService.extractStyleSignals(orig, conf);

    const emojiSig = signals.find((s) => s.category === 'emoji');
    expect(emojiSig).toBeDefined();
    expect(emojiSig?.pattern).toBe('😊');
    expect(emojiSig?.tendency).toBe('preferred');
    expect(emojiSig?.confidence).toBe('low');
  });

  it('extracts greeting habits when user customizes greeting', () => {
    const orig = 'Can you confirm the details?';
    const conf = 'How far, can you confirm the details?';

    const signals = learningService.extractStyleSignals(orig, conf);

    const greetingSig = signals.find((s) => s.category === 'greetings');
    expect(greetingSig).toBeDefined();
    expect(greetingSig?.pattern).toBe('how far');
    expect(greetingSig?.tendency).toBe('preferred');
  });

  it('extracts Nigerian Pidgin and colloquial markers', () => {
    const orig = 'That is not a problem at all.';
    const conf = 'No wahala, that is not a problem at all.';

    const signals = learningService.extractStyleSignals(orig, conf);

    const slangSig = signals.find((s) => s.category === 'slang');
    expect(slangSig).toBeDefined();
    expect(slangSig?.pattern).toBe('no wahala');
    expect(slangSig?.tendency).toBe('preferred');
  });

  it('detects conciseness when user significantly shortens the draft', () => {
    const orig = 'I was just wondering if you might perhaps have a moment to talk about the project today.';
    const conf = 'Are you free today?';

    const signals = learningService.extractStyleSignals(orig, conf);

    const lengthSig = signals.find((s) => s.category === 'sentence_length');
    expect(lengthSig).toBeDefined();
    expect(lengthSig?.pattern).toBe('concise');
  });

  it('increments evidenceCount and promotes confidence from low to medium to high across observations', async () => {
    const mockSave = vi.fn().mockResolvedValue({});
    const mockProfileDoc: any = {
      userId: 'user_test_1',
      styleSignals: [
        {
          id: 'sig_existing',
          category: 'slang',
          pattern: 'no wahala',
          scope: 'general',
          tendency: 'preferred',
          confidence: 'low',
          evidenceCount: 1,
          source: 'confirmed_draft_edit',
          lastObservedAt: '2026-10-21T00:00:00.000Z',
          overrideStatus: false,
        },
      ],
      save: mockSave,
    };

    vi.spyOn(UserProfileModel, 'findOne').mockResolvedValue(mockProfileDoc);

    // 2nd observation -> promotes to medium
    await learningService.applySignalsToUserProfile('user_test_1', [
      {
        id: 'new_sig',
        category: 'slang',
        pattern: 'no wahala',
        scope: 'general',
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: '2026-10-22T00:00:00.000Z',
        overrideStatus: false,
      },
    ]);

    expect(mockProfileDoc.styleSignals[0].evidenceCount).toBe(2);
    expect(mockProfileDoc.styleSignals[0].confidence).toBe('medium');

    // 4th observation -> promotes to high
    mockProfileDoc.styleSignals[0].evidenceCount = 3;
    await learningService.applySignalsToUserProfile('user_test_1', [
      {
        id: 'new_sig_4',
        category: 'slang',
        pattern: 'no wahala',
        scope: 'general',
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: '2026-10-22T00:00:00.000Z',
        overrideStatus: false,
      },
    ]);

    expect(mockProfileDoc.styleSignals[0].evidenceCount).toBe(4);
    expect(mockProfileDoc.styleSignals[0].confidence).toBe('high');
  });

  it('never overwrites explicit user overrides with inferred tendencies', async () => {
    const mockSave = vi.fn().mockResolvedValue({});
    const mockProfileDoc: any = {
      userId: 'user_test_1',
      styleSignals: [
        {
          id: 'sig_override',
          category: 'emoji',
          pattern: '😊',
          scope: 'general',
          tendency: 'avoided', // User explicitly turned emojis off
          confidence: 'high',
          evidenceCount: 10,
          source: 'explicit_preference',
          lastObservedAt: '2026-10-21T00:00:00.000Z',
          overrideStatus: true, // EXPLICIT OVERRIDE
        },
      ],
      save: mockSave,
    };

    vi.spyOn(UserProfileModel, 'findOne').mockResolvedValue(mockProfileDoc);

    // User happened to leave an emoji in a draft once
    await learningService.applySignalsToUserProfile('user_test_1', [
      {
        id: 'sig_inferred',
        category: 'emoji',
        pattern: '😊',
        scope: 'general',
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: '2026-10-22T00:00:00.000Z',
        overrideStatus: false,
      },
    ]);

    // Overridden trait MUST remain avoided with overrideStatus true
    expect(mockProfileDoc.styleSignals[0].tendency).toBe('avoided');
    expect(mockProfileDoc.styleSignals[0].overrideStatus).toBe(true);
  });

  it('disables automatic style learning when learningMode is manual', async () => {
    vi.spyOn(LearningEventModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(profileService, 'getUserProfile').mockResolvedValue({
      ...baseUserProfile,
      learningMode: 'manual',
    });
    const recordSpy = vi.spyOn(LearningEventModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const req: ProcessLearningEventRequest = {
      eventId: 'evt_manual',
      originalOption: { id: 'opt_1', style: 'brief', text: 'Okay' },
      confirmedDraft: 'No wahala bro, let us talk later! 😊',
    };

    const res = await learningService.processConfirmedDraftEdit('user_test_1', req);

    expect(res.signalsIdentified).toBe(0);
    expect(res.profileUpdated).toBe(false);
    expect(recordSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ processingStatus: 'rejected' }),
      expect.anything()
    );
  });

  it('guarantees idempotency on duplicate event processing', async () => {
    vi.spyOn(LearningEventModel, 'findOne').mockResolvedValue({
      userId: 'user_test_1',
      eventId: 'evt_dup',
      processingStatus: 'processed',
      signalsExtracted: [{ category: 'slang', pattern: 'no wahala' }],
    } as any);

    const req: ProcessLearningEventRequest = {
      eventId: 'evt_dup',
      originalOption: { id: 'opt_1', style: 'brief', text: 'Okay' },
      confirmedDraft: 'No wahala bro!',
    };

    const res = await learningService.processConfirmedDraftEdit('user_test_1', req);

    expect(res.eventId).toBe('evt_dup');
    expect(res.profileUpdated).toBe(false); // Did not re-process or increment count
  });
});
