import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../../services/api-client';
import type { UserPreferences } from '@sayso/shared';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const TONES = ['natural', 'casual', 'formal', 'concise'] as const;
const LENGTHS = ['short', 'medium', 'detailed'] as const;
const LEARNING_MODES = ['automatic', 'manual', 'hybrid'] as const;

export function SettingsView() {
  const { dispatch } = useApp();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(console.error);
  }, []);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = await api.updatePreferences({
        defaultTone: prefs.defaultTone,
        defaultReplyLength: prefs.defaultReplyLength,
        learningMode: prefs.learningMode,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-card transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-sm font-bold text-white">Settings</h2>
      </div>

      {!prefs ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-brand-400" size={24} />
        </div>
      ) : (
        <>
          {/* Default Tone */}
          <div className="glass-panel rounded-xl p-4 border border-surface-border space-y-2.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Default Tone
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setPrefs({ ...prefs, defaultTone: t })}
                  className={`text-xs py-2 rounded-lg border transition-all capitalize ${
                    prefs.defaultTone === t
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-300 font-semibold'
                      : 'bg-surface-card border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Reply Length */}
          <div className="glass-panel rounded-xl p-4 border border-surface-border space-y-2.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Reply Length
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l}
                  onClick={() => setPrefs({ ...prefs, defaultReplyLength: l })}
                  className={`text-xs py-2 rounded-lg border transition-all capitalize ${
                    prefs.defaultReplyLength === l
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-300 font-semibold'
                      : 'bg-surface-card border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Learning Mode */}
          <div className="glass-panel rounded-xl p-4 border border-surface-border space-y-2.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Learning Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LEARNING_MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setPrefs({ ...prefs, learningMode: m })}
                  className={`text-xs py-2 rounded-lg border transition-all capitalize ${
                    prefs.learningMode === m
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-300 font-semibold'
                      : 'bg-surface-card border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              <strong>Automatic</strong> — learns from every edit. <strong>Manual</strong> — only when you explicitly save. <strong>Hybrid</strong> — asks before learning.
            </p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              'Saved'
            ) : (
              <>
                <Save size={15} />
                Save Preferences
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
