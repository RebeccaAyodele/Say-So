import React, { useState } from 'react';
import type { ReplyCandidate } from '@sayso/shared';
import { Clock, Check, CheckCircle2, User, Users, RefreshCw, Loader2 } from 'lucide-react';

interface CandidateListProps {
  candidates: ReplyCandidate[];
  isScanning?: boolean;
  onRefresh?: () => void;
  onOpenChat: (contactName: string) => void;
  onDismiss: (contactRef: string, revision: string) => void;
}

type FilterTab = 'direct' | 'group' | 'all';

export function CandidateList({
  candidates,
  isScanning = false,
  onRefresh,
  onOpenChat,
  onDismiss,
}: CandidateListProps) {
  const [filter, setFilter] = useState<FilterTab>('direct');

  const directCandidates = candidates.filter((c) => !c.isGroup);
  const groupCandidates = candidates.filter((c) => !!c.isGroup);

  const displayedCandidates =
    filter === 'direct'
      ? directCandidates
      : filter === 'group'
      ? groupCandidates
      : candidates;

  return (
    <div className="flex flex-col gap-3">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-2 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Unreplied Messages
            </h2>
            {isScanning && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20 animate-pulse">
                <Loader2 size={10} className="animate-spin" />
                Scanning...
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isScanning}
                className="p-1 rounded-lg text-gray-400 hover:text-brand-300 hover:bg-surface-card transition-all disabled:opacity-40"
                title="Rescan WhatsApp chats"
                aria-label="Rescan chats"
              >
                <RefreshCw size={13} className={isScanning ? 'animate-spin text-brand-400' : ''} />
              </button>
            )}
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {candidates.length}
            </span>
          </div>
        </div>

        {/* Toggle Pills */}
        <div className="flex p-0.5 rounded-xl bg-surface-card border border-surface-border text-xs">
          <button
            onClick={() => setFilter('direct')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
              filter === 'direct'
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <User size={13} />
            <span>Direct</span>
            <span
              className={`text-[10px] px-1 rounded-full ${
                filter === 'direct' ? 'bg-white/20 text-white' : 'bg-surface-border text-gray-400'
              }`}
            >
              {directCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('group')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
              filter === 'group'
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users size={13} />
            <span>Groups</span>
            <span
              className={`text-[10px] px-1 rounded-full ${
                filter === 'group' ? 'bg-white/20 text-white' : 'bg-surface-border text-gray-400'
              }`}
            >
              {groupCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`py-1.5 px-2.5 rounded-lg font-semibold transition-all ${
              filter === 'all'
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Scanning State (when initially loading candidates) */}
      {isScanning && candidates.length === 0 ? (
        <div className="glass-card rounded-2xl p-5 border border-surface-border/60 text-center flex flex-col items-center">
          <div className="relative w-11 h-11 mb-3 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="absolute inset-0 rounded-2xl bg-brand-500/20 animate-ping opacity-30" />
          </div>
          <p className="text-sm font-semibold text-gray-200">
            Scanning WhatsApp for unreplied chats...
          </p>
          <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
            Checking unread badges and messages awaiting your response
          </p>
          {/* Shimmer skeleton items */}
          <div className="w-full mt-4 space-y-2">
            <div className="h-12 w-full rounded-xl bg-surface-card/60 animate-pulse border border-surface-border/40" />
            <div className="h-12 w-full rounded-xl bg-surface-card/40 animate-pulse border border-surface-border/30" />
          </div>
        </div>
      ) : displayedCandidates.length === 0 ? (
        <div className="glass-card rounded-2xl p-5 border border-surface-border/60 text-center">
          <div className="w-10 h-10 mx-auto mb-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm font-semibold text-gray-200">
            {filter === 'direct'
              ? 'No unreplied direct messages'
              : filter === 'group'
              ? 'No unreplied group messages'
              : 'All caught up!'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {filter === 'direct' && groupCandidates.length > 0 ? (
              <button
                onClick={() => setFilter('group')}
                className="text-brand-400 hover:underline font-medium"
              >
                Switch to {groupCandidates.length} group message(s)
              </button>
            ) : (
              'All current conversations have been replied to'
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayedCandidates.map((candidate) => {
            const displayName = candidate.contactName || candidate.contactRef.replace('wa:', '');
            const unread = candidate.unreadCount ?? 0;
            const isGroup = !!candidate.isGroup;

            return (
              <div
                key={candidate.contactRef}
                className="glass-card rounded-xl p-3 border border-surface-border hover:border-brand-500/40 transition-all flex items-center justify-between gap-3 group"
              >
                {/* Left Info */}
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  onClick={() => onOpenChat(displayName)}
                  title="Click to open this conversation"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform border ${
                      isGroup
                        ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                        : 'bg-brand-500/20 border-brand-500/30 text-brand-400'
                    }`}
                  >
                    {isGroup ? <Users size={16} /> : <User size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100 truncate group-hover:text-brand-300 transition-colors">
                        {displayName}
                      </span>
                      {unread > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-brand-500 text-white shadow-sm shadow-brand-500/30 flex-shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      {candidate.lastMessageTimestamp && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {candidate.lastMessageTimestamp}
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-amber-400/90 font-medium">Awaiting reply</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onOpenChat(displayName)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                      isGroup
                        ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/30'
                        : 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border-brand-500/30'
                    }`}
                    title={isGroup ? 'Open group to summarize unread messages' : 'Open this chat in WhatsApp'}
                  >
                    {isGroup ? 'Summarize' : 'Reply'}
                  </button>

                  <button
                    onClick={() => onDismiss(candidate.contactRef, candidate.revision)}
                    className="p-1.5 rounded-lg hover:bg-surface-card text-gray-400 hover:text-gray-200 border border-transparent hover:border-surface-border transition-all active:scale-95"
                    title="Dismiss from pending replies"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
