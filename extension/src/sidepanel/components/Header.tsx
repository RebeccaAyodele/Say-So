import React from 'react';
import { useApp } from '../context/AppContext';
import { Settings, MessageCircle, Inbox } from 'lucide-react';

export function Header() {
  const { state, dispatch } = useApp();

  return (
    <header className="flex items-center justify-between border-b border-surface-border bg-surface-card px-4 py-2.5">
      {/* Brand */}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
        className="flex items-center gap-2 group"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-border text-brand-600">
          <MessageCircle size={15} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-gray-100">
          SaySo
        </span>
      </button>

      {/* Active Contact pill */}
      {state.contactName && (
        <div className="flex-1 mx-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-surface-base px-2.5 py-1 rounded-md border border-surface-border truncate max-w-[170px]">
            {state.contactName}
          </span>
        </div>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {state.candidates.length > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold"
            title={`${state.candidates.length} unreplied conversations awaiting response`}
          >
            <Inbox size={12} />
            <span>{state.candidates.length}</span>
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: state.view === 'settings' ? 'home' : 'settings' })}
          className="p-1.5 rounded-md text-gray-400 hover:text-brand-700 hover:bg-surface-cardHover transition-colors"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
