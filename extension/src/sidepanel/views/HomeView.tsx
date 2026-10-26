import React from 'react';
import { useApp } from '../context/AppContext';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CandidateList } from '../components/CandidateList';
import { Zap, MessageSquarePlus, AlertCircle, Users, FileText } from 'lucide-react';

export function HomeView() {
  const {
    state,
    generateReplies,
    openChat,
    dismissCandidate,
    refreshCandidates,
    setReplyMode,
    clearError,
  } = useApp();

  const hasContext = !!state.contactRef && state.messages.length > 0;
  const recentThemMessages = state.messages.slice(-5).filter((m) => m.role === 'them');
  const hasMultiplePoints = recentThemMessages.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <div className="text-center py-5">
        <div className={`w-14 h-14 mx-auto mb-3.5 rounded-2xl flex items-center justify-center border ${
          state.isGroup
            ? 'bg-surface-card border-surface-border text-purple-300'
            : 'bg-surface-card border-surface-border text-brand-300'
        }`}>
          {state.isGroup ? <Users size={26} /> : <MessageSquarePlus size={26} />}
        </div>
        <h1 className="text-base font-bold text-white mb-1">
          {hasContext
            ? state.isGroup
              ? `Catch up on ${state.contactName}`
              : `Reply to ${state.contactName}`
            : 'Select a Chat'}
        </h1>
        <p className="text-xs text-gray-400 max-w-[250px] mx-auto leading-relaxed">
          {hasContext
            ? state.isGroup
              ? state.unreadCount > 0
                ? `${state.unreadCount} unread message${state.unreadCount > 1 ? 's' : ''} • ready to summarize`
                : `${state.messages.length} messages loaded • ready to summarize`
              : `${state.messages.length} messages loaded • ${
                  hasMultiplePoints ? `${recentThemMessages.length} points to reply to` : 'ready to generate personalized replies'
                }`
            : 'Open a chat in WhatsApp Web or pick an unreplied conversation below'}
        </p>
      </div>

      {/* Actionable Error Banner */}
      {state.error && (
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1 text-xs leading-relaxed">
              <span className="font-semibold block text-red-300 mb-0.5">Notice</span>
              {state.error}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              onClick={clearError}
              className="text-[11px] px-2.5 py-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
            {hasContext && (
              <button
                onClick={() => {
                  clearError();
                  generateReplies();
                }}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reply Mode Selector (Combined vs Point-by-point, Direct chats only) */}
      {!state.isGroup && hasContext && (
        <div className="panel rounded-lg p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Reply Style
            </span>
            {hasMultiplePoints && (
              <span className="text-[10px] text-amber-400/90 font-medium">
                Multiple points detected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-bg rounded-lg border border-surface-border/50 text-xs">
            <button
              onClick={() => setReplyMode('all_at_once')}
              className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${
                state.replyMode === 'all_at_once'
                  ? 'bg-brand-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>All-in-One</span>
            </button>

            <button
              onClick={() => setReplyMode('point_by_point')}
              className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${
                state.replyMode === 'point_by_point'
                  ? 'bg-brand-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>Point-by-Point</span>
            </button>
          </div>
        </div>
      )}

      {/* Generate / Summarize CTA */}
      {hasContext && (
        <button
          onClick={generateReplies}
          disabled={state.isLoading}
          className={`w-full py-3.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none ${
            state.isGroup
              ? 'bg-purple-800 hover:bg-purple-700'
              : 'bg-brand-700 hover:bg-brand-600'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {state.isGroup ? <FileText size={16} /> : <Zap size={16} />}
            {state.isGroup ? 'Summarize Unread Messages' : 'Generate Smart Replies'}
          </span>
        </button>
      )}

      {state.isLoading && <LoadingSpinner />}

      {/* Candidate List (Unreplied Messages) */}
      <CandidateList
        candidates={state.candidates}
        isScanning={state.isScanning}
        onRefresh={refreshCandidates}
        onOpenChat={openChat}
        onDismiss={dismissCandidate}
      />

      {/* Context preview */}
      {hasContext && (
        <div className="panel p-3">
          <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
            Latest Messages
          </h3>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
            {state.messages.slice(-6).map((msg, i) => (
              <div
                key={i}
                className={`text-xs leading-relaxed px-2.5 py-1.5 rounded-lg ${
                  msg.role === 'me'
                    ? 'bg-brand-500/10 text-brand-200 ml-6'
                    : 'bg-surface-card text-gray-300 mr-6'
                }`}
              >
                <span className="font-medium text-gray-500 text-[10px] block mb-0.5">
                  {msg.role === 'me' ? 'You' : state.contactName}
                </span>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <PrivacyNotice />
    </div>
  );
}
