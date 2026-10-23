import React from 'react';
import { Shield, Eye, Cpu, Trash2 } from 'lucide-react';

export function PrivacyNotice() {
  return (
    <div className="glass-panel rounded-xl p-4 border border-surface-border space-y-3">
      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
        <Shield size={14} className="text-brand-400" />
        Privacy First
      </h3>

      <ul className="space-y-2.5 text-xs text-gray-400 leading-relaxed">
        <li className="flex items-start gap-2">
          <Eye size={13} className="text-brand-500 mt-0.5 shrink-0" />
          <span>Messages are read <strong className="text-gray-300">only</strong> in the active chat window — never background-scanned.</span>
        </li>
        <li className="flex items-start gap-2">
          <Cpu size={13} className="text-brand-500 mt-0.5 shrink-0" />
          <span>Context is processed on-demand and <strong className="text-gray-300">not stored</strong> after replies are generated.</span>
        </li>
        <li className="flex items-start gap-2">
          <Trash2 size={13} className="text-brand-500 mt-0.5 shrink-0" />
          <span>You can delete all learned style data at any time from Settings.</span>
        </li>
      </ul>
    </div>
  );
}
