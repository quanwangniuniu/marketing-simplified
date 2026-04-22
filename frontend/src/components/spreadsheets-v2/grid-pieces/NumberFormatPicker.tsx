'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';

export type NumberFormatType = 'GENERAL' | 'NUMBER' | 'CURRENCY' | 'PERCENT';

export interface NumberFormatValue {
  type?: NumberFormatType;
  currency_code?: string | null;
  decimal_places?: number | null;
}

interface Props {
  value?: NumberFormatValue | null;
  onChange: (next: NumberFormatValue | null) => void;
  disabled?: boolean;
}

const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'JPY', label: 'JPY (¥)' },
  { code: 'CNY', label: 'CNY (¥)' },
];

const PRESETS: { key: string; label: string; format: NumberFormatValue | null; sample: string }[] = [
  { key: 'general', label: 'General', format: { type: 'GENERAL' }, sample: '1234.56' },
  { key: 'number0', label: 'Number', format: { type: 'NUMBER', decimal_places: 0 }, sample: '1,235' },
  { key: 'number2', label: 'Number (.00)', format: { type: 'NUMBER', decimal_places: 2 }, sample: '1,234.56' },
  { key: 'currencyUSD', label: 'USD', format: { type: 'CURRENCY', currency_code: 'USD', decimal_places: 2 }, sample: '$1,234.56' },
  { key: 'currencyJPY', label: 'JPY', format: { type: 'CURRENCY', currency_code: 'JPY', decimal_places: 0 }, sample: '¥1,235' },
  { key: 'percent0', label: 'Percent', format: { type: 'PERCENT', decimal_places: 0 }, sample: '77%' },
  { key: 'percent2', label: 'Percent (.00)', format: { type: 'PERCENT', decimal_places: 2 }, sample: '77.12%' },
];

function matchesFormat(a: NumberFormatValue | null | undefined, b: NumberFormatValue | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    (a.type ?? 'GENERAL') === (b.type ?? 'GENERAL') &&
    (a.currency_code ?? null) === (b.currency_code ?? null) &&
    (a.decimal_places ?? null) === (b.decimal_places ?? null)
  );
}

export default function NumberFormatPicker({ value, onChange, disabled = false }: Props) {
  const currentLabel = PRESETS.find((p) => matchesFormat(value, p.format))?.label || 'Default';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Number format"
          title="Number format"
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 w-56 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div role="listbox" aria-label="Number format" className="max-h-72 overflow-y-auto py-1">
            {PRESETS.map((preset) => {
              const selected = matchesFormat(value, preset.format);
              return (
                <Popover.Close asChild key={preset.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onChange(preset.format)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition ${
                      selected ? 'bg-[#3CCED7]/10 text-[#0E8A96]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex flex-col">
                      <span>{preset.label}</span>
                      <span className="text-[10px] text-gray-400">{preset.sample}</span>
                    </span>
                    {selected && <Check className="h-3 w-3 text-[#0E8A96]" aria-hidden="true" />}
                  </button>
                </Popover.Close>
              );
            })}
            <div className="mx-3 my-1 border-t border-gray-100" />
            <Popover.Close asChild>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-500 transition hover:bg-gray-50"
              >
                Clear format
              </button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { CURRENCY_OPTIONS };
