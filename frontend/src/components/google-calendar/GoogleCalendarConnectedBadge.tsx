import React from "react";

const SYNC_HELP =
  "Changes sync to Google when you save events. Imports from Google run periodically.";

type GoogleCalendarConnectedBadgeProps = {
  googleEmail?: string | null;
};

export function GoogleCalendarConnectedBadge({
  googleEmail,
}: GoogleCalendarConnectedBadgeProps) {
  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-800 shadow-sm"
      title={SYNC_HELP}
      aria-label={
        googleEmail
          ? `Google Calendar connected, ${googleEmail}. ${SYNC_HELP}`
          : `Google Calendar connected. ${SYNC_HELP}`
      }
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <span className="shrink-0 font-medium">Google Calendar</span>
      {googleEmail ? (
        <>
          <span className="shrink-0 text-gray-400" aria-hidden>
            ·
          </span>
          <span className="min-w-0 truncate text-gray-500" title={googleEmail}>
            {googleEmail}
          </span>
        </>
      ) : null}
    </span>
  );
}
