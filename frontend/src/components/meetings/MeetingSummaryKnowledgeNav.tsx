'use client';

import Link from 'next/link';

import type { KnowledgeNavigationLink } from '@/types/meeting';
import { taskWorkspaceCreateFromMeetingHref } from '@/lib/tasks/taskWorkspaceDeepLinks';

export interface MeetingSummaryKnowledgeNavProps {
  generatedDecisions?: KnowledgeNavigationLink[];
  generatedTasks?: KnowledgeNavigationLink[];
  projectId?: number;
  meetingId?: number;
}

/**
 * Origin-based knowledge navigation (generated decisions / tasks from this meeting).
 */
export function MeetingSummaryKnowledgeNav({
  generatedDecisions = [],
  generatedTasks = [],
  projectId,
  meetingId,
}: MeetingSummaryKnowledgeNavProps) {
  const showCreate =
    projectId != null &&
    meetingId != null &&
    Number.isFinite(projectId) &&
    Number.isFinite(meetingId);

  return (
    <div className="space-y-4" data-testid="meeting-summary-knowledge-nav">
      <section data-testid="meeting-summary-generated-decisions">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Generated decisions
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {generatedDecisions.length > 0 ? (
            generatedDecisions.map((item) => (
              <Link
                key={item.id}
                href={item.detail_url ?? item.url}
                className="truncate text-sm text-blue-600 hover:underline"
              >
                {item.title}
              </Link>
            ))
          ) : (
            <p className="text-sm text-gray-400">No generated decisions</p>
          )}
        </div>
      </section>

      <section className="pt-1" data-testid="meeting-summary-generated-tasks">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Generated tasks
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {generatedTasks.length > 0 ? (
            generatedTasks.map((item) => (
              <Link
                key={item.id}
                href={item.detail_url ?? item.url}
                className="truncate text-sm text-emerald-700 hover:underline"
              >
                {item.title}
              </Link>
            ))
          ) : (
            <p className="text-sm text-gray-400">No generated tasks</p>
          )}
        </div>
      </section>

      {showCreate ? (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
          <Link
            href={taskWorkspaceCreateFromMeetingHref(projectId, meetingId)}
            className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
          >
            Create task from this meeting
          </Link>
          <Link
            href={`/decisions-v2?project_id=${projectId}&origin_meeting_id=${meetingId}`}
            className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100"
          >
            Create decision from this meeting
          </Link>
        </div>
      ) : null}
    </div>
  );
}
