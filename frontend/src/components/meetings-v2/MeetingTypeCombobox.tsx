'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (label: string) => void;
  suggestions: string[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
}

export default function MeetingTypeCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Select or create a type…',
  ariaLabel,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const normalizedQuery = query.trim();
  const lowered = normalizedQuery.toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(lowered));
  }, [suggestions, normalizedQuery, lowered]);

  const exactMatch = useMemo(
    () => suggestions.some((s) => s.toLowerCase() === lowered),
    [suggestions, lowered],
  );

  const canCreate = normalizedQuery.length > 0 && !exactMatch;

  const commit = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
      >
        <span className={value ? '' : 'text-gray-400'}>{value || placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-100"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered.length > 0) commit(filtered[0]);
                  else if (canCreate) commit(normalizedQuery);
                }
              }}
              placeholder="Search or create…"
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => commit(s)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-gray-800 transition hover:bg-gray-50"
                >
                  <span>{s}</span>
                  {value === s && <Check className="h-3.5 w-3.5 text-[#3CCED7]" aria-hidden="true" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !canCreate && (
              <li className="px-3 py-2 text-xs text-gray-400">No matches.</li>
            )}
            {canCreate && (
              <li>
                <button
                  type="button"
                  onClick={() => commit(normalizedQuery)}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-1.5 text-left text-sm font-medium text-[#3CCED7] transition hover:bg-gray-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Create &ldquo;{normalizedQuery}&rdquo;</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
