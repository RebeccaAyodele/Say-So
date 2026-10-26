/** Supabase auth adapter for the Chrome Extension. */

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  accessToken: string | null;
}

const STORAGE_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: string; email?: string };
  error_description?: string;
  error?: string;
  error_code?: string;
  msg?: string;
}

function supabaseError(body: SupabaseAuthResponse | null, fallback: string): string {
  return body?.error_description || body?.msg || body?.error || fallback;
}

export interface SignUpResult {
  session: AuthState | null;
  confirmationRequired: boolean;
}

function supabaseConfig(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error('Supabase sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return { url: url.replace(/\/$/, ''), anonKey };
}

/** Sign in with Supabase and persist only the session data needed by the API. */
export async function signInWithPassword(email: string, password: string): Promise<AuthState> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => null)) as SupabaseAuthResponse | null;
  if (!response.ok || !body?.access_token || !body.user?.id) {
    throw new Error(supabaseError(body, 'Sign-in failed. Check your email and password.'));
  }

  await setSession(body.access_token, body.user.id, body.user.email || email, body.refresh_token);
  return {
    isAuthenticated: true,
    userId: body.user.id,
    email: body.user.email || email,
    accessToken: body.access_token,
  };
}

/** Create a new SaySo account in the same Supabase project. */
export async function signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => null)) as SupabaseAuthResponse | null;
  if (!response.ok || !body?.user?.id) {
    const message = supabaseError(body, 'Account creation failed.');
    if (/already registered|already exists|user exists/i.test(message)) {
      throw new Error('An account with this email already exists. Confirm your email if needed, then switch to Sign in.');
    }
    throw new Error(message);
  }

  if (!body.access_token) {
    return { session: null, confirmationRequired: true };
  }

  await setSession(body.access_token, body.user.id, body.user.email || email, body.refresh_token);
  return {
    confirmationRequired: false,
    session: {
      isAuthenticated: true,
      userId: body.user.id,
      email: body.user.email || email,
      accessToken: body.access_token,
    },
  };
}

/** Persist a freshly acquired session */
export async function setSession(token: string, userId: string, email: string, refreshToken?: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: token,
    [USER_KEY]: JSON.stringify({ userId, email }),
    ...(refreshToken ? { [REFRESH_TOKEN_KEY]: refreshToken } : {}),
  });
}

/** Tear down the session */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY, USER_KEY, REFRESH_TOKEN_KEY]);
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const { url, anonKey } = supabaseConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const body = (await response.json().catch(() => null)) as SupabaseAuthResponse | null;
    if (!response.ok || !body?.access_token || !body.user?.id) return null;
    await setSession(body.access_token, body.user.id, body.user.email || '', body.refresh_token || refreshToken);
    return body.access_token;
  } catch {
    return null;
  }
}

/** Read current auth state without hitting the network */
export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get([STORAGE_KEY, USER_KEY, REFRESH_TOKEN_KEY]);
  const token: string | undefined = result[STORAGE_KEY];
  if (!token) {
    return { isAuthenticated: false, userId: null, email: null, accessToken: null };
  }

  if (isTokenExpired(token)) {
    const refreshedToken = result[REFRESH_TOKEN_KEY] as string | undefined;
    if (refreshedToken && await refreshAccessToken(refreshedToken)) {
      return getAuthState();
    }
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
