import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ReplyCard } from '../components/ReplyCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export function RepliesView() {
  const { state, dispatch, generateReplies } = useApp();

  useEffect(() => {
    if (state.isLoading || state.replyOptions.length === 0) return;
    const frame = requestAnimationFrame(() => {
      console.debug(`[SaySo timing] UI reply rendering: ${Math.round(performance.now())}ms mark`);
    });
    return () => cancelAnimationFrame(frame);
  }, [state.isLoading, state.replyOptions]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          {state.isGroup ? 'Group Summary' : `${state.replyOptions.length} Options`}
        </span>
        <button
          onClick={generateReplies}
          disabled={state.isLoading}
          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-40 transition-colors"
          aria-label={state.isGroup ? 'Regenerate summary' : 'Regenerate replies'}
        >
          <RefreshCw size={13} className={state.isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {state.isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {state.replyOptions.map((opt, i) => (
            <ReplyCard key={opt.id} option={opt} index={i} />
          ))}
        </div>
      )}

      {/* Tip */}
      <p className="text-center text-[10px] text-gray-500">
        {state.isGroup
          ? 'Executive summary of unread messages in this group'
          : 'Click a card to customise before sending • edits teach SaySo your style'}
      </p>
    </div>
  );
}
