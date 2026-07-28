'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Printer,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import { useBuildUrl } from '@/lib/buildUrl';
import {
  exportMatrixToCSV,
  exportMatrixToXLSX,
} from '@/components/spreadsheets/spreadsheetImportExport';
import { formatTaskDateShort } from '@/lib/tasks/taskDates';

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskStub {
  id: number;
  slug?: string;
  summary: string;
  type: string;
  status: string;
  priority: string;
  due_date: string | null;
  owner: { id: number; name: string } | null;
  risk_type?: string;
  days_overdue?: number;
}

interface KeyDecision {
  task_id: number;
  task_summary: string;
  decision: 'APPROVED' | 'REJECTED';
  decided_at: string;
  decided_by: string | null;
}

interface VelocityData {
  current_week: number;
  avg_4wk: number;
  trend: 'up' | 'down' | 'stable';
  remaining_count: number;
  projected_weeks: number | null;
  projected_completion: string | null;
  weekly_data: { week: string; count: number }[];
}

interface StatusReportData {
  period: { start: string; end: string };
  completed_work: TaskStub[];
  in_progress: TaskStub[];
  blockers: TaskStub[];
  risks: TaskStub[];
  key_decisions: KeyDecision[];
  next_steps: TaskStub[];
  velocity: VelocityData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return formatTaskDateShort(iso);
}

