'use client';

import type { Platform } from '../types';

type Size = 'sm' | 'md';

interface Props {
  platform: Platform;
  status?: string | null;
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

const KLAVIYO_STYLES: Record<string, PillStyle> = {
  draft: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  ready: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200' },
  scheduled: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  archived: { bg: 'bg-stone-100', text: 'text-stone-600', ring: 'ring-stone-200' },
};

const MAILCHIMP_FREE_STRING_STYLES: Record<string, PillStyle> = {
  save: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  draft: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  schedule: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  paused: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  sending: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200' },
  sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-[11px] px-1.5 py-0.5 leading-4',
  md: 'text-xs px-2 py-0.5 leading-5',
};

const humanize = (value: string): string => {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

function resolveStyle(platform: Platform, status: string | null): PillStyle {
  if (!status) return UNKNOWN_STYLE;
  const key = status.toLowerCase();
  if (platform === 'klaviyo') return KLAVIYO_STYLES[key] ?? UNKNOWN_STYLE;
  return MAILCHIMP_FREE_STRING_STYLES[key] ?? UNKNOWN_STYLE;
}

export default function EmailDraftStatusPill({
  platform,
  status,
  size = 'sm',
}: Props) {
  const normalized = status ?? null;
  const style = resolveStyle(platform, normalized);
  const display = normalized ? humanize(normalized) : 'Draft';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ring-1 font-medium ${SIZE_CLASSES[size]} ${style.bg} ${style.text} ${style.ring}`}
    >
      {display}
    </span>
  );
}
