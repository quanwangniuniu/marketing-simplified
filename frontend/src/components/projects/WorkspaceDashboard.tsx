'use client';

// SMP-472: Project Workspace Dashboard
// Displays Decision / Task / Operation summaries scoped to a single project.
// Design matches the Marketing Simplified homepage style — teal/green/orange color scheme.
// This is an orientation surface — read-only, no editing, quick navigation only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Calendar, CheckSquare, Loader2, Repeat, Scale, Table2 } from 'lucide-react';
import { WorkspaceAPI, type WorkspaceDashboardData } from '@/lib/api/workspaceApi';

// Icons match `HeroSection` explore grid (lucide): Decisions=Scale, Tasks=CheckSquare,
// Spreadsheet=Table2, Calendar=Calendar (overdue / deadlines).
const ICON = {
  summary: 'h-5 w-5 shrink-0',
  zone: 'h-4 w-4 shrink-0',
  pattern: 'h-3.5 w-3.5 shrink-0',
} as const;

// ── Status maps ─────────────────────────────────────────────────────────────

// Decision status → tag style
const DECISION_STATUS: Record<string, { label: string; cls: string }> = {
  COMMITTED: { label: 'Committed', cls: 'tag-committed' },
  AWAITING_APPROVAL: { label: 'Awaiting approval', cls: 'tag-awaiting' },
  REVIEWED: { label: 'Reviewed', cls: 'tag-reviewed' },
};

// Task status → tag style
const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Submitted', cls: 'tag-submitted' },
  UNDER_REVIEW: { label: 'Under review', cls: 'tag-under-review' },
  REJECTED: { label: 'Rejected', cls: 'tag-rejected' },
};

/** Initial rows per list before progressive reveal.
 * Keep in sync with backend `ProjectWorkspaceDashboardView.ZONE_LIMIT`.
 */
const INITIAL_VISIBLE_ROWS = 20;
/** Number of rows revealed on each "Show more" click. */
const SHOW_MORE_STEP = 20;

/** Visible task tag pills before collapsing the rest into "+N". */
const MAX_TASK_TAGS_VISIBLE = 2;

// ── Shared sub-components ────────────────────────────────────────────────────

function Tag({ label, cls }: { label: string; cls: string }) {
  return <span className={`ws-tag ${cls}`}>{label}</span>;
}

function RiskDot({ level }: { level: string | null }) {
  if (!level) return null;
  const colors: Record<string, string> = { HIGH: '#F44336', MEDIUM: '#FF8C42', LOW: '#4CAF7D' };
  const labels: Record<string, string> = { HIGH: 'High risk', MEDIUM: 'Medium risk', LOW: 'Low risk' };
  const color = colors[level] ?? '#9CA3AF';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: 10, color: '#6B7280' }}>{labels[level] ?? level}</span>
    </span>
  );
}

