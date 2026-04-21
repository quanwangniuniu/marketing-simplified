'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import type { KnowledgeNavigationLink } from '@/types/meeting';
import { taskWorkspaceCreateFromMeetingHref } from '@/lib/tasks/taskWorkspaceDeepLinks';

function MetaLine({ children }: { children: ReactNode }) {
  return <div className="text-xs text-slate-500">{children}</div>;
}

/**
 * Full meeting workspace: generated tasks & decisions (origin only), with empty copy per product spec.
 */
export function MeetingGeneratedKnowledgeSection({
  generatedTasks = [],
  generatedDecisions = [],
  projectId,
  meetingId,
}: {
  generatedTasks?: KnowledgeNavigationLink[];
  generatedDecisions?: KnowledgeNavigationLink[];
  projectId: number;
  meetingId: number;
}) {
  return (
    <div
      id="contextual-knowledge"
      className="scroll-mt-24 grid gap-4 md:grid-cols-2"
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Generated tasks</h3>
          <Link
            href={taskWorkspaceCreateFromMeetingHref(projectId, meetingId)}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            Create task from this meeting
          </Link>
        </div>
        {generatedTasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks generated from this meeting</p>
        ) : (
          <ul className="space-y-2">
            {generatedTasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.detail_url ?? t.url}
                  className="block rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50/60 hover:underline"
                >
                  {t.title}
                  {t.status || t.assignee_name != null ? (
                    <MetaLine>
                      {[t.status ? `Status: ${t.status}` : null, t.assignee_name != null ? `Assignee: ${t.assignee_name}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </MetaLine>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Generated decisions</h3>
          <Link
            href={`/decisions?project_id=${projectId}&origin_meeting_id=${meetingId}`}
            className="text-xs font-medium text-[#1a9ba3] hover:underline"
          >
            Create decision from this meeting
          </Link>
        </div>
        {generatedDecisions.length === 0 ? (
          <p className="text-sm text-gray-500">No decisions generated from this meeting</p>
        ) : (
          <ul className="space-y-2">
            {generatedDecisions.map((d) => (
              <li key={d.id}>
                <Link
                  href={d.detail_url ?? d.url}
                  className="block rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-[#1a9ba3] hover:bg-[#3CCED7]/10/60 hover:underline"
                >
                  {d.title}
                  {d.status ? <MetaLine>Status: {d.status}</MetaLine> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
