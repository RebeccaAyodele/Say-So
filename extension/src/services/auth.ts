/** Minimal Supabase auth adapter for the Chrome Extension.
 *  Stores the JWT access-token in chrome.storage.local so it survives
 *  service-worker restarts. The real Supabase sign-in flow will be
 *  triggered from the popup/sidepanel via redirect or magic-link.  */

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  accessToken: string | null;
}

const STORAGE_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/** Persist a freshly acquired session */
export async function setSession(token: string, userId: string, email: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: token,
    [USER_KEY]: JSON.stringify({ userId, email }),
  });
}

/** Tear down the session */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY, USER_KEY]);
}

/** Read current auth state without hitting the network */
export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get([STORAGE_KEY, USER_KEY]);
  const token: string | undefined = result[STORAGE_KEY];
  if (!token) {
    return { isAuthenticated: false, userId: null, email: null, accessToken: null };
  }

  if (isTokenExpired(token)) {
    await clearSession();
    return { isAuthenticated: false, userId: null, email: null, accessToken: null };
  }

  let userId: string | null = null;
  let email: string | null = null;
  try {
    const parsed = JSON.parse(result[USER_KEY]);
    userId = parsed.userId;
    email = parsed.email;
  } catch {
    /* stored data corrupt – treat as logged-out */
  }

  return { isAuthenticated: true, userId, email, accessToken: token };
}

/** Simple JWT expiry check (epoch seconds) */
export function isTokenExpired(token: string): boolean {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return true;
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}
