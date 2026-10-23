import React, { useState } from 'react';
import type { ReplyOption } from '@sayso/shared';
import { useApp } from '../context/AppContext';
import { Check, Copy, Sparkles } from 'lucide-react';

interface ReplyCardProps {
  option: ReplyOption;
  index: number;
}

const STYLE_COLORS: Record<string, string> = {
  brief: 'from-sky-500/20 to-sky-600/10 border-sky-500/30',
  warm: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  direct: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
};

const STYLE_LABELS: Record<string, string> = {
  brief: '⚡ Brief',
  warm: '💛 Warm',
  direct: '🎯 Direct',
};

export function ReplyCard({ option, index }: ReplyCardProps) {
  const { dispatch, insertReply } = useApp();
  const [copiedIndex, setCopiedIndex] = useState<number | 'all' | null>(null);

  const gradient = STYLE_COLORS[option.style] ?? STYLE_COLORS.brief;
  const label = STYLE_LABELS[option.style] ?? option.style;

  // Split lines if structured as numbered points (e.g. "1. ... \n 2. ...")
  const rawLines = option.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const isMultiPoint = rawLines.length >= 2 && rawLines.some((l) => /^\d+[\.\)]\s*/.test(l));

  async function handleSelect() {
    dispatch({ type: 'SELECT_OPTION', payload: option });
  }

  async function handleCopy(text: string, idx: number | 'all') {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  async function handleInsert(text: string) {
    await insertReply(text);
  }

  return (
    <div
      className={`
        glass-panel glass-panel-hover rounded-xl p-4
        bg-gradient-to-br ${gradient}
        border cursor-pointer
        animate-in fade-in-0 slide-in-from-bottom-2
      `}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      aria-label={`Reply option: ${label}`}
    >
      {/* Style badge */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold tracking-wide uppercase text-gray-300">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {isMultiPoint && (
            <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/30">
              {rawLines.length} points
            </span>
          )}
          <Sparkles size={14} className="text-brand-400 opacity-60" />
        </div>
      </div>

      {/* Reply text or individual point bubbles */}
      {isMultiPoint ? (
        <div className="flex flex-col gap-2 my-1">
          {rawLines.map((line, lineIdx) => {
            // Strip the leading "1. " or "2. " for cleaner display/insertion if user inserts individually
            const cleanText = line.replace(/^\d+[\.\)]\s*/, '').trim();
            const pointNumber = lineIdx + 1;

            return (
              <div
                key={lineIdx}
                className="p-2.5 rounded-lg bg-surface-bg/70 border border-surface-border/60 flex items-start justify-between gap-2 text-xs text-gray-200 group/line"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0 mt-0.5">
                    {pointNumber}
                  </span>
                  <p className="leading-relaxed whitespace-pre-wrap select-text break-words">
                    {cleanText}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(cleanText, lineIdx)}
                    className="p-1 rounded text-gray-400 hover:text-brand-300 hover:bg-white/5 transition-colors"
                    title="Copy this reply"
                  >
                    {copiedIndex === lineIdx ? <Check size={12} className="text-brand-400" /> : <Copy size={12} />}
                  </button>
                  <button
                    onClick={() => handleInsert(cleanText)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 transition-colors"
                    title="Insert this reply into WhatsApp"
                  >
                    Send ↵
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap select-text">
          {option.text}
        </p>
      )}

      {/* Card Actions */}
      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/5">
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(option.text, 'all'); }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-300 transition-colors"
          aria-label="Copy reply"
        >
          {copiedIndex === 'all' ? <Check size={13} className="text-brand-400" /> : <Copy size={13} />}
          {copiedIndex === 'all' ? 'Copied' : isMultiPoint ? 'Copy All' : 'Copy'}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleInsert(option.text); }}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 px-3 py-1 rounded-full transition-all"
          aria-label="Insert reply into WhatsApp"
        >
          {isMultiPoint ? 'Insert All ↵' : 'Insert ↵'}
        </button>
      </div>
    </div>
  );
}
