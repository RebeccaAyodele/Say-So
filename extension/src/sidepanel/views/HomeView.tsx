import React from 'react';
import { useApp } from '../context/AppContext';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CandidateList } from '../components/CandidateList';
import { MessageSquarePlus, AlertCircle, Users, FileText } from 'lucide-react';

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
      <div className="border-b border-surface-border px-1 pb-4 pt-2">
        <h1 className="text-lg font-semibold text-gray-100 mb-1">
          {hasContext
            ? state.isGroup
              ? `Catch up on ${state.contactName}`
              : `Reply to ${state.contactName}`
            : 'Select a Chat'}
        </h1>
        <p className="text-xs text-gray-400 leading-relaxed">
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
        <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="shrink-0 mt-0.5 text-red-700" />
            <div className="flex-1 text-xs leading-relaxed">
              <span className="font-semibold block text-red-800 mb-0.5">Notice</span>
              {state.error}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              onClick={clearError}
              className="text-[11px] px-2.5 py-1 rounded-md text-gray-500 hover:text-gray-100 hover:bg-red-100 transition-colors"
            >
              Dismiss
            </button>
            {hasContext && (
              <button
                onClick={() => {
                  clearError();
                  generateReplies();
                }}
                className="text-[11px] font-semibold px-3 py-1 rounded-md bg-red-100 hover:bg-red-200 text-red-800 border border-red-200 transition-colors"
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
              <span className="text-[10px] text-gray-500 font-medium">
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
          className={`w-full py-3 rounded-md text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none ${
            state.isGroup
              ? 'bg-brand-700 hover:bg-brand-600'
              : 'bg-brand-700 hover:bg-brand-600'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {state.isGroup ? <FileText size={16} /> : <MessageSquarePlus size={16} />}
            {state.isGroup ? 'Summarize unread messages' : 'Generate replies'}
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
            {state.messages.slice(-6).reverse().map((msg, i) => (
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
