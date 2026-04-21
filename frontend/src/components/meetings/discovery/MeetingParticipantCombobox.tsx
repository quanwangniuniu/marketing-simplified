'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import type { ProjectMemberData } from '@/lib/api/projectApi';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MeetingParticipantComboboxProps {
  value?: number;
  onChange: (userId: number | undefined) => void;
  members: ProjectMemberData[];
  memberLabel: (userId: number) => string;
  disabled?: boolean;
  /** Merged into the trigger button (e.g. full width in filter panel). */
  triggerClassName?: string;
  /** Override default "Filter by participant" (e.g. include vs exclude rows). */
  ariaLabel?: string;
}

/**
 * Searchable single-select for “filter by participant” (URL `participant` = user id).
 * Prefer labels in the list; search matches name, username, email, and id substrings.
 */
export function MeetingParticipantCombobox({
  value,
  onChange,
  members,
  memberLabel,
  disabled,
  triggerClassName,
  ariaLabel,
}: MeetingParticipantComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (value == null || !Number.isFinite(value)) return 'Participants';
    const m = members.find((x) => x.user.id === value);
    if (!m) return memberLabel(value);
    return memberLabel(m.user.id);
  }, [value, members, memberLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? 'Filter by participant'}
          disabled={disabled}
          data-testid="meeting-participant-combobox-trigger"
          className={cn(
            'inline-flex h-10 min-w-[12rem] max-w-[18rem] items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7] disabled:cursor-not-allowed',
            disabled && 'opacity-50',
            triggerClassName,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[60] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No person matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="anyone"
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value == null ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                Anyone
              </CommandItem>
              {members.map((m) => {
                const label = memberLabel(m.user.id);
                const u = m.user;
                const searchBlob = [
                  label,
                  u.name ?? '',
                  u.username ?? '',
                  u.email ?? '',
                  String(u.id),
                ]
                  .join(' ')
                  .trim();
                return (
                  <CommandItem
                    key={m.id}
                    value={`member-${m.user.id} ${searchBlob}`}
                    onSelect={() => {
                      onChange(m.user.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === m.user.id ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
