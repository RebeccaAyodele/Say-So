export type MessageRole = 'me' | 'them';

export interface ChatMessage {
  role: MessageRole;
  text: string;
  timestamp?: string;
  senderName?: string;
}

export interface ConversationContext {
  messages: ChatMessage[];
  activeContactName?: string;
}

export interface GenerateRepliesRequest {
  contactRef: string;
  context: ConversationContext;
  instructions?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'detailed';
  replyMode?: 'all_at_once' | 'point_by_point';
}

export interface ReplyOption {
  id: string;
  style: string;
  text: string;
}

export interface ModelMetadata {
  provider: string;
  modelId: string;
}

export interface GenerateRepliesResponse {
  requestId: string;
  options: [ReplyOption, ReplyOption, ReplyOption];
  model: ModelMetadata;
}

export type FeedbackType = 'selected' | 'copied' | 'inserted' | 'dismissed';

export interface RecordFeedbackRequest {
  requestId: string;
  optionId: string;
  feedbackType: FeedbackType;
  confirmedDraft?: string;
  contactRef?: string;
}
