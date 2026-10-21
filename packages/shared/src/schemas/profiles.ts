import { z } from 'zod';

export const SignalCategorySchema = z.enum([
  'emoji',
  'formality',
  'vocabulary',
  'sentence_length',
  'greetings',
  'slang',
  'punctuation',
]);

export const SignalScopeSchema = z.enum(['general', 'contact']);
export const SignalTendencySchema = z.enum(['preferred', 'avoided', 'conditional']);
export const SignalConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const SignalSourceSchema = z.enum(['confirmed_draft_edit', 'explicit_preference']);

export const StyleSignalSchema = z.object({
  id: z.string().min(1),
  category: SignalCategorySchema,
  pattern: z.string().min(1).max(200),
  scope: SignalScopeSchema,
  context: z.string().max(200).optional(),
  tendency: SignalTendencySchema,
  confidence: SignalConfidenceSchema,
  evidenceCount: z.number().int().min(1),
  source: SignalSourceSchema,
  lastObservedAt: z.string(),
  overrideStatus: z.boolean(),
});

export const LearningModeSchema = z.enum(['automatic', 'manual', 'hybrid']);

export const UserStyleProfileSchema = z.object({
  userId: z.string().min(1),
  styleSignals: z.array(StyleSignalSchema),
  explicitPreferences: z.record(z.unknown()),
  learningMode: LearningModeSchema,
  learningEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().int(),
});

export const ProfileModeSchema = z.enum(['inherited', 'custom']);
export const FormalityLevelSchema = z.enum(['casual', 'neutral', 'formal']);

export const ContactStyleSchema = z.object({
  formality: FormalityLevelSchema,
  relationship: z.string().max(100).optional(),
  preferredTone: z.string().max(100).optional(),
});

export const UserToContactStyleSchema = z.object({
  greetings: z.array(z.string().max(100)).optional(),
  commonPhrases: z.array(z.string().max(200)).optional(),
  emojiPreference: z.enum(['none', 'minimal', 'frequent']).optional(),
  languagePreference: z.string().max(100).optional(),
});

export const ContactProfileSchema = z.object({
  userId: z.string().min(1),
  contactRef: z.string().min(1).max(256),
  contactName: z.string().max(100).optional(),
  profileMode: ProfileModeSchema,
  contactStyle: ContactStyleSchema,
  userToContactStyle: UserToContactStyleSchema,
  userOverrides: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().int(),
});

export const UpdateContactProfileRequestSchema = z.object({
  contactName: z.string().max(100).optional(),
  profileMode: ProfileModeSchema.optional(),
  contactStyle: ContactStyleSchema.partial().optional(),
  userToContactStyle: UserToContactStyleSchema.partial().optional(),
  userOverrides: z.record(z.unknown()).optional(),
});
