import { StyleSignal } from './profiles.js';
import { ReplyOption } from './replies.js';

export type LearningEventType = 'confirmed_draft_edit' | 'explicit_preference';
export type LearningSource = 'draft_editor' | 'profile_settings';
export type LearningProcessingStatus = 'pending' | 'processed' | 'rejected' | 'no_signals';

export interface LearningEvent {
  userId: string;
  eventId: string;
  contactRef?: string;
  eventType: LearningEventType;
  source: LearningSource;
  signalsExtracted: StyleSignal[];
  createdAt: string;
  processingStatus: LearningProcessingStatus;
}

export interface ProcessLearningEventRequest {
  eventId: string;
  contactRef?: string;
  originalOption: ReplyOption;
  confirmedDraft: string;
}

export interface ProcessLearningEventResponse {
  eventId: string;
  signalsIdentified: number;
  profileUpdated: boolean;
  signals: StyleSignal[];
}
