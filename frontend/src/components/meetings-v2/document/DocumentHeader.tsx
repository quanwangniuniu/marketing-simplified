'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import MeetingStatusPill from '@/components/meetings-v2/MeetingStatusPill';
import type { Meeting } from '@/types/meeting';
import type { WsState } from './useDocumentSocket';

interface ActiveUserChip {
  userId: number;
  username: string;
  color: string;
}

interface Props {
  projectId: number;
  meeting: Meeting;
  wsState: WsState;
  closeCode: number | null;
  saving: boolean;
  lastSyncedAt: string | null;
  editorsOnline: number;
  activeUsers: ActiveUserChip[];
  readOnly: boolean;
}

function formatStatus(
  wsState: WsState,
  closeCode: number | null,
  saving: boolean,
  lastSyncedAt: string | null,
): { dot: string; text: string; label: string } {
  if (closeCode === 4003) {
    return { dot: 'bg-rose-500', text: 'text-rose-700', label: 'No access' };
  }
  if (wsState === 'reconnecting') {
    return { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Reconnecting…' };
  }
  if (wsState === 'closed') {
    return { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Offline' };
  }
  if (wsState === 'connecting') {
    return { dot: 'bg-gray-400', text: 'text-gray-500', label: 'Connecting…' };
  }
  if (saving) {
    return { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Saving…' };
  }
  if (!lastSyncedAt) {
    return { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Live' };
  }
  const d = new Date(lastSyncedAt);
  if (Number.isNaN(d.getTime())) {
    return { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Live' };
  }
  const timeLabel = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { dot: 'bg-emerald-500', text: 'text-emerald-700', label: `Saved · ${timeLabel}` };
}

export default function DocumentHeader({
  projectId,
  meeting,
  wsState,
  closeCode,
  saving,
  lastSyncedAt,
  editorsOnline,
  activeUsers,
  readOnly,
}: Props) {
  const status = formatStatus(wsState, closeCode, saving, lastSyncedAt);
  const archived = meeting.is_archived || meeting.status === 'archived';
  const noAccess = closeCode === 4003;
  const detailHref = `/meetings-v2/${meeting.id}?project_id=${projectId}`;

  return (
    <header className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <nav className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-gray-50 hover:text-gray-900"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          <span className="truncate max-w-[260px]">{meeting.title || 'Meeting'}</span>
        </Link>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>
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
            Editing now: {editorsOnline}
          </span>
          {activeUsers.length > 0 && (
            <div className="inline-flex items-center gap-1">
              {activeUsers.map((u) => (
                <span
                  key={`chip-${u.userId}`}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: u.color }}
                    aria-hidden="true"
                  />
                  {u.username}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {archived && !noAccess && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This meeting is archived. The document is read-only; unarchive the meeting to edit again.
        </div>
      )}

      {noAccess && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          You do not have access to this document. Ask the meeting owner to add you as a
          participant.
        </div>
      )}

      {!archived && !noAccess && wsState === 'reconnecting' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Realtime connection lost. Reconnecting… Offline edits will save on blur.
        </div>
      )}

      {readOnly && !archived && !noAccess && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Read-only mode.
        </div>
      )}
    </header>
  );
}
