import { randomUUID } from 'node:crypto';
import {
  UserProfileModel,
  ContactProfileModel,
  LearningEventModel,
} from '../db/models/index.js';
import { profileService } from './profile-service.js';
import {
  ProcessLearningEventRequest,
  ProcessLearningEventResponse,
  StyleSignal,
  SignalCategory,
} from '@sayso/shared';

// Common Nigerian Pidgin & regional slang expressions
const PIDGIN_SLANG_PATTERNS = [
  'no wahala',
  'abeg',
  'oya',
  'wetin',
  'dey',
  'na so',
  'abi',
  'jare',
  'biko',
  'sharp',
  'how far',
  'comot',
  'omo',
];

// Common chat greetings
const GREETING_PATTERNS = [
  'hey',
  'hi',
  'hello',
  'good morning',
  'good afternoon',
  'good evening',
  'how far',
  'yo',
  'sup',
];

export class LearningService {
  /**
   * Deterministically processes a confirmed draft edit against the selected suggestion
   */
  async processConfirmedDraftEdit(
    userId: string,
    req: ProcessLearningEventRequest
  ): Promise<ProcessLearningEventResponse> {
    const { eventId, contactRef, originalOption, confirmedDraft } = req;

    // 1. Idempotency Check: Prevent duplicate counting of retried events
    const existingEvent = await LearningEventModel.findOne({ userId, eventId });
    if (existingEvent && existingEvent.processingStatus !== 'pending') {
      return {
        eventId,
        signalsIdentified: existingEvent.signalsExtracted?.length || 0,
        profileUpdated: false,
        signals: (existingEvent.signalsExtracted as StyleSignal[]) || [],
      };
    }

    // 2. Fetch User Profile and verify learning mode
    const userProfile = await profileService.getUserProfile(userId);

    if (!userProfile.learningEnabled || userProfile.learningMode === 'manual') {
      await this.recordEvent(
        userId,
        eventId,
        contactRef,
        'rejected',
        []
      );
      return {
        eventId,
        signalsIdentified: 0,
        profileUpdated: false,
        signals: [],
      };
    }

    // 3. Diff Analysis: Check if draft was accepted unchanged
    // CRITICAL TRD RULE: Accepting an unchanged suggestion MUST NOT be counted as style evidence
    const originalText = (originalOption.text || '').trim();
    const confirmedText = (confirmedDraft || '').trim();

    if (originalText === confirmedText || confirmedText.length === 0) {
      await this.recordEvent(
        userId,
        eventId,
        contactRef,
        'no_signals',
        []
      );
      return {
        eventId,
        signalsIdentified: 0,
        profileUpdated: false,
        signals: [],
      };
    }

    // 4. Extract Candidate Style Signals (with Factual & Entity Filtering)
    const candidateSignals = this.extractStyleSignals(originalText, confirmedText, contactRef);

    if (candidateSignals.length === 0) {
      await this.recordEvent(
        userId,
        eventId,
        contactRef,
        'no_signals',
        []
      );
      return {
        eventId,
        signalsIdentified: 0,
        profileUpdated: false,
        signals: [],
      };
    }

    // 5. Apply Deterministic Confidence Rules & Update Profiles
    const updatedSignals = await this.applySignalsToUserProfile(userId, candidateSignals);

    // 6. Update Contact-Specific Profile if contactRef is provided
    if (contactRef) {
      const confirmedSignals = candidateSignals.map(
        (candidate) => updatedSignals.find((signal) =>
          signal.category === candidate.category &&
          signal.pattern === candidate.pattern &&
          signal.scope === candidate.scope &&
          (signal.context || '') === (candidate.context || ''),
        ) || candidate,
      );
      await this.applySignalsToContactProfile(userId, contactRef, confirmedSignals);
    }

    // 7. Record Processed Event Idempotently in MongoDB
    await this.recordEvent(
      userId,
      eventId,
      contactRef,
      'processed',
      candidateSignals
    );

    return {
      eventId,
      signalsIdentified: candidateSignals.length,
      profileUpdated: true,
      signals: candidateSignals,
    };
  }

