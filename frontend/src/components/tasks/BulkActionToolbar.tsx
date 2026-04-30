'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CheckSquare, Users } from 'lucide-react';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from './TYPE_META';

export type BulkField =
  | 'status'
  | 'due_date'
  | 'owner_id'
  | 'current_approver_id'
  | 'priority'
  | 'start_date'
  | 'planned_start_date';

interface MemberOption {
  id: number;
  label: string;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  memberOptions: MemberOption[];
  statusOptions?: string[];
  statusDisabledReason?: string | null;
  loading?: boolean;
  onApply: (field: BulkField, value: string) => Promise<void> | void;
  onClearSelection: () => void;
}

const FIELD_OPTIONS: Array<{ value: BulkField; label: string }> = [
  { value: 'status', label: 'Status' },
  { value: 'due_date', label: 'Due date' },
  { value: 'owner_id', label: 'Owner' },
  { value: 'current_approver_id', label: 'Approver' },
  { value: 'priority', label: 'Priority' },
  { value: 'start_date', label: 'Start date' },
  { value: 'planned_start_date', label: 'Planned start date' },
];

const DATE_FIELDS: BulkField[] = ['due_date', 'start_date', 'planned_start_date'];
const MEMBER_FIELDS: BulkField[] = ['owner_id', 'current_approver_id'];

export default function BulkActionToolbar({
  selectedCount,
  memberOptions,
  statusOptions,
  statusDisabledReason,
  loading = false,
  onApply,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [field, setField] = useState<BulkField>('status');
  const [value, setValue] = useState('');

  const selectableValues = useMemo(() => {
    if (field === 'status') return statusOptions ?? STATUS_OPTIONS;
    if (field === 'priority') return PRIORITY_OPTIONS;
    return [];
  }, [field, statusOptions]);

  const isDateField = DATE_FIELDS.includes(field);
  const isMemberField = MEMBER_FIELDS.includes(field);
  const statusSelectionBlocked = field === 'status' && selectableValues.length === 0;
  const hasValidValue = value.trim().length > 0;
  const canApply = hasValidValue && !loading && !statusSelectionBlocked;

  const handleFieldChange = (next: BulkField) => {
    setField(next);
    setValue('');
  };

  const handleApply = async () => {
    if (!hasValidValue || loading) return;
    await onApply(field, value);
    setValue('');
  };

  return (
    <div className="sticky top-2 z-20 mb-4 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2fc6d6]/25 bg-[#2fc6d6]/10 px-2.5 text-xs font-medium text-[#138c92]">
          <CheckSquare className="h-3.5 w-3.5 text-[#2fc6d6]" />
          {selectedCount} selected
        </div>
        <div className="text-xs text-gray-500">
          Will update <span className="font-semibold text-gray-700">{selectedCount}</span> task(s)
        </div>

        <select
          value={field}
          onChange={(e) => handleFieldChange(e.target.value as BulkField)}
          className="h-8 w-[168px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
        >
          {FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {isDateField ? (
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-[168px] rounded-lg border border-gray-200 bg-white pl-9 pr-2 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
            />
          </label>
        ) : isMemberField ? (
          <label className="relative">
            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-[168px] rounded-lg border border-gray-200 bg-white pl-9 pr-2 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
            >
              <option value="">Select member</option>
              {memberOptions.map((member) => (
                <option key={member.id} value={String(member.id)}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={statusSelectionBlocked}
            className="h-8 w-[168px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
          >
            <option value="">
              {statusSelectionBlocked ? 'No valid status transition' : 'Select value'}
            </option>
            {selectableValues.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={!canApply}
          onClick={handleApply}
          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold transition ${canApply
              ? 'bg-gradient-to-r from-[#7ee3e8] to-[#b9ee98] text-white shadow-sm hover:brightness-95'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
        >
          {loading ? 'Applying…' : 'Apply'}
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
      {statusSelectionBlocked && statusDisabledReason ? (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          {statusDisabledReason}
        </div>
      ) : null}
    </div>
  );
}
