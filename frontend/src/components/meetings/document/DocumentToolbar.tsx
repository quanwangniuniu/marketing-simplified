'use client';

import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from 'lucide-react';

interface Props {
  disabled?: boolean;
  onCommand: (command: string, value?: string) => void;
}

type Btn = {
  key: string;
  label: string;
  command: string;
  value?: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  group: number;
};

const BUTTONS: Btn[] = [
  { key: 'bold', label: 'Bold', command: 'bold', Icon: Bold, group: 1 },
  { key: 'italic', label: 'Italic', command: 'italic', Icon: Italic, group: 1 },
  { key: 'underline', label: 'Underline', command: 'underline', Icon: Underline, group: 1 },
  { key: 'h1', label: 'Heading 1', command: 'formatBlock', value: 'H1', Icon: Heading1, group: 2 },
  { key: 'h2', label: 'Heading 2', command: 'formatBlock', value: 'H2', Icon: Heading2, group: 2 },
  { key: 'ul', label: 'Bullet list', command: 'insertUnorderedList', Icon: List, group: 3 },
  { key: 'ol', label: 'Numbered list', command: 'insertOrderedList', Icon: ListOrdered, group: 3 },
  { key: 'quote', label: 'Quote', command: 'formatBlock', value: 'BLOCKQUOTE', Icon: Quote, group: 3 },
  { key: 'undo', label: 'Undo', command: 'undo', Icon: Undo2, group: 4 },
  { key: 'redo', label: 'Redo', command: 'redo', Icon: Redo2, group: 4 },
];

export default function DocumentToolbar({ disabled = false, onCommand }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-lg bg-gray-50 p-1 ring-1 ring-gray-100"
      onMouseDown={(e) => e.preventDefault()}
      aria-label="Formatting toolbar"
      role="toolbar"
    >
      {BUTTONS.map((btn, idx) => {
        const prev = BUTTONS[idx - 1];
        const needsDivider = prev && prev.group !== btn.group;
        return (
          <span key={btn.key} className="flex items-center">
            {needsDivider ? <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" /> : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onCommand(btn.command, btn.value)}
              aria-label={btn.label}
              title={btn.label}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <btn.Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