/** Converts "UNDER_REVIEW" → "Under Review", "high" → "High", etc. */
function humanize(s: string) {
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function buildMarkdown(report: StatusReportData): string {
  const { period, completed_work, in_progress, blockers, risks, key_decisions, next_steps, velocity } = report;
  const lines: string[] = [];

  lines.push(`# Project Status Report`);
  lines.push(`**Period:** ${fmtDate(period.start)} – ${fmtDate(period.end)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Completed
  lines.push(`## ✅ Completed Work (${completed_work.length})`);
  if (completed_work.length) {
    lines.push('| Task | Type | Priority | Owner |');
    lines.push('|------|------|----------|-------|');
    completed_work.forEach((t) =>
      lines.push(`| ${t.summary} | ${humanize(t.type)} | ${humanize(t.priority)} | ${t.owner?.name ?? '—'} |`)
    );
  } else {
    lines.push('_No tasks completed in this period._');
  }
  lines.push('');

  // In Progress
  lines.push(`## 🔄 In Progress (${in_progress.length})`);
  if (in_progress.length) {
    lines.push('| Task | Type | Status | Owner |');
    lines.push('|------|------|--------|-------|');
    in_progress.forEach((t) =>
      lines.push(`| ${t.summary} | ${humanize(t.type)} | ${humanize(t.status)} | ${t.owner?.name ?? '—'} |`)
    );
  } else {
    lines.push('_No tasks currently in progress._');
  }
  lines.push('');

  // Blockers
  lines.push(`## 🚧 Blockers (${blockers.length})`);
  if (blockers.length) {
    blockers.forEach((t) => lines.push(`- **${t.summary}** _(${t.owner?.name ?? 'unassigned'})_`));
  } else {
    lines.push('_No blockers._');
  }
  lines.push('');

  // Risks
  lines.push(`## ⚠️ Risks (${risks.length})`);
  if (risks.length) {
    risks.forEach((t) => {
      const label = t.risk_type === 'overdue'
        ? `Overdue by ${t.days_overdue}d`
        : 'High priority / stalled';
      lines.push(`- **${t.summary}** — ${label} _(${t.owner?.name ?? 'unassigned'})_`);
    });
  } else {
    lines.push('_No significant risks._');
  }
  lines.push('');

  // Key Decisions
  lines.push(`## 📋 Key Decisions (${key_decisions.length})`);
  if (key_decisions.length) {
    key_decisions.forEach((d) => {
      const badge = d.decision === 'APPROVED' ? '✅ Approved' : '❌ Rejected';
      const by = d.decided_by ? ` by ${d.decided_by}` : '';
      lines.push(`- **${d.task_summary}** — ${badge} _(${fmtDate(d.decided_at)}${by})_`);
    });
  } else {
    lines.push('_No decisions made in this period._');
  }
  lines.push('');

  // Next Steps
  lines.push(`## 🚀 Next Steps (${next_steps.length})`);
  if (next_steps.length) {
    lines.push('| Task | Due | Owner |');
    lines.push('|------|-----|-------|');
    next_steps.forEach((t) =>
      lines.push(`| ${t.summary} | ${t.due_date ? fmtDate(t.due_date) : '—'} | ${t.owner?.name ?? '—'} |`)
    );
  } else {
    lines.push('_No upcoming tasks with due dates._');
  }
  lines.push('');

  // Velocity
  const trendIcon = velocity.trend === 'up' ? '↑' : velocity.trend === 'down' ? '↓' : '→';
  lines.push('## 📈 Velocity & ETA');
  lines.push(`- Completed this week: **${velocity.current_week}**`);
  lines.push(`- 4-week average: **${velocity.avg_4wk}/week**`);
  lines.push(`- Trend: **${trendIcon} ${humanize(velocity.trend)}**`);
  lines.push(`- Remaining tasks: **${velocity.remaining_count}**`);
  if (velocity.projected_completion) {
    lines.push(`- Projected completion: **${fmtDate(velocity.projected_completion)}** (~${velocity.projected_weeks} weeks)`);
  } else {
    lines.push('- Projected completion: _Insufficient velocity data_');
  }

  return lines.join('\n');
}

function buildTaskMatrix(report: StatusReportData): string[][] {
  const rows: string[][] = [
    ['Section', 'Task ID', 'Summary', 'Type', 'Status', 'Priority', 'Due Date', 'Owner'],
  ];
  const push = (section: string, tasks: TaskStub[]) =>
    tasks.forEach((t) =>
      rows.push([
        section,
        String(t.id),
        t.summary,
        humanize(t.type),
        humanize(t.status),
        humanize(t.priority),
        t.due_date ?? '',
        t.owner?.name ?? '',
      ])
    );
  push('Completed Work', report.completed_work);
  push('In Progress', report.in_progress);
  push('Blockers', report.blockers);
  push('Risks', report.risks);
  push('Next Steps', report.next_steps);
  return rows;
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ icon, title, count, children }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
        {icon}
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {count}
        </span>
      </div>
      <div className="task-tab-scrollbar max-h-[268px] overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function TaskRow({ task }: { task: TaskStub }) {
  const buildUrl = useBuildUrl();
  return (
    <a
      href={buildUrl(`/tasks/${task.slug}`)}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-gray-50"
    >
      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
      <span className="min-w-0 flex-1 truncate text-gray-800">{task.summary}</span>
      {task.owner && (
        <span className="shrink-0 text-xs text-gray-400">{task.owner.name}</span>
      )}
      {task.due_date && (
        <span className="shrink-0 text-xs text-gray-400">{fmtDate(task.due_date)}</span>
      )}
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 italic">{text}</p>;
}

import { Id } from '@/types/common';

// ── Main component ────────────────────────────────────────────────────────────

export default function StatusReportsView({ projectId }: { projectId: Id | null }) {
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StatusReportData | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [markdownEdited, setMarkdownEdited] = useState(false);
  const [view, setView] = useState<'preview' | 'markdown'>('preview');
  const [exporting, setExporting] = useState<string | null>(null);

  const doGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const params: Parameters<typeof TaskAPI.getStatusReport>[0] = {
        project_id: projectId,
        period,
        ...(period === 'custom' ? { date_from: customFrom, date_to: customTo } : {}),
      };
      const resp = await TaskAPI.getStatusReport(params);
      const data = resp.data as StatusReportData;
      setReport(data);
      setMarkdown(buildMarkdown(data));
      setMarkdownEdited(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (markdownEdited) {
      if (!window.confirm('Regenerating will overwrite your markdown edits. Continue?')) return;
    }
    void doGenerate();
  };

  const handleExportMarkdown = () => {
    downloadText(markdown, 'status-report.md', 'text/markdown');
  };

  const handleExportCSV = () => {
    if (!report) return;
    const matrix = buildTaskMatrix(report);
    const csv = exportMatrixToCSV(matrix);
    downloadText(csv, 'status-report-tasks.csv', 'text/csv');
  };

  const handleExportExcel = async () => {
    if (!report) return;
    setExporting('excel');
    try {
      const matrix = buildTaskMatrix(report);
      const blob = await exportMatrixToXLSX(matrix, 'Status Report');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'status-report-tasks.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    const source = document.getElementById('status-report-printable');
    if (!source) return;

    // Clone the report content into a direct child of <body> so it sits
    // outside any overflow/scroll container that would clip it during print.
    const printRoot = document.createElement('div');
    printRoot.id = '__status_report_print_root__';
    printRoot.innerHTML = source.innerHTML;
    document.body.appendChild(printRoot);

    const styleId = '__status_report_print_style__';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @media print {
        body > *:not(#__status_report_print_root__) { display: none !important; }
        #__status_report_print_root__ { display: block !important; font-family: sans-serif; font-size: 12px; color: #111; padding: 24px; background: white; }
        #__status_report_print_root__ * { color: inherit; max-height: none !important; overflow: visible !important; }
      }
    `;

    window.print();

    // Clean up after the print dialog closes.
    document.body.removeChild(printRoot);
    style.textContent = '';
  };

  const vel = report?.velocity;
  const TrendIcon = vel?.trend === 'up' ? TrendingUp : vel?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = vel?.trend === 'up' ? 'text-emerald-600' : vel?.trend === 'down' ? 'text-rose-500' : 'text-gray-400';

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Controls */}
      <div className="border-b border-gray-100 bg-white px-6 py-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
            {(['week', 'month', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  period === p
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {p === 'week' ? 'Last 7 days' : p === 'month' ? 'Last 30 days' : 'Custom'}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-[#3CCED7]"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-[#3CCED7]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !projectId || (period === 'custom' && (!customFrom || !customTo))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generating ? 'Generating…' : 'Generate Report'}
          </button>

          {report && (
            <>
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('preview')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${view === 'preview' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setView('markdown')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${view === 'markdown' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  Markdown
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <FileText className="h-3.5 w-3.5" />
                .md
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting === 'excel'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {exporting === 'excel' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Excel
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
            </>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </div>

      {/* Body */}
      <div id="status-report-printable" className="mx-auto max-w-4xl px-6 py-6">
        {!report && !generating && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No report generated yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Select a period and click <strong>Generate Report</strong> to get started.
            </p>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-gray-300" />
            <p className="text-sm text-gray-500">Analysing tasks…</p>
          </div>
        )}

        {report && !generating && view === 'markdown' && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
              <span className="text-xs text-gray-500">Edit markdown before exporting</span>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => { setMarkdown(e.target.value); setMarkdownEdited(true); }}
              className="block w-full resize-none p-4 font-mono text-xs text-gray-800 outline-none"
              rows={40}
              spellCheck={false}
            />
          </div>
        )}

        {report && !generating && view === 'preview' && (
          <div className="space-y-4">
            {/* Period header */}
            <div className="flex items-center gap-2 print:mb-4">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {fmtDate(report.period.start)} – {fmtDate(report.period.end)}
              </span>
            </div>

            {/* Velocity summary strip */}
            {vel && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Completed (period)', value: report.completed_work.length },
                  { label: 'In Progress', value: report.in_progress.length },
                  { label: '4-wk avg / week', value: vel.avg_4wk },
                  { label: 'Remaining', value: vel.remaining_count },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="mt-0.5 text-2xl font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sections */}
            <SectionCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} title="Completed Work" count={report.completed_work.length}>
              {report.completed_work.length
                ? report.completed_work.map((t) => <TaskRow key={t.id} task={t} />)
                : <EmptyState text="No tasks completed in this period." />}
            </SectionCard>

            <SectionCard icon={<Clock className="h-4 w-4 text-blue-500" />} title="In Progress" count={report.in_progress.length}>
              {report.in_progress.length
                ? report.in_progress.map((t) => <TaskRow key={t.id} task={t} />)
                : <EmptyState text="No tasks currently in progress." />}
            </SectionCard>

            <SectionCard icon={<ShieldAlert className="h-4 w-4 text-orange-500" />} title="Blockers" count={report.blockers.length}>
              {report.blockers.length
                ? report.blockers.map((t) => <TaskRow key={t.id} task={t} />)
                : <EmptyState text="No blockers." />}
            </SectionCard>

            <SectionCard icon={<AlertTriangle className="h-4 w-4 text-rose-500" />} title="Risks" count={report.risks.length}>
              {report.risks.length ? (
                report.risks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-50">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{t.summary}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${t.risk_type === 'overdue' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                      {t.risk_type === 'overdue' ? `${t.days_overdue}d overdue` : 'High priority'}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState text="No significant risks." />
              )}
            </SectionCard>

            <SectionCard icon={<FileText className="h-4 w-4 text-purple-500" />} title="Key Decisions" count={report.key_decisions.length}>
              {report.key_decisions.length ? (
                report.key_decisions.map((d) => (
                  <div key={`${d.task_id}-${d.decided_at}`} className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-50">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${d.decision === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                      {d.decision === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{d.task_summary}</span>
                    <span className="shrink-0 text-xs text-gray-400">{fmtDate(d.decided_at)}</span>
                  </div>
                ))
              ) : (
                <EmptyState text="No decisions made in this period." />
              )}
            </SectionCard>

            <SectionCard icon={<Sparkles className="h-4 w-4 text-[#3CCED7]" />} title="Next Steps" count={report.next_steps.length}>
              {report.next_steps.length
                ? report.next_steps.map((t) => <TaskRow key={t.id} task={t} />)
                : <EmptyState text="No upcoming tasks with due dates." />}
            </SectionCard>

            {/* Velocity card */}
            {vel && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                  <span className="text-sm font-semibold text-gray-900">Velocity & ETA</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-500">This week</p>
                    <p className="text-lg font-semibold text-gray-900">{vel.current_week}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">4-week avg</p>
                    <p className="text-lg font-semibold text-gray-900">{vel.avg_4wk}<span className="ml-0.5 text-xs font-normal text-gray-400">/wk</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Projected completion</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {vel.projected_completion ? fmtDate(vel.projected_completion) : '—'}
                    </p>
                    {vel.projected_weeks && (
                      <p className="text-xs text-gray-400">~{vel.projected_weeks} weeks</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
