'use client';

import BrandDialog from '@/components/tasks/detail/BrandDialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Tone = 'default' | 'danger';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function BrandConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
}: Props) {
  const confirmClasses =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 border-0'
      : 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white hover:brightness-105 border-0';

  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={title} width="max-w-sm">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </Button>
        <Button
          size="sm"
          className={confirmClasses}
          disabled={loading}
          onClick={() => onConfirm()}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </BrandDialog>
  );
}
