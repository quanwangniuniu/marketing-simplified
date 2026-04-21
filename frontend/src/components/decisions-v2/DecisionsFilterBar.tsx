'use client';

import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import InlineSelect from '@/components/tasks-v2/detail/InlineSelect';

export type SortField = 'updatedAt' | 'status' | 'riskLevel' | 'projectSeq';
export type SortDir = 'asc' | 'desc';

const ALL = '__all__';

const STATUS_OPTIONS = [
  { value: ALL, label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'COMMITTED', label: 'Committed' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const RISK_OPTIONS = [
  { value: ALL, label: 'All Risk' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'status', label: 'Status' },
  { value: 'riskLevel', label: 'Risk' },
  { value: 'projectSeq', label: 'Seq' },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  riskFilter: string;
  onRiskFilterChange: (v: string) => void;
  sortField: SortField;
  onSortFieldChange: (v: SortField) => void;
  sortDir: SortDir;
  onSortDirToggle: () => void;
}

export default function DecisionsFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  riskFilter,
  onRiskFilterChange,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirToggle,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search decisions"
            placeholder="Search decisions…"
            className="h-9 w-64 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
          />
        </div>
        <div className="w-44">
          <InlineSelect
            ariaLabel="Filter by status"
            value={statusFilter}
            onValueChange={onStatusFilterChange}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="w-36">
          <InlineSelect
            ariaLabel="Filter by risk"
            value={riskFilter}
            onValueChange={onRiskFilterChange}
            options={RISK_OPTIONS}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Sort</span>
        <div className="w-36">
          <InlineSelect
            ariaLabel="Sort field"
            value={sortField}
            onValueChange={(v) => onSortFieldChange(v as SortField)}
            options={SORT_OPTIONS}
          />
        </div>
        <button
          type="button"
          onClick={onSortDirToggle}
          aria-label={sortDir === 'asc' ? 'Sort ascending (click to flip)' : 'Sort descending (click to flip)'}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-900"
        >
          {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
