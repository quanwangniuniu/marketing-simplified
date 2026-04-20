'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { CampaignStatus } from '@/types/campaign';

interface Props {
  searchQuery: string;
  statusFilter: string;
  onSearchChange: (q: string) => void;
  onStatusChange: (status: string) => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'SCALING', label: 'Scaling' },
  { value: 'OPTIMIZING', label: 'Optimizing' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function CampaignListFilters({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: Props) {
  const [local, setLocal] = useState(searchQuery);

  useEffect(() => {
    const t = setTimeout(() => onSearchChange(local), 300);
    return () => clearTimeout(t);
  }, [local, onSearchChange]);

  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Search campaigns by name or hypothesis…"
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
        />
        {local && (
          <button
            type="button"
            onClick={() => setLocal('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="w-44 rounded-md border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
