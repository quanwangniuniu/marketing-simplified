/**
 * User-facing labels and short descriptions for Zoom post-meeting API payloads.
 * Keeps raw enum values out of JSX.
 */

import type {
  ZoomPostMeeting,
  ZoomPostMeetingMeetingStatus,
  ZoomPostMeetingRecordingStatus,
  ZoomPostMeetingSummaryStatus,
  ZoomPostMeetingSyncState,
} from '@/types/meeting';

export type TopBannerVariant = 'warning' | 'neutral' | 'processing';

export interface TopBanner {
  text: string;
  variant: TopBannerVariant;
  showSettingsLink?: boolean;
}

function asSyncState(raw: string | undefined): ZoomPostMeetingSyncState | null {
  if (
    raw === 'never' ||
    raw === 'in_progress' ||
    raw === 'ok' ||
    raw === 'partial' ||
    raw === 'error'
  ) {
    return raw;
  }
  return null;
}

export function labelSyncState(raw: string | undefined): string {
  const s = asSyncState(raw);
  if (!s) return raw?.trim() ? raw : '—';
  switch (s) {
    case 'never':
      return 'Not synced yet';
    case 'in_progress':
      return 'Syncing…';
    case 'ok':
      return 'Synced';
    case 'partial':
      return 'Partially synced';
    case 'error':
      return 'Sync failed';
    default:
      return '—';
  }
}

export function labelMeetingStatus(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '—';
  switch (s as ZoomPostMeetingMeetingStatus) {
    case 'unknown':
      return 'Unknown';
    case 'scheduled':
      return 'Scheduled';
    case 'live':
      return 'Live';
    case 'ended':
      return 'Ended';
    default:
      return s.replace(/_/g, ' ');
  }
}

export function labelRecordingStatusShort(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '—';
  switch (s as ZoomPostMeetingRecordingStatus) {
    case 'unknown':
      return 'Not yet available';
    case 'none':
      return 'No recording';
    case 'processing':
      return 'Processing';
    case 'available':
      return 'Available';
    case 'deleted':
      return 'Removed';
    default:
      return s.replace(/_/g, ' ');
  }
}

export function labelSummaryStatusShort(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '—';
  switch (s as ZoomPostMeetingSummaryStatus) {
    case 'not_applicable':
      return 'Not available';
    case 'pending':
      return 'Pending';
    case 'available':
      return 'Available';
    case 'failed':
      return 'Unavailable';
    default:
      return s.replace(/_/g, ' ');
  }
}

/**
 * Top banner: product-level only; no API/HTTP/raw sync_error. Omits redundant per-module notices when sync is ok.
 */
export function resolveTopBanner(
  z: ZoomPostMeeting | null,
  linked: boolean,
): TopBanner | null {
  if (!linked) {
    return {
      text: 'Zoom is not connected for this meeting.',
      variant: 'warning',
    };
  }
  if (!z) return null;

  const sync = asSyncState(z.sync_state);
  const code = z.user_feedback_code;

  if (code === 'auth_expired') {
    return {
      text: 'Zoom access has expired. Please reconnect your account.',
      variant: 'warning',
      showSettingsLink: true,
    };
  }

  if (sync === 'error') {
    return {
      text: "We couldn't sync Zoom data for this meeting. Try again later.",
      variant: 'warning',
    };
  }

  if (sync === 'partial') {
    return {
      text: 'Basic Zoom meeting details are synced, but some additional details are unavailable.',
      variant: 'neutral',
    };
  }

  if (sync === 'never' || sync === 'in_progress') {
    return {
      text: 'Meeting data from Zoom is still being processed.',
      variant: 'processing',
    };
  }

  if (code === 'error') {
    return {
      text: 'Some Zoom post-meeting details could not be retrieved.',
      variant: 'warning',
    };
  }

  // sync ok: suppress banner for sub-domain-only codes (details live in modules)
  if (sync === 'ok') {
    if (
      code === 'not_applicable' ||
      code === 'unavailable' ||
      code === 'pending' ||
      code === null
    ) {
      return null;
    }
  }

  return null;
}

/** Badge line for participant row (no raw enums). */
export function participantBadgeParts(z: ZoomPostMeeting): string {
  const n = z.actual_participants_count;
  const breakdown = z.participant_breakdown_count;
  if (z.participants?.length) {
    const parts: string[] = [];
    if (n != null) parts.push(`${n} from Zoom`);
    else parts.push(`${z.participants.length} listed`);
    if (breakdown > 0) parts.push(`${breakdown} with details`);
    return parts.join(' · ');
  }
  if (n != null) return `${n} from Zoom`;
  return 'Unavailable';
}

export function participantSecondaryLine(z: ZoomPostMeeting): string | null {
  if (z.participants?.length) return null;
  return 'Participant details are unavailable for this meeting.';
}

export function recordingBadgeParts(z: ZoomPostMeeting): string {
  const label = labelRecordingStatusShort(z.recording_status);
  const fc =
    z.recording_file_count != null ? `${z.recording_file_count} file${z.recording_file_count === 1 ? '' : 's'}` : '';
  return fc ? `${label} · ${fc}` : label;
}

export function recordingSecondaryLine(z: ZoomPostMeeting): string | null {
  if (z.recording_files?.length) return null;
  const rs = z.recording_status as ZoomPostMeetingRecordingStatus;
  const sync = asSyncState(z.sync_state);
  switch (rs) {
    case 'processing':
      return 'Recording is still processing in Zoom.';
    case 'none':
      return 'There is no cloud recording for this meeting.';
    case 'deleted':
      return 'Recording is no longer available.';
    case 'available':
      return 'No recording files are linked yet.';
    case 'unknown':
    default:
      if (sync === 'partial') {
        return 'Recording details could not be fully retrieved for this meeting.';
      }
      return 'Recording details are not yet available.';
  }
}

export function summaryBadgeParts(z: ZoomPostMeeting): string {
  return labelSummaryStatusShort(z.summary_status);
}

export function summarySecondaryLine(z: ZoomPostMeeting): string | null {
  if (z.summary_text?.trim()) return null;
  const ss = z.summary_status as ZoomPostMeetingSummaryStatus;
  switch (ss) {
    case 'not_applicable':
      return 'A summary is not available for this meeting.';
    case 'pending':
      return 'Summary is being generated.';
    case 'failed':
      return 'Summary could not be generated.';
    case 'available':
      return 'No summary text was returned.';
    default:
      return 'Summary is not available yet.';
  }
}
