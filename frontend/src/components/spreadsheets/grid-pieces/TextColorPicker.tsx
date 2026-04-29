'use client';

import * as Popover from '@radix-ui/react-popover';
import { Palette } from 'lucide-react';
import ToolbarIconButton from './ToolbarIconButton';

interface Props {
  value?: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  label?: string;
  icon?: 'palette' | 'fill';
}

const COLOR_ROWS: string[][] = [
  ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6', '#FFFFFF'],
  ['#991B1B', '#DC2626', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2'],
  ['#92400E', '#D97706', '#FBBF24', '#FCD34D', '#FDE68A', '#FEF3C7', '#FFFBEB'],
  ['#166534', '#16A34A', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7', '#F0FDF4'],
  ['#155E75', '#0891B2', '#22D3EE', '#67E8F9', '#A5F3FC', '#CFFAFE', '#ECFEFF'],
  ['#1E40AF', '#2563EB', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF'],
  ['#5B21B6', '#7C3AED', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE', '#F5F3FF'],
];

export default function TextColorPicker({
  value = null,
  onChange,
  disabled = false,
  label = 'Text color',
  icon = 'palette',
}: Props) {
  const currentSwatch = value || '#111827';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ToolbarIconButton label={label} disabled={disabled}>
          <span className="flex flex-col items-center justify-center gap-0.5">
            <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            <span
              className="h-[3px] w-4 rounded-sm"
              style={{ backgroundColor: currentSwatch }}
              aria-hidden="true"
            />
          </span>
        </ToolbarIconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="p-2">
            <div className="grid grid-rows-7 gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {COLOR_ROWS.flat().map((hex) => {
                const selected = value && value.toLowerCase() === hex.toLowerCase();
                return (
                  <Popover.Close asChild key={hex}>
                    <button
                      type="button"
                      aria-label={`Color ${hex}`}
                      title={hex}
                      onClick={() => onChange(hex)}
                      className={`h-5 w-5 rounded-md border transition hover:scale-110 ${
                        selected ? 'ring-2 ring-[#3CCED7] ring-offset-1' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  </Popover.Close>
                );
              })}
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <Popover.Close asChild>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="w-full rounded-md px-2 py-1 text-left text-xs text-gray-600 transition hover:bg-gray-50"
                >
                  Reset color
                </button>
              </Popover.Close>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
