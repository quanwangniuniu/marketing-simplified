'use client';

import * as Popover from '@radix-ui/react-popover';
import { PaintBucket } from 'lucide-react';
import ToolbarIconButton from './ToolbarIconButton';

interface Props {
  value?: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  label?: string;
}

const HIGHLIGHT_SWATCHES = [
  '#FEF3C7',
  '#FDE68A',
  '#FECACA',
  '#FBCFE8',
  '#DDD6FE',
  '#BFDBFE',
  '#A5F3FC',
  '#BBF7D0',
];

export default function HighlightColorPicker({
  value = null,
  onChange,
  disabled = false,
  label = 'Highlight color',
}: Props) {
  const currentSwatch = value || '#FEF08A';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ToolbarIconButton label={label} disabled={disabled}>
          <span className="flex flex-col items-center justify-center gap-0.5">
            <PaintBucket className="h-3.5 w-3.5" aria-hidden="true" />
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
            <div className="grid grid-cols-8 gap-1.5">
              {HIGHLIGHT_SWATCHES.map((hex) => {
                const selected = value && value.toLowerCase() === hex.toLowerCase();
                return (
                  <Popover.Close asChild key={hex}>
                    <button
                      type="button"
                      aria-label={`Highlight ${hex}`}
                      title={hex}
                      onClick={() => onChange(hex)}
                      className={`h-6 w-6 rounded-md border transition hover:scale-110 ${
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
                  Clear highlight
                </button>
              </Popover.Close>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
