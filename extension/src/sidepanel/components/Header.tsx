import React from 'react';
import { useApp } from '../context/AppContext';
import { Settings, MessageCircle, Inbox } from 'lucide-react';

export function Header() {
  const { state, dispatch } = useApp();

  return (
    <header className="glass-panel flex items-center justify-between px-4 py-3 border-b border-surface-border">
      {/* Brand */}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
        className="flex items-center gap-2 group"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-shadow">
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
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
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
