'use client';

import type { AdStatus, Platform } from '../types';

type Size = 'sm' | 'md';

interface Props {
  platform: Platform;
  status?: AdStatus | string | null;
  statusLabel?: string;
  size?: Size;
}

interface PillStyle {
  bg: string;
  text: string;
  ring: string;
}

const UNKNOWN_STYLE: PillStyle = {
  bg: 'bg-gray-50',
  text: 'text-gray-500',
  ring: 'ring-gray-200',
};

const FACEBOOK_STYLES: Record<string, PillStyle> = {
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  IN_PROCESS: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  WITH_ISSUES: { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200' },
  DELETED: { bg: 'bg-gray-50', text: 'text-gray-500', ring: 'ring-gray-200' },
};

const GOOGLE_ADS_STYLES: Record<string, PillStyle> = {
  DRAFT: { bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200' },
  PENDING_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  APPROVED: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200' },
  PUBLISHED: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  PAUSED: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-[11px] px-1.5 py-0.5 leading-4',
  md: 'text-xs px-2 py-0.5 leading-5',
};

function resolveStyle(platform: Platform, status?: string | null): PillStyle {
  if (!status) return UNKNOWN_STYLE;
  if (platform === 'facebook_meta') return FACEBOOK_STYLES[status] ?? UNKNOWN_STYLE;
  if (platform === 'google_ads') return GOOGLE_ADS_STYLES[status] ?? UNKNOWN_STYLE;
  return UNKNOWN_STYLE;
}

export default function AdDraftStatusPill({
  platform,
  status,
  statusLabel,
  size = 'sm',
}: Props) {
  if (platform === 'tiktok') return null;

  const style = resolveStyle(platform, status ?? null);
  const display = statusLabel ?? status ?? 'Unknown';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ring-1 font-medium ${SIZE_CLASSES[size]} ${style.bg} ${style.text} ${style.ring}`}
    >
      {display}
    </span>
  );
}
