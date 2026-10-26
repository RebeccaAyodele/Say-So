import mongoose, { Schema, Document } from 'mongoose';
import type { ReplyCandidate } from '@sayso/shared';

export interface ReplyCandidateDocument extends Document, Omit<ReplyCandidate, 'userId' | 'contactRef'> {
  userId: string;
  contactRef: string;
}

const ReplyCandidateSchema = new Schema<ReplyCandidateDocument>(
  {
    userId: { type: String, required: true, index: true },
    contactRef: { type: String, required: true, index: true },
    contactName: { type: String },
    revision: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'dismissed', 'replied'],
      default: 'active',
      index: true,
    },
    lastMessageDirection: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: true,
    },
    lastMessageTimestamp: { type: String },
    listPosition: { type: Number },
    unreadCount: { type: Number, default: 0 },
    isGroup: { type: Boolean, default: false },
    dismissedAt: { type: String },
  },
  {
    collection: 'reply_candidates',
    timestamps: true,
  }
);

ReplyCandidateSchema.index({ userId: 1, contactRef: 1 }, { unique: true });

export const ReplyCandidateModel = mongoose.model<ReplyCandidateDocument>(
  'ReplyCandidate',
  ReplyCandidateSchema
);
