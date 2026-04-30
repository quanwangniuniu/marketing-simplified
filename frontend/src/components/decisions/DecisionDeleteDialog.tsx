'use client';

import { Loader2 } from 'lucide-react';
import BrandDialog from '@/components/tasks/detail/BrandDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function DecisionDeleteDialog({
  open,
  onOpenChange,
  title,
  busy = false,
  onConfirm,
}: Props) {
  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete decision"
      subtitle={`This will soft-delete "${title || 'Untitled decision'}" and remove its calendar events. Decision history is preserved.`}
    >
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </BrandDialog>
  );
}
