'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  options?: string[];
}

const DEFAULT_OPTIONS = [
  'Default',
  'Arial',
  'Helvetica',
  'Inter',
  'Roboto',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Monaco',
];

export default function FontFamilyPicker({ value, onChange, disabled = false, options = DEFAULT_OPTIONS }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Font family"
          title="Font family"
          disabled={disabled}
          className="inline-flex h-8 min-w-[6.5rem] items-center justify-between gap-1 rounded-md px-2 text-xs text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="truncate" style={{ fontFamily: value === 'Default' ? undefined : value }}>
            {value || 'Default'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 w-48 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div role="listbox" aria-label="Font family" className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => {
              const selected = opt === value;
              return (
                <Popover.Close asChild key={opt}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onChange(opt)}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                      selected ? 'bg-[#3CCED7]/10 text-[#0E8A96]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span style={{ fontFamily: opt === 'Default' ? undefined : opt }}>{opt}</span>
                    {selected && <Check className="h-3 w-3 text-[#0E8A96]" aria-hidden="true" />}
                  </button>
                </Popover.Close>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
