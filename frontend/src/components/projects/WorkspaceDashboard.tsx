'use client';

// SMP-472: Project Workspace Dashboard
// Displays Decision / Task / Spreadsheet / Pattern summaries scoped to a single project.
// This is an orientation surface — read-only, no editing, quick navigation only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { WorkspaceAPI, type WorkspaceDashboardData } from '@/lib/api/workspaceApi';

// ── Status badge helpers ────────────────────────────────────────────────────

// Maps backend Decision status strings to readable labels and colors
const DECISION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMMITTED: { label: 'Committed', color: 'bg-green-100 text-green-800' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', color: 'bg-yellow-100 text-yellow-800' },
  REVIEWED: { label: 'Reviewed', color: 'bg-blue-100 text-blue-800' },
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
};

// Maps backend Task status strings to readable labels and colors
const TASK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
};

// Terminal statuses — overdue label is not shown for these
const TERMINAL_STATUSES = ['APPROVED', 'LOCKED', 'CANCELLED'];

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ── Zone card wrapper ───────────────────────────────────────────────────────

function ZoneCard({
  title,
  count,
  viewAllHref,
  children,
  emptyMessage,
}: {
  title: string;
  count: number;
  viewAllHref: string;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Zone header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Zone body */}
      <div className="flex flex-col divide-y divide-gray-50 px-5">
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  projectId: number;
}

export default function WorkspaceDashboard({ projectId }: Props) {
  const [data, setData] = useState<WorkspaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await WorkspaceAPI.getWorkspaceDashboard(projectId);
        if (!cancelled) setData(result);
      } catch (err: unknown) {
        if (!cancelled) {
          const anyErr = err as { response?: { data?: { detail?: string } }; message?: string };
          setError(
            anyErr?.response?.data?.detail ||
            anyErr?.message ||
            'Could not load workspace data'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-medium text-gray-900">Loading workspace…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
        <AlertCircle className="h-8 w-8" />
        <p className="mt-3 font-semibold">Could not load workspace</p>
        <p className="mt-1 text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">

      {/* ── Decision Zone ── */}
      <ZoneCard
        title="📋 Decisions"
        count={data.decisions.length}
        viewAllHref={`/decisions?project_id=${projectId}`}
        emptyMessage="No active decisions in this project."
      >
        {data.decisions.map((decision) => {
          const badge = DECISION_STATUS_LABELS[decision.status] ?? {
            label: decision.status,
            color: 'bg-gray-100 text-gray-600',
          };
          return (
            <Link
              key={decision.id}
              // Include project_id so Decision detail page passes permission check
              href={`/decisions/${decision.id}?project_id=${projectId}`}
              className="flex flex-col gap-1 py-3 hover:bg-gray-50 -mx-5 px-5 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900 line-clamp-1">
                {decision.title ?? '(Untitled decision)'}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge label={badge.label} color={badge.color} />
                {/* Unresolved badge: shown when decision has linked tasks not yet completed */}
                {decision.has_unresolved_tasks && (
                  <span className="text-xs font-medium text-orange-600">Unresolved</span>
                )}
              </div>
            </Link>
          );
        })}
      </ZoneCard>

      {/* ── Task Zone ── */}
      <ZoneCard
        title="✅ Tasks"
        count={data.tasks.length}
        viewAllHref={`/tasks?project_id=${projectId}`}
        emptyMessage="No tasks need attention right now."
      >
        {data.tasks.map((task) => {
          const badge = TASK_STATUS_LABELS[task.status] ?? {
            label: task.status,
            color: 'bg-gray-100 text-gray-600',
          };

          // Show Overdue label if due date is in the past and task is not in a terminal status
          const isOverdue =
            task.due_date &&
            new Date(task.due_date) < new Date() &&
            !TERMINAL_STATUSES.includes(task.status);

          return (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="flex flex-col gap-1 py-3 hover:bg-gray-50 -mx-5 px-5 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900 line-clamp-1">
                {task.summary}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge label={badge.label} color={badge.color} />
                {/* Decision-linked badge: shown when task is linked to a Decision */}
                {task.is_decision_linked && (
                  <span className="text-xs font-medium text-purple-600">Decision</span>
                )}
                {/* Overdue badge: shown when due date has passed */}
                {isOverdue && (
                  <span className="text-xs font-medium text-red-600">Overdue</span>
                )}
                {/* Blocked badge: shown when another task is blocking this one */}
                {task.is_blocked && (
                  <span className="text-xs font-medium text-orange-600">Blocked</span>
                )}
              </div>
            </Link>
          );
        })}
      </ZoneCard>

      {/* ── Spreadsheet Zone ── */}
      <ZoneCard
        title="📊 Spreadsheets"
        count={data.spreadsheets.length}
        viewAllHref={`/projects/${projectId}/spreadsheets`}
        emptyMessage="No spreadsheets in this project yet."
      >
        {data.spreadsheets.map((sheet) => {
          // Convert updated_at to a human-readable relative time string
          const updatedAt = new Date(sheet.updated_at);
          const diffMs = Date.now() - updatedAt.getTime();
          const diffHours = Math.floor(diffMs / 3600000);
          const relativeTime =
            diffHours < 1 ? 'just now' :
              diffHours < 24 ? `${diffHours}h ago` :
                `${Math.floor(diffHours / 24)}d ago`;

          return (
            <Link
              key={sheet.id}
              href={`/projects/${projectId}/spreadsheets/${sheet.id}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-5 px-5 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900 line-clamp-1">
                {sheet.name}
              </span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                {/* Running badge: shown when a PatternJob is queued or running */}
                {sheet.has_running_job && (
                  <span className="text-xs font-medium text-blue-600">Running</span>
                )}
                <span className="text-xs text-gray-400">{relativeTime}</span>
              </div>
            </Link>
          );
        })}
      </ZoneCard>

      {/* ── Pattern Zone ── */}
      <ZoneCard
        title="🔁 Patterns"
        count={data.patterns.length}
        viewAllHref={`/projects/${projectId}/spreadsheets`}
        emptyMessage="No patterns used in this project yet."
      >
        {data.patterns.map((pattern) => {
          // Convert updated_at to a human-readable relative time string
          const updatedAt = new Date(pattern.updated_at);
          const diffMs = Date.now() - updatedAt.getTime();
          const diffHours = Math.floor(diffMs / 3600000);
          const relativeTime =
            diffHours < 1 ? 'just now' :
              diffHours < 24 ? `${diffHours}h ago` :
                `${Math.floor(diffHours / 24)}d ago`;

          return (
            <div
              key={pattern.id}
              className="flex items-center justify-between py-3 -mx-5 px-5"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-gray-900 line-clamp-1">
                  {pattern.name}
                </span>
                {/* Show version number for reference */}
                <span className="text-xs text-gray-400">v{pattern.version}</span>
              </div>
              <span className="ml-2 shrink-0 text-xs text-gray-400">{relativeTime}</span>
            </div>
          );
        })}
      </ZoneCard>

    </div>
  );
}