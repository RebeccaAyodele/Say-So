import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { SidePanelApp } from './SidePanelApp';
import { AppProvider } from './context/AppContext';
import { AuthPanel } from '../components/AuthPanel';
import { getAuthState, type AuthState } from '../services/auth';

function AuthenticatedSidePanel() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    getAuthState()
      .then(setAuth)
      .catch(() => setAuth({ isAuthenticated: false, userId: null, email: null, accessToken: null }));
  }, []);

  if (!auth) {
    return <div className="flex h-screen items-center justify-center bg-surface-base text-xs text-gray-400">Checking sign-in…</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen max-h-screen items-start justify-center overflow-y-auto bg-surface-base px-4 py-6 font-['Plus_Jakarta_Sans',sans-serif] text-gray-100">
        <AuthPanel auth={auth} onChange={setAuth} />
      </div>
    );
  }

  return (
    <AppProvider>
      <SidePanelApp />
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthenticatedSidePanel />
  </React.StrictMode>,
);
