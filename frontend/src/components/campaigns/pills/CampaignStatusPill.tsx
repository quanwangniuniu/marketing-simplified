'use client';

import type { CampaignStatus } from '@/types/campaign';

interface Props {
  status: CampaignStatus;
  className?: string;
}

const STYLES: Record<CampaignStatus, { label: string; classes: string }> = {
  PLANNING: {
    label: 'Planning',
    classes: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  },
  TESTING: {
    label: 'Testing',
    classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  },
  SCALING: {
    label: 'Scaling',
    classes: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
  },
  OPTIMIZING: {
    label: 'Optimizing',
    classes: 'bg-[#3CCED7]/10 text-[#0E8A96] ring-1 ring-[#3CCED7]/30',
  },
  PAUSED: {
    label: 'Paused',
    classes: 'bg-gray-200 text-gray-800 ring-1 ring-gray-300',
  },
  COMPLETED: {
    label: 'Completed',
    classes: 'bg-[#A6E661]/20 text-[#3F6B1F] ring-1 ring-[#A6E661]/40',
  },
  ARCHIVED: {
    label: 'Archived',
    classes: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200 italic',
  },
};

export default function CampaignStatusPill({ status, className = '' }: Props) {
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
