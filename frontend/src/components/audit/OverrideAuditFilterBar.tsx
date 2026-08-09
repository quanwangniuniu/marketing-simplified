'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import type { OverrideAuditFilters, OverrideType } from '@/types/adminOverrideAudit';

interface OverrideAuditFilterBarProps {
  filters: OverrideAuditFilters;
  onChange: (filters: OverrideAuditFilters) => void;
  users?: { id: number; username: string }[];
}

const MODULE_OPTIONS = ['ASSET', 'CAMPAIGN', 'BUDGET', 'REPORTING'];

const OVERRIDE_TYPE_LABELS: Record<OverrideType, string> = {
  SUPERUSER: 'Superuser',
  ORG_ADMIN: 'Org Admin',
};

export default function OverrideAuditFilterBar({ filters, onChange, users = [] }: OverrideAuditFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  function clearAll() {
    onChange({ user_id: undefined, override_type: undefined, module: undefined, from: undefined, to: undefined });
  }

  const activeFilterCount =
    (filters.override_type ? 1 : 0) +
    (filters.module ? 1 : 0) +
    (filters.user_id ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3CCED7] text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {filters.override_type && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[#3CCED7]/10 text-[#1a9ba3]">
            {OVERRIDE_TYPE_LABELS[filters.override_type]}
            <button onClick={() => onChange({ ...filters, override_type: undefined })} aria-label="Remove override type filter">
              <X size={10} />
            </button>
          </span>
        )}

        {filters.module && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
            {filters.module}
            <button onClick={() => onChange({ ...filters, module: undefined })} aria-label="Remove module filter">
              <X size={10} />
            </button>
          </span>
        )}

        {filters.user_id && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
            {users.find((u) => u.id === filters.user_id)?.username ?? `User #${filters.user_id}`}
            <button onClick={() => onChange({ ...filters, user_id: undefined })} aria-label="Remove user filter">
              <X size={10} />
            </button>
          </span>
        )}

        {(filters.from || filters.to) && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
            Date range
            <button onClick={() => onChange({ ...filters, from: undefined, to: undefined })} aria-label="Remove date filter">
              <X size={10} />
            </button>
          </span>
        )}

        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
            Clear all
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-20 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 space-y-4">
            <div>
              <label htmlFor="override-filter-type" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Override Type
              </label>
              <select
                id="override-filter-type"
                value={filters.override_type ?? ''}
                onChange={(e) => {
                  const val = e.target.value as OverrideType | '';
                  onChange({ ...filters, override_type: val ? (val as OverrideType) : undefined });
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              >
                <option value="">All types</option>
                <option value="SUPERUSER">Superuser</option>
                <option value="ORG_ADMIN">Org Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="override-filter-module" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Module
              </label>
              <select
                id="override-filter-module"
                value={filters.module ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange({ ...filters, module: val || undefined });
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              >
                <option value="">All modules</option>
                {MODULE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="override-filter-user" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                User
              </label>
              {users.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">No users in log yet</p>
              ) : (
                <select
                  id="override-filter-user"
                  value={filters.user_id ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange({ ...filters, user_id: val ? parseInt(val, 10) : undefined });
                  }}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Date Range</div>
              <div className="space-y-2">
                <div>
                  <label htmlFor="override-filter-from" className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">From</label>
                  <input
                    id="override-filter-from"
                    type="date"
                    value={filters.from ? filters.from.slice(0, 10) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({ ...filters, from: val ? `${val}T00:00:00Z` : undefined });
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                </div>
                <div>
                  <label htmlFor="override-filter-to" className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">To</label>
                  <input
                    id="override-filter-to"
                    type="date"
                    value={filters.to ? filters.to.slice(0, 10) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({ ...filters, to: val ? `${val}T23:59:59Z` : undefined });
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
