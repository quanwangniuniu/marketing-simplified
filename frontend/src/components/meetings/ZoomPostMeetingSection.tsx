'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import type { ZoomPostMeeting } from '@/types/meeting';

import {
  labelMeetingStatus,
  labelSyncState,
  participantBadgeParts,
  participantSecondaryLine,
  recordingBadgeParts,
  recordingSecondaryLine,
  resolveTopBanner,
  summaryBadgeParts,
  summarySecondaryLine,
} from '@/components/meetings/zoomPostMeetingPresentation';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const bannerClassName: Record<'warning' | 'neutral' | 'processing', string> = {
  warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
  processing: 'border-sky-100 bg-sky-50/90 text-sky-950',
};

export interface ZoomPostMeetingSectionProps {
  zoomPostMeeting: ZoomPostMeeting | null | undefined;
}

export function ZoomPostMeetingSection({ zoomPostMeeting }: ZoomPostMeetingSectionProps) {
  const linked = zoomPostMeeting != null;
  const top = resolveTopBanner(zoomPostMeeting ?? null, linked);
  const z = zoomPostMeeting;

  return (
    <div className="space-y-4">
      {top ? (
        <p
          className={`rounded-md border px-2.5 py-2 text-xs ${bannerClassName[top.variant]}`}
        >
          {top.text}
          {top.showSettingsLink ? (
            <>
              {' '}
              <Link href="/settings?open_zoom=1" className="font-medium text-[#1a9ba3] underline">
                Settings
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {!linked ? (
        <p className="text-xs text-slate-500">
          Link this meeting to Zoom from the section above to see post-meeting status, recordings, and summary
          here.
        </p>
      ) : (
        <>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <span className="font-medium text-slate-600">Meeting status</span>
              <p className="mt-0.5 text-slate-800">{labelMeetingStatus(z?.meeting_status)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-600">Sync</span>
              <p className="mt-0.5 text-slate-800">
                {labelSyncState(z?.sync_state)}
                {z?.last_sync_at ? (
                  <span className="block text-[11px] text-slate-500">
                    Last synced: {formatWhen(z.last_sync_at)}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="font-medium text-slate-600">Actual time & duration</span>
              <p className="mt-0.5 text-slate-800">
                {formatWhen(z?.start_time ?? null)} — {formatWhen(z?.end_time ?? null)}
                {z?.duration_minutes != null ? (
                  <span className="ml-1 text-slate-600">({z.duration_minutes} min)</span>
                ) : null}
              </p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-medium text-slate-600">Participants</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {z ? participantBadgeParts(z) : '—'}
              </span>
            </div>
            {z?.participants?.length ? (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5">
                {z.participants.map((p, i) => (
                  <li key={`${p.email ?? ''}-${p.name ?? ''}-${i}`} className="text-xs text-slate-800">
                    <span className="font-medium">{p.name?.trim() || '—'}</span>
                    {p.email ? (
                      <span className="ml-2 text-slate-600">{p.email}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : z ? (
              <p className="mt-1 text-[11px] text-slate-500">{participantSecondaryLine(z)}</p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Recording</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {z ? recordingBadgeParts(z) : '—'}
              </span>
            </div>
            {z?.recording_files?.length ? (
              <ul className="mt-2 space-y-1.5">
                {z.recording_files.map((f, i) => (
                  <li
                    key={`${f.download_url ?? ''}-${f.play_url ?? ''}-${i}`}
                    className="flex flex-wrap items-center gap-2 text-xs text-slate-800"
                  >
                    <span className="text-slate-600">
                      {[f.file_type, f.recording_type].filter(Boolean).join(' · ') || 'File'}
                    </span>
                    {f.download_url ? (
                      <a
                        href={f.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[#1a9ba3] underline"
                      >
                        Download
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {f.play_url ? (
                      <a
                        href={f.play_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[#1a9ba3] underline"
                      >
                        Play
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : z ? (
              <p className="mt-1 text-[11px] text-slate-500">{recordingSecondaryLine(z)}</p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Summary</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {z ? summaryBadgeParts(z) : '—'}
              </span>
            </div>
            {z?.summary_text?.trim() ? (
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-800">
                {z.summary_text}
              </p>
            ) : z ? (
              <p className="mt-1 text-[11px] text-slate-500">{summarySecondaryLine(z)}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
