export type CandidateStatus = 'active' | 'dismissed' | 'replied';

export interface ReplyCandidate {
  userId: string;
  contactRef: string;
  contactName?: string;
  revision: string;
  status: CandidateStatus;
  lastMessageDirection: 'incoming' | 'outgoing';
  lastMessageTimestamp?: string;
  unreadCount?: number;
  dismissedAt?: string;
  updatedAt: string;
}

export interface CandidateSyncItem {
  contactRef: string;
  contactName?: string;
  revision: string;
  lastMessageDirection: 'incoming' | 'outgoing';
  lastMessageTimestamp?: string;
  unreadCount?: number;
}

export interface SyncInboxRequest {
  candidates: CandidateSyncItem[];
}

export interface SyncInboxResponse {
  syncedCount: number;
  activeCount: number;
}

export interface DismissCandidateRequest {
  contactRef: string;
  revision: string;
}
