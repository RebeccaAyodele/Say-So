import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['me', 'them']),
  text: z.string().min(1).max(4000),
  timestamp: z.string().optional(),
  senderName: z.string().max(100).optional(),
});

export const ConversationContextSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(50),
  activeContactName: z.string().max(100).optional(),
  isGroup: z.boolean().optional(),
  unreadCount: z.number().optional(),
});

export const GenerateRepliesRequestSchema = z.object({
  contactRef: z.string().min(1).max(256),
  context: ConversationContextSchema,
  instructions: z.string().max(500).optional(),
  tone: z.string().max(50).optional(),
  length: z.enum(['short', 'medium', 'detailed']).optional(),
  replyMode: z.enum(['all_at_once', 'point_by_point']).optional(),
  isGroup: z.boolean().optional(),
  unreadCount: z.number().optional(),
});

export const ReplyOptionSchema = z.object({
  id: z.string().min(1),
  style: z.string().min(1),
  text: z.string().min(1),
});

export const ModelMetadataSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
});

export const GenerateRepliesResponseSchema = z.object({
  requestId: z.string(),
  options: z.tuple([ReplyOptionSchema, ReplyOptionSchema, ReplyOptionSchema]),
  model: ModelMetadataSchema,
});

export const RecordFeedbackRequestSchema = z.object({
  requestId: z.string().min(1),
  optionId: z.string().min(1),
  feedbackType: z.enum(['selected', 'copied', 'inserted', 'dismissed']),
  confirmedDraft: z.string().max(5000).optional(),
  contactRef: z.string().max(256).optional(),
});
