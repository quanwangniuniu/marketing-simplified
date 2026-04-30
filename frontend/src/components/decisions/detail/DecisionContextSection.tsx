'use client';

import { useEffect, useState } from 'react';

interface Props {
  value: string;
  editable: boolean;
  error?: string | null;
  onSave: (next: string) => void | Promise<void>;
}

export default function DecisionContextSection({ value, editable, error, onSave }: Props) {
  const [local, setLocal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  const handleBlur = async () => {
    if (!editable || local === (value ?? '')) return;
    setSaving(true);
    try {
      await onSave(local);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="decision-section-context"
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Context Summary
        </h2>
        {saving && <span className="text-[11px] text-gray-400">Saving…</span>}
      </div>
      {editable ? (
        <textarea
          id="decision-field-context"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          placeholder="Summarize the decision context and constraints."
          rows={4}
          className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {value || <span className="text-gray-400">—</span>}
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      )}
    </section>
  );
}
