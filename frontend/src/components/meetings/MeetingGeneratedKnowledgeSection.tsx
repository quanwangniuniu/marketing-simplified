'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import type { KnowledgeNavigationLink } from '@/types/meeting';
import { Id } from '@/types/common';
import { taskWorkspaceCreateFromMeetingHref } from '@/lib/tasks/taskWorkspaceDeepLinks';
import { nestedProjectPath } from '@/lib/projectNestedRoutes';
import { decisionCaptureAPI } from '@/lib/api';
import { useBuildUrl } from '@/lib/buildUrl';

function MetaLine({ children }: { children: ReactNode }) {
  return <div className="text-xs text-slate-500">{children}</div>;
}

type CreatedDecisionResponse = {
  id?: number;
  slug?: string;
  title?: string;
  status?: string;
  detail_url?: string;
  url?: string;
};

function decisionToKnowledgeLink(
  decision: CreatedDecisionResponse,
  projectId: Id
): KnowledgeNavigationLink | null {
  if (!decision.id) return null;

  const url =
    decision.detail_url ??
    decision.url ??
    nestedProjectPath(projectId, `/decisions/${decision.slug}`);

  return {
    id: decision.id,
    title: decision.title || 'Untitled decision',
    status: decision.status,
    url,
    detail_url: url,
  } as KnowledgeNavigationLink;
}

/**
 * Full meeting workspace: generated tasks & decisions (origin only), with empty copy per product spec.
 */
export function MeetingGeneratedKnowledgeSection({
  generatedTasks = [],
  generatedDecisions = [],
  projectId,
  meetingId,
  meetingTitle,
  meetingSummary,
}: {
  generatedTasks?: KnowledgeNavigationLink[];
  generatedDecisions?: KnowledgeNavigationLink[];
  projectId: Id;
  meetingId: Id;
  meetingTitle?: string;
  meetingSummary?: string;
}) {
  const buildUrl = useBuildUrl();
  const [localGeneratedDecisions, setLocalGeneratedDecisions] = useState(generatedDecisions);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [contextSummary, setContextSummary] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  useEffect(() => {
    setLocalGeneratedDecisions(generatedDecisions);
  }, [generatedDecisions]);

  const decisionTitlePlaceholder = useMemo(
    () => `Decision from ${meetingTitle?.trim() || 'this meeting'}`,
    [meetingTitle]
  );

  const contextSummaryPlaceholder = useMemo(
    () =>
      meetingSummary?.trim()
        ? 'Summarize the decision and reasoning from this meeting summary...'
        : 'Summarize the decision and reasoning from this meeting...',
    [meetingSummary]
  );

  const openCapture = () => {
    setDecisionTitle('');
    setContextSummary('');
    setCaptureOpen(true);
  };

  const cancelCapture = () => {
    if (savingDecision) return;
    setCaptureOpen(false);
  };

  const saveDecision = async () => {
    setSavingDecision(true);
    try {
      const created = await decisionCaptureAPI.createDecisionFromMeeting(projectId, meetingId, {
        title: decisionTitle,
        contextSummary,
      });

      const link = decisionToKnowledgeLink(created, projectId);
      if (link) {
        setLocalGeneratedDecisions((current) => [
          link,
          ...current.filter((item) => item.id !== link.id),
        ]);
      }

      toast.success('Decision captured from meeting');
      setCaptureOpen(false);
    } catch (error) {
      console.error('Failed to capture decision from meeting', error);
      toast.error('Could not capture decision');
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <div
      id="contextual-knowledge"
      className="scroll-mt-24 grid gap-4 md:grid-cols-2"
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Generated tasks</h3>
          <Link
            href={buildUrl(taskWorkspaceCreateFromMeetingHref(projectId, meetingId))}
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
                  href={buildUrl(t.detail_url ?? t.url)}
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
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Generated decisions</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Capture formal decisions without leaving this meeting.
            </p>
          </div>
          <button
            type="button"
            onClick={captureOpen ? cancelCapture : openCapture}
            className="rounded-md border border-[#3CCED7]/40 px-3 py-1.5 text-xs font-medium text-[#1a9ba3] transition hover:bg-[#3CCED7]/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingDecision}
          >
            {captureOpen ? 'Cancel' : 'Capture decision'}
          </button>
        </div>

        {captureOpen ? (
          <div className="mb-4 rounded-xl border border-[#3CCED7]/30 bg-[#3CCED7]/5 p-3">
            <label className="block text-xs font-medium text-slate-700">
              Decision title
              <input
                value={decisionTitle}
                onChange={(event) => setDecisionTitle(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
                placeholder={decisionTitlePlaceholder}
                disabled={savingDecision}
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-slate-700">
              Context summary
              <textarea
                value={contextSummary}
                onChange={(event) => setContextSummary(event.target.value)}
                className="mt-1 min-h-[88px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
                placeholder={contextSummaryPlaceholder}
                disabled={savingDecision}
              />
            </label>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelCapture}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-white"
                disabled={savingDecision}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDecision}
                className="rounded-md bg-[#1a9ba3] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168890] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingDecision || !decisionTitle.trim()}
              >
                {savingDecision ? 'Capturing…' : 'Save decision'}
              </button>
            </div>
          </div>
        ) : null}

        {localGeneratedDecisions.length === 0 ? (
          <p className="text-sm text-gray-500">No decisions generated from this meeting</p>
        ) : (
          <ul className="space-y-2">
            {localGeneratedDecisions.map((d) => (
              <li key={d.id}>
                <Link
                  href={buildUrl(d.detail_url ?? d.url)}
                  className="block rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-[#1a9ba3] hover:bg-[#3CCED7]/10 hover:underline"
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
