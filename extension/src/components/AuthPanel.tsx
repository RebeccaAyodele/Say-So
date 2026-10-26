import React, { useState } from 'react';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { clearSession, signInWithPassword, signUpWithPassword, type AuthState } from '../services/auth';

interface AuthPanelProps {
  auth: AuthState;
  onChange: (auth: AuthState) => void;
}

export function AuthPanel({ auth, onChange }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signIn') {
        onChange(await signInWithPassword(email.trim(), password));
      } else {
        const result = await signUpWithPassword(email.trim(), password);
        if (result.session) onChange(result.session);
        else setNotice('Account created. Check your email to confirm it, then sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await clearSession();
    onChange({ isAuthenticated: false, userId: null, email: null, accessToken: null });
  }

  if (auth.isAuthenticated) {
    return (
      <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-card p-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Signed in</p>
          <p className="truncate text-xs text-gray-200">{auth.email || 'Supabase account'}</p>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-5 shadow-xl">
      <div>
        <h2 className="text-sm font-bold text-white">{mode === 'signIn' ? 'Sign in to SaySo' : 'Create your SaySo account'}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">Use your SaySo account to generate replies.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-gray-300">
        Email address
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="auth-input min-h-11 rounded-lg border border-surface-border bg-surface-base px-3 text-sm leading-normal outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20" />
      </label>
      <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-gray-300">
        Password
        <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} className="auth-input min-h-11 rounded-lg border border-surface-border bg-surface-base px-3 text-sm leading-normal outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20" />
      </label>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {notice && <p className="text-xs text-emerald-300">{notice}</p>}
      <button disabled={busy} className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
        {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
      </button>
      <button type="button" onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); setNotice(null); }} className="text-[11px] text-brand-300 hover:text-brand-200">
        {mode === 'signIn' ? 'New to SaySo? Create an account' : 'Already have an account? Sign in'}
      </button>
    </form>
  );
}
