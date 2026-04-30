'use client';

import type { TemplateSharingScope } from '@/types/campaign';

interface Props {
  scope: TemplateSharingScope;
  className?: string;
}

const STYLES: Record<TemplateSharingScope, { label: string; classes: string; note?: string }> = {
  PERSONAL: {
    label: 'Personal',
    classes: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  },
  TEAM: {
    label: 'Team',
    classes: 'bg-[#3CCED7]/10 text-[#0E8A96] ring-1 ring-[#3CCED7]/30',
  },
  ORGANIZATION: {
    label: 'Organization',
    classes: 'bg-[#A6E661]/20 text-[#3F6B1F] ring-1 ring-[#A6E661]/40',
    note: 'behaves like Team',
  },
};

export default function SharingScopePill({ scope, className = '' }: Props) {
  const meta = STYLES[scope];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.classes} ${className}`}
      title={meta.note}
    >
      {meta.label}
    </span>
  );
}
