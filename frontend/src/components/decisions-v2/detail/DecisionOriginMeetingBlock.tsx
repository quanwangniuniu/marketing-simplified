'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type { OriginMeetingPayload } from '@/types/meeting';

interface Props {
  origin?: OriginMeetingPayload | null;
  projectId?: number | null;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DecisionOriginMeetingBlock({ origin, projectId }: Props) {
  if (!origin || !origin.id) return null;

  const meetingId = origin.id;
  const href = projectId
    ? `/projects/${projectId}/meetings/${meetingId}`
    : `/projects/meetings/${meetingId}`;

  const title = origin.title?.trim() || 'Meeting';
  const dateLabel = formatDate((origin as any).scheduled_date ?? (origin as any).scheduled_start);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Origin meeting
      </h3>
      <Link
        href={href}
        className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition hover:bg-gray-50"
      >
        <CalendarDays
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 group-hover:text-[#3CCED7]"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900 group-hover:text-[#3CCED7]">
            {title}
          </div>
          {dateLabel && <div className="text-[11px] text-gray-500">{dateLabel}</div>}
        </div>
      </Link>
    </section>
  );
}
