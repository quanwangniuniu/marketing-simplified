'use client';

import Link from 'next/link';
import { Video, Settings as SettingsIcon } from 'lucide-react';
import type { ZoomPostMeeting } from '@/types/meeting';

interface Props {
  zoomConnected: boolean;
  zoomPostMeeting: ZoomPostMeeting | null;
  onCreateZoomMeeting?: () => void | Promise<void>;
  creatingZoom: boolean;
}

function statusLabel(code: string | null | undefined): string {
  if (!code) return '';
  if (code === 'scheduled') return 'Scheduled';
  if (code === 'live') return 'Live now';
  if (code === 'ended') return 'Ended';
  return 'Unknown';
}

export default function ZoomPanel({
  zoomConnected,
  zoomPostMeeting,
  onCreateZoomMeeting,
  creatingZoom,
}: Props) {
  const hasZoomData = !!zoomPostMeeting;

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center gap-2">
        <Video className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Zoom
        </h2>
      </header>

      {!zoomConnected && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Connect Zoom in{' '}
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 font-medium text-[#3CCED7] hover:underline"
            >
              Settings
              <SettingsIcon className="h-3 w-3" aria-hidden="true" />
            </Link>{' '}
            to create meetings directly from here.
          </p>
          <button
            type="button"
            disabled
            title="Connect Zoom in Settings first."
            className="inline-flex h-8 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-medium text-gray-400"
          >
            Create Zoom meeting
          </button>
        </div>
      )}

      {zoomConnected && !hasZoomData && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Spin up a Zoom room and get a join link.
          </p>
          <button
            type="button"
            onClick={onCreateZoomMeeting}
            disabled={creatingZoom}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingZoom ? 'Creating…' : 'Create Zoom meeting'}
          </button>
        </div>
      )}

      {zoomConnected && hasZoomData && zoomPostMeeting && (
        <dl className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <dt className="text-gray-400">Status</dt>
            <dd>{statusLabel(zoomPostMeeting.meeting_status)}</dd>
          </div>
          {zoomPostMeeting.duration_minutes != null && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Duration</dt>
              <dd>{zoomPostMeeting.duration_minutes} min</dd>
            </div>
          )}
          {zoomPostMeeting.recording_file_count > 0 && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Recordings</dt>
              <dd>{zoomPostMeeting.recording_file_count} file(s)</dd>
            </div>
          )}
          {zoomPostMeeting.has_transcript_asset && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Transcript</dt>
              <dd>Available</dd>
            </div>
          )}
          {zoomPostMeeting.sync_error && (
            <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
              {zoomPostMeeting.sync_error.slice(0, 200)}
            </p>
          )}
        </dl>
      )}
    </section>
  );
}
