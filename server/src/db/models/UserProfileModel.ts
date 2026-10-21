import mongoose, { Schema, Document } from 'mongoose';
import type { UserStyleProfile, StyleSignal } from '@sayso/shared';

export interface UserProfileDocument extends Document, Omit<UserStyleProfile, 'userId'> {
  userId: string;
}

const StyleSignalSubSchema = new Schema<StyleSignal>(
  {
    id: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['emoji', 'formality', 'vocabulary', 'sentence_length', 'greetings', 'slang', 'punctuation'],
    },
    pattern: { type: String, required: true },
    scope: { type: String, required: true, enum: ['general', 'contact'] },
    context: { type: String },
    tendency: { type: String, required: true, enum: ['preferred', 'avoided', 'conditional'] },
    confidence: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    evidenceCount: { type: Number, required: true, default: 1 },
    source: { type: String, required: true, enum: ['confirmed_draft_edit', 'explicit_preference'] },
    lastObservedAt: { type: String, required: true },
    overrideStatus: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const UserProfileSchema = new Schema<UserProfileDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    styleSignals: { type: [StyleSignalSubSchema], default: [] },
    explicitPreferences: { type: Schema.Types.Mixed, default: {} },
    learningMode: {
      type: String,
      enum: ['automatic', 'manual', 'hybrid'],
      default: 'automatic',
    },
    learningEnabled: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  {
    collection: 'user_style_profiles',
    timestamps: true,
  }
);

export const UserProfileModel = mongoose.model<UserProfileDocument>('UserProfile', UserProfileSchema);
