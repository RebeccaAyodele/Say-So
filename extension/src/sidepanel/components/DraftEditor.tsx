import React, { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../../services/api-client';
import { ArrowLeft, Send, RotateCcw } from 'lucide-react';

export function DraftEditor() {
  const { state, dispatch, insertReply } = useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus + auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      autoResize();
    }
  }, [state.draftText]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  async function handleSend() {
    const text = state.draftText.trim();
    if (!text) return;

    // Insert into WhatsApp
    await insertReply(text);

    // If draft was edited, fire learning event
    if (state.selectedOption && text !== state.selectedOption.text) {
      try {
        await api.confirmDraft({
          eventId: crypto.randomUUID(),
          contactRef: state.contactRef ?? undefined,
          originalOption: state.selectedOption,
          confirmedDraft: text,
        });
      } catch {
        /* non-blocking — learning is best-effort */
      }
    }

    // Record feedback
    if (state.requestId && state.selectedOption) {
      try {
        await api.recordFeedback({
          requestId: state.requestId,
          optionId: state.selectedOption.id,
          feedbackType: 'inserted',
          contactRef: state.contactRef ?? undefined,
        });
      } catch {
        /* non-blocking */
      }
    }

    dispatch({ type: 'RESET' });
  }

  function handleReset() {
    if (state.selectedOption) {
      dispatch({ type: 'UPDATE_DRAFT', payload: state.selectedOption.text });
    }
  }

  const isDirty = state.selectedOption && state.draftText !== state.selectedOption.text;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'replies' })}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-surface-cardHover transition-colors"
          aria-label="Back to replies"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Edit Draft</span>

        {isDirty && (
          <button
            onClick={handleReset}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-brand-300 transition-colors"
            aria-label="Reset to original"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        )}
      </div>

      {/* Textarea */}
      <div className="panel flex-1 p-3 transition-colors focus-within:border-brand-500/60">
        <textarea
          ref={textareaRef}
          value={state.draftText}
          onChange={(e) => dispatch({ type: 'UPDATE_DRAFT', payload: e.target.value })}
          onInput={autoResize}
          className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 leading-relaxed resize-none outline-none min-h-[120px]"
          placeholder="Customise your reply…"
          rows={5}
        />
      </div>

      {/* Character count + Send */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500">{state.draftText.length} chars</span>

        <button
          onClick={handleSend}
          disabled={!state.draftText.trim()}
          className="button-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold active:scale-[0.98]"
          aria-label="Send reply"
        >
          <Send size={15} />
          Insert & Send
        </button>
      </div>
    </div>
  );
}
