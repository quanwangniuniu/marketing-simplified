'use client';

import { ArrowUpDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  MEETING_SORT_OPTIONS,
  type MeetingSortKey,
} from '@/lib/meetings/meetingSectionSort';

export type MeetingsSortMenuProps = {
  value: MeetingSortKey;
  onChange: (value: MeetingSortKey) => void;
  /** e.g. "Sort incoming meetings" for aria-label suffix */
  ariaLabelContext: string;
  disabled?: boolean;
};

export function MeetingsSortMenu({
  value,
  onChange,
  ariaLabelContext,
  disabled,
}: MeetingsSortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors',
            'hover:bg-slate-100 hover:text-slate-900',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30',
            disabled && 'pointer-events-none opacity-50',
          )}
          aria-label={`Sort ${ariaLabelContext}`}
        >
          <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
          <span>Sort</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as MeetingSortKey)}
        >
          {MEETING_SORT_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
