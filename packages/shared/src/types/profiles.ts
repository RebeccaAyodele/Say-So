export type SignalCategory =
  | 'emoji'
  | 'formality'
  | 'vocabulary'
  | 'sentence_length'
  | 'greetings'
  | 'slang'
  | 'punctuation';

export type SignalScope = 'general' | 'contact';
export type SignalTendency = 'preferred' | 'avoided' | 'conditional';
export type SignalConfidence = 'low' | 'medium' | 'high';
export type SignalSource = 'confirmed_draft_edit' | 'explicit_preference';

export interface StyleSignal {
  id: string;
  category: SignalCategory;
  pattern: string;
  scope: SignalScope;
  context?: string;
  tendency: SignalTendency;
  confidence: SignalConfidence;
  evidenceCount: number;
  source: SignalSource;
  lastObservedAt: string;
  overrideStatus: boolean;
}

export type LearningMode = 'automatic' | 'manual' | 'hybrid';

export interface UserStyleProfile {
  userId: string;
  styleSignals: StyleSignal[];
  explicitPreferences: Record<string, unknown>;
  learningMode: LearningMode;
  learningEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export type ProfileMode = 'inherited' | 'custom';
export type FormalityLevel = 'casual' | 'neutral' | 'formal';

export interface ContactStyle {
  formality: FormalityLevel;
  relationship?: string;
  preferredTone?: string;
}

export interface UserToContactStyle {
  greetings?: string[];
  commonPhrases?: string[];
  emojiPreference?: 'none' | 'minimal' | 'frequent';
  languagePreference?: string;
}

export interface ContactProfile {
  userId: string;
  contactRef: string;
  contactName?: string;
  profileMode: ProfileMode;
  contactStyle: ContactStyle;
  userToContactStyle: UserToContactStyle;
  userOverrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface UpdateContactProfileRequest {
  contactName?: string;
  profileMode?: ProfileMode;
  contactStyle?: Partial<ContactStyle>;
  userToContactStyle?: Partial<UserToContactStyle>;
  userOverrides?: Record<string, unknown>;
}
