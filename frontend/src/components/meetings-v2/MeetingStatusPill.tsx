'use client';

import type { MeetingStatus } from '@/types/meeting';

interface Props {
  status: MeetingStatus;
  className?: string;
}

const STATUS_STYLES: Record<MeetingStatus, { label: string; classes: string }> = {
  draft: {
    label: 'Draft',
    classes: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  },
  planned: {
    label: 'Planned',
    classes: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  in_progress: {
    label: 'In progress',
    classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  archived: {
    label: 'Archived',
    classes: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
  },
};

export default function MeetingStatusPill({ status, className = '' }: Props) {
  const meta = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.classes} ${className}`}
    >
      {meta.label}
    </span>
  );
}
