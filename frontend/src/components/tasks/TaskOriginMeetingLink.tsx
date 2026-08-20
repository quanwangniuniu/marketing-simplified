'use client';

import Link from 'next/link';

import type { OriginMeetingPayload } from '@/types/meeting';
import { useBuildUrl } from '@/lib/buildUrl';

export function TaskOriginMeetingLink({ origin }: { origin: OriginMeetingPayload }) {
  const buildUrl = useBuildUrl();
  const href = buildUrl(origin.detail_url ?? origin.url);
  return (
    <p className="mt-1 text-sm text-slate-500" data-testid="task-origin-meeting">
      Origin meeting{' '}
      <Link
        href={href}
        className="text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        {origin.title}
      </Link>
    </p>
  );
}
