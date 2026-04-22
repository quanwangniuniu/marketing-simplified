'use client';

import type { VariationStatus } from '@/types/adVariation';

interface Props {
  status: VariationStatus;
  className?: string;
}

const STYLES: Record<VariationStatus, { label: string; classes: string }> = {
  Draft: {
    label: 'Draft',
    classes: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  },
  Testing: {
    label: 'Testing',
    classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  },
  Live: {
    label: 'Live',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  Winner: {
    label: 'Winner',
    classes: 'bg-[#3CCED7]/10 text-[#0E8A96] ring-1 ring-[#3CCED7]/30',
  },
  Loser: {
    label: 'Loser',
    classes: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  Paused: {
    label: 'Paused',
    classes: 'bg-gray-100 text-gray-600 ring-1 ring-gray-300',
  },
};

export default function AdVariationStatusPill({ status, className = '' }: Props) {
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
