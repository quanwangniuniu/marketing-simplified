'use client';

import type { ReactElement } from 'react';

import { formatLastSyncedTooltip } from '@/components/meta-ads/metaAdsUtils';

/**
 * Hover tooltip showing when ads data was last synced (MED-246).
 * Uses a CSS hover panel (plus native title) so QA can verify without Ads API keys
 * as long as `lastSyncedAt` is present from status / sync-run payloads.
 */
export default function LastSyncTimeTooltip({
  lastSyncedAt,
  children,
}: {
  lastSyncedAt: string | null | undefined;
  children: ReactElement;
}) {
  const label = formatLastSyncedTooltip(lastSyncedAt);

  return (
    <div className="relative inline-flex group">
      <div title={label} aria-label={label}>
        {children}
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </div>
    </div>
  );
}
