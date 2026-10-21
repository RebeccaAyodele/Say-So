import { z } from 'zod';
import { StyleSignalSchema } from './profiles.js';
import { ReplyOptionSchema } from './replies.js';

export const LearningEventTypeSchema = z.enum(['confirmed_draft_edit', 'explicit_preference']);
export const LearningSourceSchema = z.enum(['draft_editor', 'profile_settings']);
export const LearningProcessingStatusSchema = z.enum(['pending', 'processed', 'rejected', 'no_signals']);

export const LearningEventSchema = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
  contactRef: z.string().optional(),
  eventType: LearningEventTypeSchema,
  source: LearningSourceSchema,
  signalsExtracted: z.array(StyleSignalSchema),
  createdAt: z.string(),
  processingStatus: LearningProcessingStatusSchema,
});

export const ProcessLearningEventRequestSchema = z.object({
  eventId: z.string().min(1),
  contactRef: z.string().optional(),
  originalOption: ReplyOptionSchema,
  confirmedDraft: z.string().min(1).max(5000),
});

export const ProcessLearningEventResponseSchema = z.object({
  eventId: z.string(),
  signalsIdentified: z.number().int().min(0),
  profileUpdated: z.boolean(),
  signals: z.array(StyleSignalSchema),
});
