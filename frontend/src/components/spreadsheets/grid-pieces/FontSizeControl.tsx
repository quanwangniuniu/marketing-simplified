'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface Props {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export default function FontSizeControl({ value, onChange, disabled = false, min = 6, max = 72 }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    if (clamped !== value) onChange(clamped);
    setDraft(String(clamped));
  };

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };

  const btnCls =
    'inline-flex h-8 w-6 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Decrease font size"
        title="Decrease font size"
        onClick={() => bump(-1)}
        disabled={disabled || value <= min}
        className={btnCls}
      >
        <Minus className="h-3 w-3" aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Font size"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setDraft(String(value));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        className="h-8 w-10 rounded-md border border-gray-200 bg-white px-1 text-center text-xs text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:opacity-40"
      />
      <button
        type="button"
        aria-label="Increase font size"
        title="Increase font size"
        onClick={() => bump(1)}
        disabled={disabled || value >= max}
        className={btnCls}
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
