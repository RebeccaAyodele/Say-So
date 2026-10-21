import mongoose, { Schema, Document } from 'mongoose';
import type { LearningEvent } from '@sayso/shared';

export interface LearningEventDocument extends Document, Omit<LearningEvent, 'userId' | 'eventId'> {
  userId: string;
  eventId: string;
}

const LearningEventSchema = new Schema<LearningEventDocument>(
  {
    userId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    contactRef: { type: String },
    eventType: {
      type: String,
      enum: ['confirmed_draft_edit', 'explicit_preference'],
      required: true,
    },
    source: {
      type: String,
      enum: ['draft_editor', 'profile_settings'],
      required: true,
    },
    signalsExtracted: [{ type: Schema.Types.Mixed }],
    processingStatus: {
      type: String,
      enum: ['pending', 'processed', 'rejected', 'no_signals'],
      default: 'pending',
    },
  },
  {
    collection: 'learning_events',
    timestamps: true,
  }
);

LearningEventSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export const LearningEventModel = mongoose.model<LearningEventDocument>(
  'LearningEvent',
  LearningEventSchema
);
