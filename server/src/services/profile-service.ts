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
    return updated.toObject() as unknown as UserStyleProfile;
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
    return saved.toObject() as unknown as ContactProfile;
  }

  async deleteContactProfile(userId: string, contactRef: string): Promise<boolean> {
    const result = await ContactProfileModel.deleteOne({ userId, contactRef });
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
    contactFormality: string;
    contactGreetings: string[];
    contactCommonPhrases: string[];
    contactEmojiPreference: string;
    relationship?: string;
  }> {
    const userProfile = await this.getUserProfile(userId);
    const contactProfile = await this.getContactProfile(userId, contactRef);

    // Filter relevant high & medium confidence general signals
    const generalStyleSummary = (userProfile.styleSignals || [])
      .filter((s) => s.confidence !== 'low' && !s.overrideStatus)
      .map((s) => `${s.category}: ${s.pattern} (${s.tendency})`);

    const contactFormality = contactProfile?.contactStyle?.formality || 'casual';
    const contactGreetings = contactProfile?.userToContactStyle?.greetings || [];
    const contactCommonPhrases = contactProfile?.userToContactStyle?.commonPhrases || [];
    const contactEmojiPreference = contactProfile?.userToContactStyle?.emojiPreference || 'minimal';
    const relationship = contactProfile?.contactStyle?.relationship;

    return {
      generalStyleSummary,
      contactFormality,
      contactGreetings,
      contactCommonPhrases,
      contactEmojiPreference,
      relationship,
    };
  }
}

export const profileService = new ProfileService();
