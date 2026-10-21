import mongoose, { Schema, Document } from 'mongoose';
import type { UserPreferences } from '@sayso/shared';

export interface UserPreferenceDocument extends Document, Omit<UserPreferences, 'userId'> {
  userId: string;
}

const UserPreferenceSchema = new Schema<UserPreferenceDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    defaultTone: {
      type: String,
      enum: ['natural', 'casual', 'formal', 'concise'],
      default: 'natural',
    },
    defaultReplyLength: {
      type: String,
      enum: ['short', 'medium', 'detailed'],
      default: 'short',
    },
    contextWindowSize: { type: Number, default: 20 },
    learningMode: {
      type: String,
      enum: ['automatic', 'manual', 'hybrid'],
      default: 'automatic',
    },
  },
  {
    collection: 'user_preferences',
    timestamps: true,
  }
);

export const UserPreferenceModel = mongoose.model<UserPreferenceDocument>(
  'UserPreference',
  UserPreferenceSchema
);
