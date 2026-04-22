'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export interface BrandSelectOption {
  value: string;
  label: string;
  style?: CSSProperties;
}

interface Props {
  value: string;
  onValueChange: (next: string) => void;
  options: BrandSelectOption[];
  disabled?: boolean;
  ariaLabel: string;
  testId?: string;
  widthClass?: string;
  renderValue?: (value: string) => ReactNode;
  align?: 'start' | 'center' | 'end';
}

export default function BrandSelect({
  value,
  onValueChange,
  options,
  disabled = false,
  ariaLabel,
  testId,
  widthClass = 'min-w-[6rem]',
  renderValue,
  align = 'start',
}: Props) {
  const current = options.find((o) => o.value === value);
  const displayLabel = renderValue ? renderValue(value) : current?.label ?? value ?? '';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          disabled={disabled}
          data-testid={testId}
          className={`inline-flex h-8 items-center justify-between gap-1 rounded-md px-2 text-xs text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:opacity-40 ${widthClass}`}
        >
          <span className="truncate" style={current?.style}>
            {displayLabel}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align={align}
          className="z-[120] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          style={{ minWidth: 'var(--radix-popover-trigger-width)' }}
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <Popover.Close asChild key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onValueChange(opt.value)}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                      selected ? 'bg-[#3CCED7]/10 text-[#0E8A96]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate" style={opt.style}>
                      {opt.label}
                    </span>
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
