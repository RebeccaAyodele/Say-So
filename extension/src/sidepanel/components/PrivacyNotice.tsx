import React from 'react';
import { Shield, Eye, Cpu } from 'lucide-react';

export function PrivacyNotice() {
  return (
    <div className="panel space-y-3 p-4">
      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
        <Shield size={14} className="text-brand-400" />
        Privacy
      </h3>

      <ul className="space-y-2.5 text-xs text-gray-400 leading-relaxed">
        <li className="flex items-start gap-2">
          <Eye size={13} className="text-brand-500 mt-0.5 shrink-0" />
          <span>SaySo reads message text from the open chat. Chat-list names and reply-status metadata are scanned to find conversations awaiting a reply.</span>
        </li>
        <li className="flex items-start gap-2">
          <Cpu size={13} className="text-brand-500 mt-0.5 shrink-0" />
          <span>Message context is sent to SaySo and OpenRouter to generate drafts. Opening a chat with a new incoming message can trigger generation automatically. SaySo does not store raw chat transcripts.</span>
        </li>
      </ul>
      <a
        href="https://github.com/RebeccaAyodele/Say-So/blob/main/PRIVACY.md"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-brand-300 underline underline-offset-2 hover:text-brand-200"
      >
        Full privacy policy
      </a>
    </div>
  );
}
