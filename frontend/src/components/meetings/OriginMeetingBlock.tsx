'use client';

import Link from 'next/link';

import type { OriginMeetingPayload } from '@/types/meeting';
import { useBuildUrl } from '@/lib/buildUrl';

/**
 * Task / decision detail: shows provenance meeting or empty state.
 * Backend keeps **origin** (generated) and **related** (ArtifactLink) separate; related lists exclude origin ids.
 */
export function OriginMeetingBlock({
  origin,
}: {
  origin: OriginMeetingPayload | null | undefined;
}) {
  const buildUrl = useBuildUrl();
  if (!origin) {
    return (
      <section
        className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600"
        data-testid="origin-meeting-empty"
      >
        No origin meeting recorded
      </section>
    );
  }

  const href = buildUrl(origin.detail_url ?? origin.url);

  return (
    <section className="space-y-2" data-testid="origin-meeting-card">
      <h3 className="text-sm font-semibold text-gray-900">Origin meeting</h3>
      <Link
        href={href}
        className="block rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
      >
        <div className="font-medium text-indigo-700 hover:underline">{origin.title}</div>
        {origin.scheduled_date ? (
          <div className="mt-1 text-xs text-slate-500">Date: {origin.scheduled_date}</div>
        ) : null}
        {origin.type ? (
          <div className="mt-0.5 text-xs text-slate-500">Type: {origin.type}</div>
        ) : null}
      </Link>
    </section>
  );
}
