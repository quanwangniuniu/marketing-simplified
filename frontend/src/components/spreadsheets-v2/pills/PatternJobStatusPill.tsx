'use client';

import type { PatternJobStatus } from '@/types/patterns';

interface Props {
  status: PatternJobStatus | null | undefined;
  className?: string;
}

const STYLES: Record<PatternJobStatus, { label: string; classes: string }> = {
  queued: {
    label: 'Queued',
    classes: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  },
  running: {
    label: 'Running',
    classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  },
  succeeded: {
    label: 'Succeeded',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  canceled: {
    label: 'Canceled',
    classes: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  },
};

export default function PatternJobStatusPill({ status, className = '' }: Props) {
  if (!status) return null;
  const meta = STYLES[status];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.classes} ${className}`}
    >
      {meta.label}
    </span>
  );
}
