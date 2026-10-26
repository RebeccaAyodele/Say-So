import React from 'react';
import { useApp } from '../context/AppContext';
import { Settings, MessageCircle, Inbox } from 'lucide-react';

export function Header() {
  const { state, dispatch } = useApp();

  return (
    <header className="flex items-center justify-between border-b border-surface-border bg-surface-card px-4 py-3">
      {/* Brand */}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
        className="flex items-center gap-2 group"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700">
          <MessageCircle size={16} className="text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight">
          Say<span className="text-brand-400">So</span>
        </span>
      </button>

      {/* Active Contact pill */}
      {state.contactName && (
        <div className="flex-1 mx-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-surface-card px-3 py-1 rounded-full border border-surface-border truncate max-w-[170px]">
            <span className="h-2 w-2 rounded-full bg-brand-400" />
            {state.contactName}
          </span>
        </div>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {state.candidates.length > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-bold"
            title={`${state.candidates.length} unreplied conversations awaiting response`}
          >
            <Inbox size={12} />
            <span>{state.candidates.length}</span>
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: state.view === 'settings' ? 'home' : 'settings' })}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-400 hover:bg-surface-card transition-all"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
