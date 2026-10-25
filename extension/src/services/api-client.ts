import type {
  GenerateRepliesRequest,
  GenerateRepliesResponse,
  RecordFeedbackRequest,
  UserPreferences,
  UpdatePreferencesRequest,
  ContactProfile,
  UpdateContactProfileRequest,
  ReplyCandidate,
  SyncInboxRequest,
  SyncInboxResponse,
  DismissCandidateRequest,
  ProcessLearningEventRequest,
  ProcessLearningEventResponse,
  ApiErrorResponse,
} from '@sayso/shared';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://say-so-3m9u.onrender.com/v1';

/** Retrieve the stored auth token from chrome.storage.local */
async function getAuthToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('auth_token');
  return result.auth_token ?? 'test_user_dev';
}

/** Build standard headers including Authorization if available */
async function headers(): Promise<HeadersInit> {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  const token = await getAuthToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Unified fetch wrapper with error normalisation */
async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(await headers()), ...(init.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    const msg = body?.error?.message ?? `API ${res.status}`;
    throw new ApiClientError(msg, res.status, body?.error?.code);
  }

  return res.json() as Promise<T>;
}

// ─── Custom Error & Friendly Formatter ──────────────────────────────
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function formatFriendlyError(error: unknown): string {
  if (!error) return 'An unexpected issue occurred. Please try again.';
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('econnrefused')) {
    return 'Cannot reach the SaySo backend. Make sure your server is running on port 3000.';
  }
  if (
    lower.includes('enotfound') ||
    lower.includes('buffering timed out') ||
    lower.includes('mongodb') ||
    lower.includes('querysrv')
  ) {
    return 'Temporary database connection issue. Please tap "Generate Smart Replies" again in a few seconds.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'AI service is momentarily busy. Please wait a moment and try again.';
  }
  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('timed out')) {
    return 'Generation took longer than expected. Please tap try again.';
  }

  return msg;
}

// ─── Health ──────────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string }>('/health'),

  // ─── Replies ─────────────────────────────────────────────────────
  generateReplies: (body: GenerateRepliesRequest) =>
    request<GenerateRepliesResponse>('/replies/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  recordFeedback: (body: RecordFeedbackRequest) =>
    request<{ success: boolean }>('/replies/feedback', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  confirmDraft: (body: ProcessLearningEventRequest) =>
    request<ProcessLearningEventResponse>('/replies/confirm-draft', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ─── Preferences ────────────────────────────────────────────────
  getPreferences: () => request<UserPreferences>('/preferences'),

  updatePreferences: (body: UpdatePreferencesRequest) =>
    request<UserPreferences>('/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ─── Contacts ───────────────────────────────────────────────────
  getContactProfile: (contactRef: string) =>
    request<ContactProfile>(`/contacts/${encodeURIComponent(contactRef)}/profile`),

  updateContactProfile: (contactRef: string, body: UpdateContactProfileRequest) =>
    request<ContactProfile>(`/contacts/${encodeURIComponent(contactRef)}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ─── Inbox ──────────────────────────────────────────────────────
  getActiveCandidates: () =>
    request<{ candidates: ReplyCandidate[] }>('/inbox/candidates'),

  syncInbox: (body: SyncInboxRequest) =>
    request<SyncInboxResponse>('/inbox/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  dismissCandidate: (body: DismissCandidateRequest) =>
    request<{ success: boolean }>('/inbox/dismiss', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