  /**
   * Filters out factual entities (dates, times, phone numbers, URLs) and extracts recurring style traits
   */
  extractStyleSignals(
    originalText: string,
    confirmedText: string,
    contactRef?: string
  ): StyleSignal[] {
    const signals: StyleSignal[] = [];
    const now = new Date().toISOString();
    const scope = contactRef ? 'contact' : 'general';

    // Sanitize by removing factual entities before extracting stylistic vocabulary
    const sanitizedConfirmed = this.stripFactualEntities(confirmedText);

    // --- A. Emoji Extraction & Density ---
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const origEmojis = originalText.match(emojiRegex) || [];
    const confEmojis = confirmedText.match(emojiRegex) || [];

    if (confEmojis.length > 0 && origEmojis.length === 0) {
      signals.push({
        id: `sig_${randomUUID().substring(0, 8)}`,
        category: 'emoji',
        pattern: confEmojis[0] || 'emoji', // primary emoji used
        scope,
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: now,
        overrideStatus: false,
      });
    } else if (origEmojis.length > 0 && confEmojis.length === 0) {
      signals.push({
        id: `sig_${randomUUID().substring(0, 8)}`,
        category: 'emoji',
        pattern: 'no_emojis',
        scope,
        tendency: 'avoided',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: now,
        overrideStatus: false,
      });
    }

    // --- B. Greeting Habits ---
    const lowerConfirmed = sanitizedConfirmed.toLowerCase();
    for (const greeting of GREETING_PATTERNS) {
      if (lowerConfirmed.startsWith(greeting)) {
        const lowerOriginal = originalText.toLowerCase();
        if (!lowerOriginal.startsWith(greeting)) {
          signals.push({
            id: `sig_${randomUUID().substring(0, 8)}`,
            category: 'greetings',
            pattern: greeting,
            scope,
            tendency: 'preferred',
            confidence: 'low',
            evidenceCount: 1,
            source: 'confirmed_draft_edit',
            lastObservedAt: now,
            overrideStatus: false,
          });
          break;
        }
      }
    }

    // --- C. Nigerian Pidgin & Slang Markers ---
    for (const slang of PIDGIN_SLANG_PATTERNS) {
      const slangRegex = new RegExp(`\\b${slang}\\b`, 'i');
      if (slangRegex.test(sanitizedConfirmed) && !slangRegex.test(originalText)) {
        signals.push({
          id: `sig_${randomUUID().substring(0, 8)}`,
          category: 'slang',
          pattern: slang,
          scope,
          tendency: 'preferred',
          confidence: 'low',
          evidenceCount: 1,
          source: 'confirmed_draft_edit',
          lastObservedAt: now,
          overrideStatus: false,
        });
      }
    }

    // --- D. Sentence Length & Conciseness ---
    const origWordCount = originalText.split(/\s+/).filter(Boolean).length;
    const confWordCount = confirmedText.split(/\s+/).filter(Boolean).length;

    if (origWordCount >= 6 && confWordCount <= Math.max(3, Math.floor(origWordCount * 0.5))) {
      signals.push({
        id: `sig_${randomUUID().substring(0, 8)}`,
        category: 'sentence_length',
        pattern: 'concise',
        scope,
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: now,
        overrideStatus: false,
      });
    }

    // --- E. Punctuation & Capitalization Quirks ---
    // User drops final period
    if (originalText.endsWith('.') && !confirmedText.endsWith('.') && !confirmedText.endsWith('!') && !confirmedText.endsWith('?')) {
      signals.push({
        id: `sig_${randomUUID().substring(0, 8)}`,
        category: 'punctuation',
        pattern: 'omit_final_period',
        scope,
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: now,
        overrideStatus: false,
      });
    }

    // Lowercase first letter
    const firstChar = confirmedText.charAt(0);
    if (firstChar >= 'a' && firstChar <= 'z' && originalText.charAt(0) >= 'A' && originalText.charAt(0) <= 'Z') {
      signals.push({
        id: `sig_${randomUUID().substring(0, 8)}`,
        category: 'punctuation',
        pattern: 'lowercase_start',
        scope,
        tendency: 'preferred',
        confidence: 'low',
        evidenceCount: 1,
        source: 'confirmed_draft_edit',
        lastObservedAt: now,
        overrideStatus: false,
      });
    }

    if (contactRef) {
      for (const signal of signals) signal.context = contactRef;
    }
    return signals;
  }

