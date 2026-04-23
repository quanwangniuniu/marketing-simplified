'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Wallet } from 'lucide-react';

import type { FacebookAdAccount } from '@/lib/api/facebookApi';

export default function AccountPicker({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: FacebookAdAccount[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const label = selected
    ? selected.name || `act_${selected.meta_account_id}`
    : 'Select ad account';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex min-w-[240px] items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm transition-colors ${
          open
            ? 'border-[#3CCED7] ring-2 ring-[#3CCED7]/30'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#3CCED7]/20 to-[#A6E661]/20 text-[#1a9ba3]">
          <Wallet className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {selected && (
          <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-mono text-gray-600">
            {selected.currency}
          </span>
        )}
        {selected?.is_owned && (
          <span className="shrink-0 rounded bg-[#A6E661]/20 px-1 py-0.5 text-[10px] font-medium text-[#3d6b00]">
            owned
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 w-[340px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Ad accounts · {accounts.length}
          </div>
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {accounts.map((a) => {
              const active = a.id === selectedId;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(a.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-gradient-to-r from-[#3CCED7]/10 to-[#A6E661]/10 text-[#1a9ba3]'
                        : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#3CCED7]/20 to-[#A6E661]/20 text-[#1a9ba3]">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {a.name || `act_${a.meta_account_id}`}
                        </span>
                        {a.is_owned && (
                          <span className="shrink-0 rounded bg-[#A6E661]/20 px-1 py-0.5 text-[10px] font-medium text-[#3d6b00]">
                            owned
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
                        <span className="font-mono">{a.meta_account_id}</span>
                        <span>·</span>
                        <span>{a.currency}</span>
                        {a.timezone_name && (
                          <>
                            <span>·</span>
                            <span className="truncate">{a.timezone_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {active && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#1a9ba3]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
