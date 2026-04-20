'use client';

import Link from 'next/link';
import { ArrowLeft, Users, CalendarDays, ExternalLink } from 'lucide-react';
import type { Meeting, MeetingStatus } from '@/types/meeting';
import MeetingStatusPill from '@/components/meetings-v2/MeetingStatusPill';
import MeetingFSMActionBar from './MeetingFSMActionBar';

interface Props {
  projectId: number;
  meeting: Meeting;
  availableTransitions: string[];
  participantsCount: number;
  agendaCount: number;
  unresolvedActionItems: number;
  onTransitioned: (nextStatus: MeetingStatus, nextAvailable: string[]) => void;
  onOpenDocument: () => void;
}

function formatScheduled(date: string | null, time: string | null): string {
  if (!date) return 'Unscheduled';
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Unscheduled';
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!time) return datePart;
  const m = time.match(/^(\d{2}):(\d{2})/);
  if (!m) return datePart;
  const hour = Number(m[1]);
  const mm = m[2];
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${datePart} · ${display}:${mm}${suffix}`;
}

export default function MeetingDetailHeader({
  projectId,
  meeting,
  availableTransitions,
  participantsCount,
  agendaCount,
  unresolvedActionItems,
  onTransitioned,
  onOpenDocument,
}: Props) {
  const scheduled = formatScheduled(meeting.scheduled_date, meeting.scheduled_time);

  const preCheck = (target: string): string | null => {
    if (target === 'in_progress' && participantsCount < 1) {
      return 'Add at least one participant first.';
    }
    if (target === 'completed') {
      if (!meeting.objective?.trim())
        return 'Set a non-empty objective before completing.';
      if (agendaCount < 1) return 'Add at least one agenda item before completing.';
    }
    if (target === 'archived' && unresolvedActionItems > 0) {
      return `Resolve ${unresolvedActionItems} action item(s) before archiving.`;
    }
    return null;
  };

  return (
    <header className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <nav className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <Link
          href={`/meetings-v2?project_id=${projectId}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-gray-50 hover:text-gray-900"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          <span>Meetings</span>
        </Link>
        <button
          type="button"
          onClick={onOpenDocument}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-3 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
        >
          <span>Open document</span>
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </button>
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold leading-tight text-gray-900">
            {meeting.title || 'Untitled meeting'}
          </h1>
          <MeetingStatusPill status={meeting.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {meeting.meeting_type && (
            <span className="inline-flex items-center rounded-full bg-[#3CCED7]/10 px-2 py-0.5 text-[11px] font-medium text-[#0E8A96]">
              {meeting.meeting_type}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            {scheduled}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {participantsCount} {participantsCount === 1 ? 'participant' : 'participants'}
          </span>
        </div>
      </div>

      <MeetingFSMActionBar
        projectId={projectId}
        meetingId={meeting.id}
        currentStatus={meeting.status}
        availableTransitions={availableTransitions}
        preCheck={preCheck}
        onTransitioned={onTransitioned}
      />
    </header>
  );
}