  /**
   * Filters out factual/situational items like URLs, emails, phone numbers, times, and dates
   */
  stripFactualEntities(text: string): string {
    return text
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/gi, '')
      // Remove Emails
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      // Remove Phone numbers
      .replace(/\+?[0-9]{7,15}/g, '')
      // Remove specific times (e.g., 3:30pm, 4pm, 11am)
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      // Remove dates and days of week
      .replace(/\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      // Remove currency and numbers
      .replace(/\b\d+(?:\.\d+)?(?:\s*(?:k|naira|dollars|\$|usd|%))?\b/gi, '')
      .trim();
  }

  /**
   * Applies candidate signals to the user's permanent style profile adhering to confidence rules
   */
  async applySignalsToUserProfile(userId: string, newSignals: StyleSignal[]): Promise<StyleSignal[]> {
    const profile = await UserProfileModel.findOne({ userId });
    if (!profile) return [];

    const existingSignals = profile.styleSignals || [];

    for (const candidate of newSignals) {
      const matchIndex = existingSignals.findIndex(
        (signal) =>
          signal.category === candidate.category &&
          signal.pattern === candidate.pattern &&
          signal.scope === candidate.scope &&
          (signal.context || '') === (candidate.context || ''),
      );

      if (matchIndex >= 0) {
        const existing = existingSignals[matchIndex];

        // Never overwrite explicit user overrides
        if (existing.overrideStatus) {
          continue;
        }

        const newCount = (existing.evidenceCount || 1) + 1;
        existing.evidenceCount = newCount;
        existing.lastObservedAt = candidate.lastObservedAt;

        // Tiered confidence rules
        if (newCount >= 4) {
          existing.confidence = 'high';
        } else if (newCount >= 2) {
          existing.confidence = 'medium';
        } else {
          existing.confidence = 'low';
        }
      } else {
        // First observation -> low confidence
        existingSignals.push({
          ...candidate,
          evidenceCount: 1,
          confidence: 'low',
          overrideStatus: false,
        });
      }
    }

    profile.styleSignals = existingSignals;
    await profile.save();
    if (newSignals.some((signal) => signal.scope === 'general')) {
      profileService.invalidateLayeredContextCache(userId);
    } else {
      for (const contactRef of new Set(newSignals.map((signal) => signal.context).filter(Boolean))) {
        profileService.invalidateLayeredContextCache(userId, contactRef);
      }
    }
    return existingSignals;
  }

  /**
   * Updates contact profile greetings, common phrases, and emoji habits
   */
  async applySignalsToContactProfile(
    userId: string,
    contactRef: string,
    signals: StyleSignal[]
  ): Promise<void> {
    const confirmedSignals = signals.filter((signal) => signal.confidence !== 'low');
    if (confirmedSignals.length === 0) return;

    const contactProfile = await ContactProfileModel.findOne({ userId, contactRef });
    if (!contactProfile) return;

    for (const signal of confirmedSignals) {
      if (signal.category === 'greetings' && signal.tendency === 'preferred') {
        const greetings = contactProfile.userToContactStyle?.greetings || [];
        if (!greetings.includes(signal.pattern)) {
          greetings.push(signal.pattern);
          contactProfile.userToContactStyle.greetings = greetings;
        }
      }

      if (signal.category === 'slang' && signal.tendency === 'preferred') {
        const phrases = contactProfile.userToContactStyle?.commonPhrases || [];
        if (!phrases.includes(signal.pattern)) {
          phrases.push(signal.pattern);
          contactProfile.userToContactStyle.commonPhrases = phrases;
        }
      }

    }

    await contactProfile.save();
    profileService.invalidateLayeredContextCache(userId, contactRef);
  }

  /**
   * Records a learning event in MongoDB with status and extracted signals
   */
  private async recordEvent(
    userId: string,
    eventId: string,
    contactRef: string | undefined,
    processingStatus: 'processed' | 'rejected' | 'no_signals',
    signalsExtracted: StyleSignal[]
  ): Promise<void> {
    await LearningEventModel.findOneAndUpdate(
      { userId, eventId },
      {
        userId,
        eventId,
        contactRef,
        eventType: 'confirmed_draft_edit',
        source: 'draft_editor',
        processingStatus,
        signalsExtracted,
      },
      { upsert: true, new: true }
    );
  }
}

export const learningService = new LearningService();
