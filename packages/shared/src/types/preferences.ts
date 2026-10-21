export interface UserPreferences {
  userId: string;
  defaultTone: 'natural' | 'casual' | 'formal' | 'concise';
  defaultReplyLength: 'short' | 'medium' | 'detailed';
  contextWindowSize: number;
  learningMode: 'automatic' | 'manual' | 'hybrid';
  updatedAt: string;
}

export interface UpdatePreferencesRequest {
  defaultTone?: 'natural' | 'casual' | 'formal' | 'concise';
  defaultReplyLength?: 'short' | 'medium' | 'detailed';
  contextWindowSize?: number;
  learningMode?: 'automatic' | 'manual' | 'hybrid';
}
