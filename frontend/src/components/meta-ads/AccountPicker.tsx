'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Wallet,
} from 'lucide-react';

import { facebookApi, type FacebookAdAccount } from '@/lib/api/facebookApi';

const DEFAULT_PAGE_SIZE = 5;

export default function AccountPicker({
  projectId,
  knownAccounts = [],
  selectedId,
  onSelect,
  onAccountsLoaded,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  projectId: number | null;
  knownAccounts?: FacebookAdAccount[];
  selectedId: number | null;
  onSelect: (id: number, account?: FacebookAdAccount) => void;
  onAccountsLoaded?: (accounts: FacebookAdAccount[], count: number) => void;
  pageSize?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<FacebookAdAccount[]>([]);
  const [knownById, setKnownById] = useState<Record<number, FacebookAdAccount>>({});
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setKnownById((prev) => {
      const next = { ...prev };
      for (const account of knownAccounts) {
        next[account.id] = account;
      }
      return next;
    });
  }, [knownAccounts]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    facebookApi
      .listAdAccounts({
        project_id: projectId ?? undefined,
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
      })
      .then((response) => {
        if (cancelled) return;
        const results = response.results ?? [];
        setAccounts(results);
        setCount(response.count ?? 0);
        setKnownById((prev) => {
          const next = { ...prev };
          for (const account of results) {
            next[account.id] = account;
          }
          return next;
        });
        onAccountsLoaded?.(results, response.count ?? 0);
        if (!selectedId && !debouncedSearch && page === 1 && results.length > 0) {
          onSelect(results[0].id, results[0]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
          setCount(0);
          setError('Could not load ad accounts.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    onAccountsLoaded,
    onSelect,
    page,
    pageSize,
    projectId,
    selectedId,
  ]);

  const selected = selectedId ? knownById[selectedId] ?? null : null;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / pageSize)),
    [count, pageSize]
  );
  const label = selected
    ? selected.name || `act_${selected.meta_account_id}`
    : selectedId
      ? `Ad account #${selectedId}`
      : 'Select ad account';
  const sharedLabel = (account: FacebookAdAccount) =>
    account.connector_name ? `shared by ${account.connector_name}` : 'shared';
  const renderAccountBadge = (account: FacebookAdAccount) => {
    if (account.connected_by_current_user && account.is_owned) {
      return (
        <span className="shrink-0 rounded bg-[#A6E661]/20 px-1 py-0.5 text-[10px] font-medium text-[#3d6b00]">
          owned
        </span>
      );
    }
    if (!account.connected_by_current_user) {
      return (
        <span className="shrink-0 rounded bg-[#3CCED7]/15 px-1 py-0.5 text-[10px] font-medium text-[#1a9ba3]">
          {sharedLabel(account)}
        </span>
      );
    }
    return null;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex min-w-[260px] max-w-full items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm transition-colors ${
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
        {selected && renderAccountBadge(selected)}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          <div className="border-b border-gray-100 bg-gray-50/60 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ad accounts"
                className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-8 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase text-gray-500">
              <span>Ad accounts · {count}</span>
              {count > pageSize && (
                <span>
                  Page {page} of {totalPages}
                </span>
              )}
            </div>
          </div>

          <ul className="max-h-[320px] overflow-y-auto py-1">
            {error && (
              <li className="px-3 py-6 text-center text-sm text-red-600">{error}</li>
            )}
            {!error && loading && accounts.length === 0 && (
              <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading accounts
              </li>
            )}
            {!error && !loading && accounts.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-gray-500">
                {debouncedSearch
                  ? `No ad accounts match "${debouncedSearch}".`
                  : 'No ad accounts available.'}
              </li>
            )}
            {accounts.map((account) => {
              const active = account.id === selectedId;
              return (
                <li key={account.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(account.id, account);
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
                          {account.name || `act_${account.meta_account_id}`}
                        </span>
                        {renderAccountBadge(account)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
                        <span className="font-mono">{account.meta_account_id}</span>
                        <span>|</span>
                        <span>{account.currency}</span>
                        {account.timezone_name && (
                          <>
                            <span>|</span>
                            <span className="truncate">{account.timezone_name}</span>
                          </>
                        )}
                        {!account.connected_by_current_user && account.connector_name && (
                          <>
                            <span>|</span>
                            <span className="truncate">{account.connector_name}</span>
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

          {count > pageSize && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-2.5 py-2 text-xs text-gray-500">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span>
                {Math.min((page - 1) * pageSize + 1, count)}-
                {Math.min(page * pageSize, count)} of {count}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