function PriorityStripe({ level }: { level: 'high' | 'medium' | 'low' | 'none' }) {
  const colors = { high: '#F44336', medium: '#FF8C42', low: '#4CAF7D', none: '#E5E7EB' };
  return (
    <div
      style={{
        width: 3,
        alignSelf: 'stretch',
        minHeight: 44,
        borderRadius: 2,
        flexShrink: 0,
        background: colors[level],
      }}
    />
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: '#fff7ed', color: '#ea580c',
      fontSize: 9, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

type TaskTagSpec = { label: string; cls: string };

/** Status / flags as pills; overflow collapsed to +N with full list in native tooltip. */
function TaskRowTags({ specs }: { specs: TaskTagSpec[] }) {
  if (specs.length === 0) return null;
  const visible = specs.slice(0, MAX_TASK_TAGS_VISIBLE);
  const hidden = specs.slice(MAX_TASK_TAGS_VISIBLE);
  const overflowTitle = hidden.map((h) => h.label).join(', ');
  return (
    <>
      {visible.map((t, i) => (
        <Tag key={`${t.cls}-${t.label}-${i}`} label={t.label} cls={t.cls} />
      ))}
      {hidden.length > 0 ? (
        <span
          className="ws-tag"
          title={overflowTitle}
          style={{
            background: '#F3F4F6',
            color: '#6B7280',
            cursor: 'help',
          }}
        >
          +{hidden.length}
        </span>
      ) : null}
    </>
  );
}

// ── Zone card wrapper ────────────────────────────────────────────────────────

function ZoneCard({
  icon,
  iconBg,
  title,
  count,
  countLabel,
  countTooltip,
  viewAllHref,
  footer,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  count: number;
  countLabel: string;
  /** Shown on hover over the count pill (e.g. breakdown of what the number includes). */
  countTooltip?: string;
  viewAllHref: string;
  /** Pinned to bottom when lists are short (e.g. cap hint). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 420,
      height: '100%',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      border: '1px solid #E5E7EB',
    }}>
      {/* Zone header */}
      <div style={{
        padding: '16px 18px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            title={countTooltip}
            style={{
              fontSize: 11, color: '#6B7280',
              background: '#F3F4F6', borderRadius: 20,
              padding: '3px 9px', fontWeight: 500,
            }}
          >
            {count} {countLabel}
          </span>
          <Link href={viewAllHref} className="text-xs font-semibold text-brand-teal no-underline">
            View all →
          </Link>
        </div>
      </div>

      {/* Zone body — grow so short lists share column height; footer stays at bottom */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
        {footer}
      </div>
    </div>
  );
}

function ShowMoreFooter({
  remaining,
  onClick,
}: {
  remaining: number;
  onClick: () => void;
}) {
  if (remaining <= 0) return null;
  return (
    <div
      style={{
        marginTop: 'auto',
        padding: '10px 14px 12px',
        borderTop: '1px solid #F3F4F6',
        background: '#FAFAFA',
        textAlign: 'center',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="text-xs font-semibold text-brand-teal hover:underline"
      >
        Show {Math.min(SHOW_MORE_STEP, remaining)} more
      </button>
    </div>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  href,
  priority = 'none',
  title,
  tags,
  right,
}: {
  href?: string;
  priority?: 'high' | 'medium' | 'low' | 'none';
  title: string;
  tags: React.ReactNode;
  right?: React.ReactNode;
}) {
  const inner = (
    <div style={{
      padding: '11px 18px',
      borderBottom: '1px solid #F9FAFB',
      display: 'flex',
      alignItems: 'stretch',
      gap: 10,
      transition: 'background 0.12s',
      cursor: href ? 'pointer' : 'default',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <PriorityStripe level={priority} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 13, color: '#111827', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 5,
        }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {tags}
        </div>
      </div>
      {right && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          gap: 4,
          paddingTop: 1,
        }}>
          {right}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  }
  return inner;
}

// ── Summary bar ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  meta,
  danger = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  /** Secondary line under the value (e.g. metric breakdown). */
  meta?: string;
  danger?: boolean;
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      border: '1px solid #E5E7EB',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: danger ? '#e11d48' : '#111827', lineHeight: 1 }}>{value}</div>
        {meta ? (
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, lineHeight: 1.3 }}>{meta}</div>
        ) : null}
      </div>
    </div>
  );
}

// ── Section label inside Operation zone ──────────────────────────────────────

function SectionLabel({ label, divider = false }: { label: string; divider?: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#9CA3AF',
      padding: '10px 18px 5px',
      letterSpacing: '0.06em', textTransform: 'uppercase',
      borderTop: divider ? '1px solid #E5E7EB' : undefined,
      marginTop: divider ? 4 : 0,
    }}>
      {label}
    </div>
  );
}

// ── Relative / absolute time (list rows) ─────────────────────────────────────

const RELATIVE_THRESHOLD_DAYS = 7;

function parseValidDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date + time for tooltips (locale-aware). */
function formatAbsoluteDateTime(dateStr: string): string {
  const d = parseValidDate(dateStr);
  if (!d) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short display: relative under7d, then calendar-style date; hover shows absolute. */
function formatRelativeListTime(dateStr: string): string {
  const d = parseValidDate(dateStr);
  if (!d) return '—';
  const diffMs = Math.max(0, Date.now() - d.getTime());
  const h = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (days < RELATIVE_THRESHOLD_DAYS) return `${days}d ago`;
  const nowY = new Date().getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== nowY) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

function RelativeTimeText({ dateStr }: { dateStr: string }) {
  const absolute = formatAbsoluteDateTime(dateStr);
  const display = formatRelativeListTime(dateStr);
  return (
    <span style={{ fontSize: 11, color: '#9CA3AF' }} title={absolute || undefined}>
      {display}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  projectId: number;
}

export default function WorkspaceDashboard({ projectId }: Props) {
  const [data, setData] = useState<WorkspaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleDecisions, setVisibleDecisions] = useState(INITIAL_VISIBLE_ROWS);
  const [visibleTasks, setVisibleTasks] = useState(INITIAL_VISIBLE_ROWS);
  const [visibleSpreadsheets, setVisibleSpreadsheets] = useState(INITIAL_VISIBLE_ROWS);
  const [visiblePatterns, setVisiblePatterns] = useState(INITIAL_VISIBLE_ROWS);

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
          const e = err as { response?: { data?: { detail?: string } }; message?: string };
          setError(e?.response?.data?.detail || e?.message || 'Could not load workspace data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    setVisibleDecisions(INITIAL_VISIBLE_ROWS);
    setVisibleTasks(INITIAL_VISIBLE_ROWS);
    setVisibleSpreadsheets(INITIAL_VISIBLE_ROWS);
    setVisiblePatterns(INITIAL_VISIBLE_ROWS);
  }, [projectId, data?.decisions.length, data?.tasks.length, data?.spreadsheets.length, data?.patterns.length]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', borderRadius: 16,
        border: '1px dashed #E5E7EB', background: '#fff', padding: 40, color: '#6B7280',
      }}>
        <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: '#111827' }}>Loading workspace…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', borderRadius: 16,
        border: '1px dashed #FECACA', background: '#fff', padding: 40, textAlign: 'center',
      }}>
        <AlertCircle style={{ width: 32, height: 32, color: '#F44336' }} />
        <p style={{ marginTop: 12, fontWeight: 600, color: '#F44336' }}>Could not load workspace</p>
        <p style={{ marginTop: 4, fontSize: 13, color: '#EF4444' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const sheetCount = data.spreadsheets.length;
  const patternCount = data.patterns.length;
  const operationsTotal = sheetCount + patternCount;
  const operationsMeta =
    patternCount === 0
      ? `${sheetCount} spreadsheet${sheetCount === 1 ? '' : 's'}`
      : `${sheetCount} spreadsheet${sheetCount === 1 ? '' : 's'} · ${patternCount} pattern${patternCount === 1 ? '' : 's'}`;
  const operationsCountTooltip =
    `Total includes ${sheetCount} spreadsheet${sheetCount === 1 ? '' : 's'} and ${patternCount} workflow pattern${patternCount === 1 ? '' : 's'}.`;

  // Derived counts for summary bar
  const overdueCount = data.tasks.filter((t) => t.is_overdue).length;
  const shownDecisions = data.decisions.slice(0, visibleDecisions);
  const shownTasks = data.tasks.slice(0, visibleTasks);
  const shownSpreadsheets = data.spreadsheets.slice(0, visibleSpreadsheets);
  const shownPatterns = data.patterns.slice(0, visiblePatterns);
  const remainingDecisions = Math.max(0, data.decisions.length - shownDecisions.length);
  const remainingTasks = Math.max(0, data.tasks.length - shownTasks.length);
  const remainingSpreadsheets = Math.max(0, data.spreadsheets.length - shownSpreadsheets.length);
  const remainingPatterns = Math.max(0, data.patterns.length - shownPatterns.length);

  return (
    <>
      {/* Inline styles for tag classes — avoids Tailwind purge issues */}
      <style>{`
        .ws-tag { font-size: 10px; padding: 2px 7px; border-radius: 5px; font-weight: 600; white-space: nowrap; }
        .tag-committed    { background: #E0F7F4; color: #00796B; }
        .tag-awaiting     { background: #FFF3E8; color: #E65100; }
        .tag-reviewed     { background: #EFF6FF; color: #1D4ED8; }
        .tag-submitted    { background: #EFF6FF; color: #1D4ED8; }
        .tag-under-review { background: #FFF3E8; color: #E65100; }
        .tag-rejected     { background: #FFEBEE; color: #B71C1C; }
        .tag-overdue      { background: #FFEBEE; color: #B71C1C; }
        .tag-blocked      { background: #FFF3E8; color: #E65100; }
        .tag-decision     { background: #F3F0FF; color: #5B21B6; }
        .tag-unresolved   { background: #FFF3E8; color: #E65100; }
        .tag-running      { background: #E0F7F4; color: #00796B; }
      `}</style>

      {/* Summary bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        <SummaryCard
          icon={<Scale className={`${ICON.summary} text-brand-teal`} strokeWidth={2} />}
          iconBg="rgba(60, 206, 215, 0.12)"
          label="Active decisions"
          value={data.decisions.length}
        />
        <SummaryCard
          icon={<CheckSquare className={`${ICON.summary} text-orange-600`} strokeWidth={2} />}
          iconBg="#fff7ed"
          label="Tasks needing attention"
          value={data.tasks.length}
        />
        <SummaryCard
          icon={<Calendar className={`${ICON.summary} text-rose-600`} strokeWidth={2} />}
          iconBg="#fff1f2"
          label="Overdue tasks"
          value={overdueCount}
          danger={overdueCount > 0}
        />
        <SummaryCard
          icon={<Table2 className={`${ICON.summary} text-emerald-600`} strokeWidth={2} />}
          iconBg="#ecfdf5"
          label="Active operations"
          value={operationsTotal}
          meta={operationsMeta}
        />
      </div>

      {/* Three zones */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}>

        {/* ── Decision Zone ── */}
        <ZoneCard
          icon={<Scale className={`${ICON.zone} text-brand-teal`} strokeWidth={2} />}
          iconBg="rgba(60, 206, 215, 0.12)"
          title="Decisions"
          count={data.decisions.length}
          countLabel="active"
          viewAllHref={`/decisions?project_id=${projectId}`}
          footer={remainingDecisions > 0 ? (
            <ShowMoreFooter
              remaining={remainingDecisions}
              onClick={() => setVisibleDecisions((prev) => prev + SHOW_MORE_STEP)}
            />
          ) : undefined}
        >
          {data.decisions.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 18px',
            }}>
              <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                No active decisions in this project.
              </p>
            </div>
          ) : shownDecisions.map((d) => {
            const s = DECISION_STATUS[d.status] ?? { label: d.status, cls: 'tag-committed' };
            return (
              <ItemRow
                key={d.id}
                href={`/decisions/${d.id}?project_id=${projectId}`}
                priority={d.risk_level === 'HIGH' ? 'high' : d.risk_level === 'MEDIUM' ? 'medium' : d.risk_level === 'LOW' ? 'low' : 'none'}
                title={d.title ?? '(Untitled decision)'}
                tags={<>
                  <Tag label={s.label} cls={s.cls} />
                  {d.has_unresolved_tasks && <Tag label="Tasks open" cls="tag-unresolved" />}
                  <RiskDot level={d.risk_level} />
                </>}
                right={<RelativeTimeText dateStr={d.updated_at} />}
              />
            );
          })}
        </ZoneCard>

        {/* ── Task Zone ── */}
        <ZoneCard
          icon={<CheckSquare className={`${ICON.zone} text-orange-600`} strokeWidth={2} />}
          iconBg="#fff7ed"
          title="Tasks"
          count={data.tasks.length}
          countLabel="priority queue"
          viewAllHref={`/tasks?project_id=${projectId}`}
          footer={remainingTasks > 0 ? (
            <ShowMoreFooter
              remaining={remainingTasks}
              onClick={() => setVisibleTasks((prev) => prev + SHOW_MORE_STEP)}
            />
          ) : undefined}
        >
          {data.tasks.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 18px',
            }}>
              <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                No tasks need attention right now.
              </p>
            </div>
          ) : shownTasks.map((t) => {
            const s = TASK_STATUS[t.status] ?? { label: t.status, cls: 'tag-submitted' };
            const isOverdue = t.is_overdue;
            const initials =
              (t.owner_initials || '').trim().toUpperCase() ||
              t.summary.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
            const taskTagSpecs: TaskTagSpec[] = [{ label: s.label, cls: s.cls }];
            if (isOverdue) taskTagSpecs.push({ label: 'Overdue', cls: 'tag-overdue' });
            if (t.is_blocked) taskTagSpecs.push({ label: 'Blocked', cls: 'tag-blocked' });
            if (t.is_decision_linked) taskTagSpecs.push({ label: 'Decision linked', cls: 'tag-decision' });
            return (
              <ItemRow
                key={t.id}
                href={`/tasks/${t.id}`}
                priority={isOverdue ? 'high' : t.is_blocked ? 'medium' : 'low'}
                title={t.summary}
                tags={<TaskRowTags specs={taskTagSpecs} />}
                right={(
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <RelativeTimeText dateStr={t.updated_at} />
                    <Avatar initials={initials} />
                  </div>
                )}
              />
            );
          })}
        </ZoneCard>

        {/* ── Operation Zone ── */}
        <ZoneCard
          icon={<Table2 className={`${ICON.zone} text-emerald-600`} strokeWidth={2} />}
          iconBg="#ecfdf5"
          title="Operations"
          count={operationsTotal}
          countLabel="active"
          countTooltip={operationsCountTooltip}
          viewAllHref={`/projects/${projectId}/spreadsheets`}
          footer={
            remainingSpreadsheets > 0 || remainingPatterns > 0 ? (
              <ShowMoreFooter
                remaining={remainingSpreadsheets + remainingPatterns}
                onClick={() => {
                  setVisibleSpreadsheets((prev) => prev + SHOW_MORE_STEP);
                  setVisiblePatterns((prev) => prev + SHOW_MORE_STEP);
                }}
              />
            ) : undefined
          }
        >
          {/* Spreadsheets section */}
          <SectionLabel label="Spreadsheets" />
          {data.spreadsheets.length === 0 ? (
            <p style={{ padding: '8px 18px 12px', fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              No spreadsheets yet.
            </p>
          ) : shownSpreadsheets.map((s) => (
            <ItemRow
              key={s.id}
              href={`/projects/${projectId}/spreadsheets/${s.id}`}
              title={s.name}
              tags={s.has_running_job ? <Tag label="Job running" cls="tag-running" /> : <span style={{ fontSize: 10, color: '#9CA3AF' }}>No active jobs</span>}
              right={<RelativeTimeText dateStr={s.updated_at} />}
            />
          ))}

          {/* Patterns section */}
          {data.patterns.length > 0 && (
            <>
              <SectionLabel label="Patterns recently used" divider />
              {shownPatterns.map((p) => {
                const patternSheetHref =
                  p.origin_spreadsheet_id != null
                    ? `/projects/${projectId}/spreadsheets/${p.origin_spreadsheet_id}`
                    : null;
                const row = (
                  <div
                    style={{
                      padding: '10px 18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid #F9FAFB',
                      cursor: patternSheetHref ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (patternSheetHref) e.currentTarget.style.background = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, background: '#ecfdf5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Repeat className={`${ICON.pattern} text-emerald-600`} strokeWidth={2} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>v{p.version}</div>
                      </div>
                    </div>
                    <RelativeTimeText dateStr={p.updated_at} />
                  </div>
                );
                return patternSheetHref ? (
                  <Link
                    key={p.id}
                    href={patternSheetHref}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={p.id}>{row}</div>
                );
              })}
            </>
          )}
        </ZoneCard>

      </div>
    </>
  );
}