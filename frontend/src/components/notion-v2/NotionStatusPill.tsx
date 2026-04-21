'use client';

import React from 'react';
import type { DraftStatus } from '@/types/notion';

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  draft: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    label: 'Draft',
  },
  published: {
    bg: 'bg-[#A6E661]/15',
    text: 'text-green-700',
    border: 'border-[#A6E661]/40',
    label: 'Published',
  },
  archived: {
    bg: 'bg-zinc-50',
    text: 'text-zinc-500',
    border: 'border-zinc-200',
    label: 'Archived',
  },
};

interface NotionStatusPillProps {
  status: DraftStatus | string | null | undefined;
  className?: string;
}

export default function NotionStatusPill({ status, className = '' }: NotionStatusPillProps) {
  const style = STATUS_STYLES[status || 'draft'] || STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {style.label}
    </span>
  );
}
