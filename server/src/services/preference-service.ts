import { UserPreferenceModel } from '../db/models/index.js';
import type { UserPreferences, UpdatePreferencesRequest } from '@sayso/shared';

export class PreferenceService {
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    let prefs = await UserPreferenceModel.findOne({ userId });

    if (!prefs) {
      prefs = await UserPreferenceModel.create({
        userId,
        defaultTone: 'natural',
        defaultReplyLength: 'short',
        contextWindowSize: 20,
        learningMode: 'automatic',
      });
    }

    return prefs.toObject() as unknown as UserPreferences;
  }

  async updateUserPreferences(
    userId: string,
    updates: UpdatePreferencesRequest
  ): Promise<UserPreferences> {
    const updated = await UserPreferenceModel.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );

    return updated.toObject() as unknown as UserPreferences;
  }
}

export const preferenceService = new PreferenceService();
