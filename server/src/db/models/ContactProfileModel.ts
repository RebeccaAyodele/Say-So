import mongoose, { Schema, Document } from 'mongoose';
import type { ContactProfile } from '@sayso/shared';

export interface ContactProfileDocument extends Document, Omit<ContactProfile, 'userId' | 'contactRef'> {
  userId: string;
  contactRef: string;
}

const ContactProfileSchema = new Schema<ContactProfileDocument>(
  {
    userId: { type: String, required: true, index: true },
    contactRef: { type: String, required: true, index: true },
    contactName: { type: String },
    profileMode: {
      type: String,
      enum: ['inherited', 'custom'],
      default: 'inherited',
    },
    contactStyle: {
      formality: {
        type: String,
        enum: ['casual', 'neutral', 'formal'],
        default: 'casual',
      },
      relationship: { type: String },
      preferredTone: { type: String },
    },
    userToContactStyle: {
      greetings: { type: [String], default: [] },
      commonPhrases: { type: [String], default: [] },
      emojiPreference: {
        type: String,
        enum: ['none', 'minimal', 'frequent'],
        default: 'minimal',
      },
      languagePreference: { type: String },
    },
    userOverrides: { type: Schema.Types.Mixed, default: {} },
    schemaVersion: { type: Number, default: 1 },
  },
  {
    collection: 'contact_profiles',
    timestamps: true,
  }
);

ContactProfileSchema.index({ userId: 1, contactRef: 1 }, { unique: true });

export const ContactProfileModel = mongoose.model<ContactProfileDocument>(
  'ContactProfile',
  ContactProfileSchema
);
