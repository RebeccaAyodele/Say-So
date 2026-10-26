import {
  UserProfileModel,
  ContactProfileModel,
} from '../db/models/index.js';
import type {
  UserStyleProfile,
  ContactProfile,
  UpdateContactProfileRequest,
} from '@sayso/shared';

export class ProfileService {
  private readonly layeredContextCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<ProfileService['getLayeredStyleContext']>> }>();

  async getUserProfile(userId: string): Promise<UserStyleProfile> {
    let profile = await UserProfileModel.findOne({ userId });

    if (!profile) {
      profile = await UserProfileModel.create({
        userId,
        styleSignals: [],
        explicitPreferences: {},
        learningMode: 'automatic',
        learningEnabled: true,
        schemaVersion: 1,
      });
    }

    return profile.toObject() as unknown as UserStyleProfile;
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserStyleProfile>
  ): Promise<UserStyleProfile> {
    const updated = await UserProfileModel.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );
    this.invalidateLayeredContextCache(userId);
    return updated.toObject() as unknown as UserStyleProfile;
  }

  invalidateLayeredContextCache(userId: string, contactRef?: string): void {
    if (contactRef) {
      this.layeredContextCache.delete(`${userId}:${contactRef}`);
      return;
    }
    for (const key of this.layeredContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) this.layeredContextCache.delete(key);
    }
  }

  async getContactProfile(
    userId: string,
    contactRef: string
  ): Promise<ContactProfile | null> {
    const profile = await ContactProfileModel.findOne({ userId, contactRef });
    return profile ? (profile.toObject() as unknown as ContactProfile) : null;
  }

  async upsertContactProfile(
    userId: string,
    contactRef: string,
    data: UpdateContactProfileRequest
  ): Promise<ContactProfile> {
    const existing = await ContactProfileModel.findOne({ userId, contactRef });

    if (!existing) {
      const created = await ContactProfileModel.create({
        userId,
        contactRef,
        contactName: data.contactName,
        profileMode: data.profileMode || 'inherited',
        contactStyle: {
          formality: data.contactStyle?.formality || 'casual',
          relationship: data.contactStyle?.relationship,
          preferredTone: data.contactStyle?.preferredTone,
        },
        userToContactStyle: {
          greetings: data.userToContactStyle?.greetings || [],
          commonPhrases: data.userToContactStyle?.commonPhrases || [],
          emojiPreference: data.userToContactStyle?.emojiPreference || 'minimal',
          languagePreference: data.userToContactStyle?.languagePreference,
        },
        userOverrides: data.userOverrides || {},
        schemaVersion: 1,
      });
      this.invalidateLayeredContextCache(userId, contactRef);
      return created.toObject() as unknown as ContactProfile;
    }

    if (data.contactName !== undefined) existing.contactName = data.contactName;
    if (data.profileMode !== undefined) existing.profileMode = data.profileMode;
    if (data.contactStyle) {
      if (data.contactStyle.formality) existing.contactStyle.formality = data.contactStyle.formality;
      if (data.contactStyle.relationship !== undefined) existing.contactStyle.relationship = data.contactStyle.relationship;
      if (data.contactStyle.preferredTone !== undefined) existing.contactStyle.preferredTone = data.contactStyle.preferredTone;
    }
    if (data.userToContactStyle) {
      if (data.userToContactStyle.greetings !== undefined) existing.userToContactStyle.greetings = data.userToContactStyle.greetings;
      if (data.userToContactStyle.commonPhrases !== undefined) existing.userToContactStyle.commonPhrases = data.userToContactStyle.commonPhrases;
      if (data.userToContactStyle.emojiPreference !== undefined) existing.userToContactStyle.emojiPreference = data.userToContactStyle.emojiPreference;
      if (data.userToContactStyle.languagePreference !== undefined) existing.userToContactStyle.languagePreference = data.userToContactStyle.languagePreference;
    }
    if (data.userOverrides !== undefined) {
      existing.userOverrides = { ...existing.userOverrides, ...data.userOverrides };
    }

    const saved = await existing.save();
    this.invalidateLayeredContextCache(userId, contactRef);
    return saved.toObject() as unknown as ContactProfile;
  }

  async deleteContactProfile(userId: string, contactRef: string): Promise<boolean> {
    const result = await ContactProfileModel.deleteOne({ userId, contactRef });
    this.invalidateLayeredContextCache(userId, contactRef);
    return result.deletedCount > 0;
  }

  /**
   * Synthesize general style signals + contact profile overrides into structured guidance
   */
  async getLayeredStyleContext(
    userId: string,
    contactRef: string
  ): Promise<{
    generalStyleSummary: string[];
    contactStyleSummary: string[];
    contactFormality: string;
    contactGreetings: string[];
    contactCommonPhrases: string[];
    contactEmojiPreference: string;
    preferredTone?: string;
    languagePreference?: string;
    relationship?: string;
  }> {
    const cacheKey = `${userId}:${contactRef}`;
    const cached = this.layeredContextCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const [userProfile, contactProfile] = await Promise.all([
      this.getUserProfile(userId),
      this.getContactProfile(userId, contactRef),
    ]);

    const relevantSignals = (userProfile.styleSignals || [])
      .filter((s) => s.confidence !== 'low' && !s.overrideStatus);
    const generalStyleSummary = relevantSignals
      .filter((signal) => signal.scope === 'general')
      .sort((left, right) => (right.lastObservedAt || '').localeCompare(left.lastObservedAt || ''))
      .slice(0, 12)
      .map((s) => `${s.category}: ${s.pattern} (${s.tendency})`);
    const contactSignals = relevantSignals.filter(
      (signal) => signal.scope === 'contact' && signal.context === contactRef,
    ).sort((left, right) => (right.lastObservedAt || '').localeCompare(left.lastObservedAt || '')).slice(0, 12);
    const contactStyleSummary = contactSignals.map(
      (signal) => `${signal.category}: ${signal.pattern} (${signal.tendency}, ${signal.confidence} confidence)`,
    );

    const contactFormality = contactProfile?.contactStyle?.formality || 'casual';
    const contactGreetings = (contactProfile?.userToContactStyle?.greetings || []).slice(0, 6);
    const contactCommonPhrases = (contactProfile?.userToContactStyle?.commonPhrases || []).slice(0, 8);
    const learnedEmojiSignal = contactSignals
      .filter((signal) => signal.category === 'emoji')
      .sort((left, right) => (right.lastObservedAt || '').localeCompare(left.lastObservedAt || ''))[0];
    const contactEmojiPreference = contactProfile?.profileMode === 'custom'
      ? contactProfile.userToContactStyle?.emojiPreference || 'minimal'
      : learnedEmojiSignal?.tendency === 'avoided'
        ? 'none'
        : learnedEmojiSignal?.tendency === 'preferred' && learnedEmojiSignal.confidence === 'high'
          ? 'frequent'
          : 'minimal';
    const preferredTone = contactProfile?.contactStyle?.preferredTone;
    const languagePreference = contactProfile?.userToContactStyle?.languagePreference;
    const relationship = contactProfile?.contactStyle?.relationship;

    const value = {
      generalStyleSummary,
      contactStyleSummary,
      contactFormality,
      contactGreetings,
      contactCommonPhrases,
      contactEmojiPreference,
      preferredTone,
      languagePreference,
      relationship,
    };
    this.layeredContextCache.set(cacheKey, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }
}

export const profileService = new ProfileService();
