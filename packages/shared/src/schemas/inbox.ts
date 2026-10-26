import { z } from 'zod';

export const CandidateStatusSchema = z.enum(['active', 'dismissed', 'replied']);
export const MessageDirectionSchema = z.enum(['incoming', 'outgoing']);

export const CandidateSyncItemSchema = z.object({
  contactRef: z.string().min(1).max(256),
  contactName: z.string().max(100).optional(),
  revision: z.string().min(1).max(256),
  lastMessageDirection: MessageDirectionSchema,
  lastMessageTimestamp: z.string().optional(),
  listPosition: z.number().int().min(0).optional(),
  unreadCount: z.number().int().min(0).optional(),
  isGroup: z.boolean().optional(),
});

export const ReplyCandidateSchema = z.object({
  userId: z.string().min(1),
  contactRef: z.string().min(1).max(256),
  contactName: z.string().max(100).optional(),
  revision: z.string().min(1).max(256),
  status: CandidateStatusSchema,
  lastMessageDirection: MessageDirectionSchema,
  lastMessageTimestamp: z.string().optional(),
  listPosition: z.number().int().min(0).optional(),
  unreadCount: z.number().int().min(0).optional(),
  isGroup: z.boolean().optional(),
  dismissedAt: z.string().optional(),
  updatedAt: z.string(),
});

export const SyncInboxRequestSchema = z.object({
  candidates: z.array(CandidateSyncItemSchema).max(100),
});

export const SyncInboxResponseSchema = z.object({
  syncedCount: z.number().int().min(0),
  activeCount: z.number().int().min(0),
});

export const DismissCandidateRequestSchema = z.object({
  contactRef: z.string().min(1).max(256),
  revision: z.string().min(1).max(256),
});
