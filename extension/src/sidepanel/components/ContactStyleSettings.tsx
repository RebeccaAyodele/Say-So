import React, { useEffect, useState } from 'react';
import type { ContactProfile } from '@sayso/shared';
import { api, ApiClientError } from '../../services/api-client';
import { Loader2, Save } from 'lucide-react';

type ContactStyleDraft = {
  formality: 'casual' | 'neutral' | 'formal';
  preferredTone: string;
  emojiPreference: 'none' | 'minimal' | 'frequent';
};

const DEFAULT_STYLE: ContactStyleDraft = {
  formality: 'casual',
  preferredTone: '',
  emojiPreference: 'minimal',
};

export function ContactStyleSettings({ contactRef, contactName }: { contactRef: string; contactName: string }) {
  const [style, setStyle] = useState<ContactStyleDraft>(DEFAULT_STYLE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setSaved(false);

    api.getContactProfile(contactRef)
      .then((profile) => {
        if (current) setStyle(toDraft(profile));
      })
      .catch((err: unknown) => {
        if (!current) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setStyle(DEFAULT_STYLE);
        } else {
          setError('Could not load this contact’s preferences.');
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => { current = false; };
  }, [contactRef]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const profile = await api.updateContactProfile(contactRef, {
        contactName,
        profileMode: 'custom',
        contactStyle: {
          formality: style.formality,
          preferredTone: style.preferredTone.trim() || undefined,
        },
        userToContactStyle: { emojiPreference: style.emojiPreference },
      });
      setStyle(toDraft(profile));
      setSaved(true);
    } catch {
      setError('Could not save these preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel space-y-3 p-3" aria-labelledby="contact-style-heading">
      <div>
        <h2 id="contact-style-heading" className="text-xs font-semibold text-gray-200">Tone for {contactName}</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-gray-500">These preferences apply only to this contact.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-2"><Loader2 className="animate-spin text-brand-400" size={18} /></div>
      ) : (
        <>
          <label className="block space-y-1 text-[11px] text-gray-400">
            Formality
            <select value={style.formality} onChange={(event) => setStyle((current) => ({ ...current, formality: event.target.value as ContactStyleDraft['formality'] }))} className="w-full rounded-md border border-surface-border bg-surface-base px-2.5 py-2 text-xs text-gray-200">
              <option value="casual">Casual</option>
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
            </select>
          </label>

          <label className="block space-y-1 text-[11px] text-gray-400">
            Preferred tone (optional)
            <input value={style.preferredTone} maxLength={100} onChange={(event) => setStyle((current) => ({ ...current, preferredTone: event.target.value }))} placeholder="e.g. respectful and warm" className="w-full rounded-md border border-surface-border bg-surface-base px-2.5 py-2 text-xs text-gray-200 placeholder:text-gray-600" />
          </label>

          <label className="block space-y-1 text-[11px] text-gray-400">
            Emojis
            <select value={style.emojiPreference} onChange={(event) => setStyle((current) => ({ ...current, emojiPreference: event.target.value as ContactStyleDraft['emojiPreference'] }))} className="w-full rounded-md border border-surface-border bg-surface-base px-2.5 py-2 text-xs text-gray-200">
              <option value="none">Avoid emojis</option>
              <option value="minimal">Use sparingly</option>
              <option value="frequent">Use often</option>
            </select>
          </label>

          {error && <p role="alert" className="text-[11px] text-red-400">{error}</p>}
          <button onClick={save} disabled={saving} className="button-primary flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save contact preferences'}
          </button>
        </>
      )}
    </section>
  );
}

function toDraft(profile: ContactProfile): ContactStyleDraft {
  return {
    formality: profile.contactStyle?.formality ?? 'casual',
    preferredTone: profile.contactStyle?.preferredTone ?? '',
    emojiPreference: profile.userToContactStyle?.emojiPreference ?? 'minimal',
  };
}
