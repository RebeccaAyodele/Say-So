import { z } from 'zod';
import { LearningModeSchema } from './profiles.js';

export const DefaultToneSchema = z.enum(['natural', 'casual', 'formal', 'concise']);
export const DefaultReplyLengthSchema = z.enum(['short', 'medium', 'detailed']);

export const UserPreferencesSchema = z.object({
  userId: z.string().min(1),
  defaultTone: DefaultToneSchema,
  defaultReplyLength: DefaultReplyLengthSchema,
  contextWindowSize: z.number().int().min(5).max(50),
  learningMode: LearningModeSchema,
  updatedAt: z.string(),
});

export const UpdatePreferencesRequestSchema = z.object({
  defaultTone: DefaultToneSchema.optional(),
  defaultReplyLength: DefaultReplyLengthSchema.optional(),
  contextWindowSize: z.number().int().min(5).max(50).optional(),
  learningMode: LearningModeSchema.optional(),
});
