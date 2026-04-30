'use client';

import { Facebook, Target, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PLATFORM_LABEL, type Platform } from './types';

interface Props {
  platform: Platform;
  showLabel?: boolean;
}

const ICON_MAP: Record<Platform, LucideIcon> = {
  facebook_meta: Facebook,
  tiktok: Video,
  google_ads: Target,
};

export default function PlatformBadge({ platform, showLabel = true }: Props) {
  const Icon = ICON_MAP[platform];

  return (
    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-500">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel && <span>{PLATFORM_LABEL[platform]}</span>}
    </span>
  );
}
