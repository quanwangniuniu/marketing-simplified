'use client';

import BrandDialog from './BrandDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
}: Props) {
  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={
            destructive
              ? 'inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50'
              : 'inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50'
          }
        >
          {confirmLabel}
        </button>
      </div>
    </BrandDialog>
  );
}
