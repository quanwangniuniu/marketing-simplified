'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TaskAPI } from '@/lib/api/taskApi';
import type { GanttChartPayload, GanttRow } from '@/types/task';
import { Skeleton } from '@/components/ui/skeleton';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type GanttTimeWindow = '1W' | '1M' | '3M' | '6M' | '1Y';
type PageSizeMode = '6' | '10' | '15' | 'all' | 'custom';

const WINDOW_DAYS: Record<GanttTimeWindow, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
};

const COLUMN_WIDTH_BY_WINDOW: Record<GanttTimeWindow, number> = {
  '1W': 100,
  '1M': 26,
  '3M': 9,
  '6M': 5,
  '1Y': 2.5,
};

const TIME_WINDOW_OPTIONS: GanttTimeWindow[] = ['1W', '1M', '3M', '6M', '1Y'];

type HeaderLayout = 'dateAndWeekday' | 'sparseWeek' | 'monthOnly';

function resolveHeaderLayout(columnWidth: number, timeWindow: GanttTimeWindow): HeaderLayout {
  if (timeWindow === '1W') return 'dateAndWeekday';
  if (timeWindow === '3M' && columnWidth >= 6) return 'sparseWeek';
  if (columnWidth >= 20) return 'dateAndWeekday';
  if (columnWidth >= 8) return 'sparseWeek';
  return 'monthOnly';
}

const BAR_MIN_WIDTH = 24;
const BAR_PILL_MIN_WIDTH = 32;

function addCalendarDays(d: Date, delta: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + delta);
  return x;
}

const HEADER_DAY_LINE = 'border-r border-[#e5e5e5]';

const BAR_CLASS: Record<GanttRow['band'], string> = {
  highest: 'bg-[#f43f5e]',
  high: 'bg-[#f97316]',
  medium: 'bg-[#f2b01e]',
  low: 'bg-[#38bdf8]',
  lowest: 'bg-[#c0c7d1]',
};

const KEY_TEXT: Record<GanttRow['band'], string> = {
  highest: 'text-[#e11d48]',
  high: 'text-[#ea580c]',
  medium: 'text-[#a16207]',
  low: 'text-[#0284c7]',
  lowest: 'text-[#6b7280]',
};

const LEGEND_STYLE: Record<GanttRow['band'], string> = {
  highest: 'bg-rose-50 text-rose-800 ring-rose-100',
  high: 'bg-orange-50 text-orange-900 ring-orange-100',
  medium: 'bg-amber-50 text-amber-800 ring-amber-100',
  low: 'bg-sky-50 text-sky-800 ring-sky-100',
  lowest: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const AVATAR_BG = ['bg-[#ef4444]', 'bg-[#3b82f6]', 'bg-[#eab308]', 'bg-[#22c55e]'];

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => Number(n));
  return new Date(y, m - 1, d);
}

function formatLocalIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eachDayInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const c = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (c <= last) {
    out.push(new Date(c));
    c.setDate(c.getDate() + 1);
  }
  return out;
}

function visibleDaysFromToday(
  todayIso: string,
  visibleDayCount: number,
  timeWindow: GanttTimeWindow
): Date[] {
  const today = parseLocalDay(todayIso);
  const daysBeforeToday =
    timeWindow === '1M'
      ? Math.round(visibleDayCount * 0.28)
      : Math.floor(visibleDayCount * 0.28);
  const start = addCalendarDays(today, -daysBeforeToday);
  const end = addCalendarDays(start, visibleDayCount - 1);
  return eachDayInclusive(start, end);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function barSlot(
  barStartIso: string,
  barEndIso: string,
  days: Date[]
): { startIdx: number; span: number } {
  const start = parseLocalDay(barStartIso);
  const end = parseLocalDay(barEndIso);
  const n = days.length;
  if (n === 0) return { startIdx: 0, span: 0 };
  let startIdx = days.findIndex((d) => isSameDay(d, start));
  let endIdx = days.findIndex((d) => isSameDay(d, end));
  if (startIdx < 0) startIdx = 0;
  if (endIdx < 0) endIdx = n - 1;
  if (endIdx < startIdx) endIdx = startIdx;
  return { startIdx, span: endIdx - startIdx + 1 };
}

interface GanttViewProps {
  projectId: number | null;
  projectContextLoading: boolean;
}

export default function GanttView({ projectId, projectContextLoading }: GanttViewProps) {
  const router = useRouter();
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const suppressRowClickRef = useRef(false);

  const [data, setData] = useState<GanttChartPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBands, setActiveBands] = useState<GanttRow['band'][]>([]);
  const [timeWindow, setTimeWindow] = useState<GanttTimeWindow>('1M');
  const [barOverrides, setBarOverrides] = useState<Record<number, { bar_start: string; bar_end: string }>>({});
  const [dragError, setDragError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeMode, setPageSizeMode] = useState<PageSizeMode>('6');
  const [appliedPageSize, setAppliedPageSize] = useState(6);
  const [customPageInput, setCustomPageInput] = useState('6');
  const [dragState, setDragState] = useState<{
    rowId: number;
    side: 'left' | 'right';
    startClientX: number;
    origStartIdx: number;
    origEndIdx: number;
    lastStartIdx: number;
    lastEndIdx: number;
    origStartIso: string;
    origEndIso: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await TaskAPI.getTasksGantt({ project_id: projectId });
      setData(payload);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 404
          ? 'Chart API returned 404. Restart Django with the latest backend, and set NEXT_PUBLIC_API_URL to the API host root without a trailing /api.'
          : 'Failed to load Gantt data. Please try again.'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectContextLoading) return;
    if (!projectId) { setData(null); return; }
    void load();
  }, [projectId, projectContextLoading, load]);

  useEffect(() => {
    if (!data) return;
    setActiveBands(data.legend.map((item) => item.band));
  }, [data]);

  useEffect(() => {
    setBarOverrides({});
    setDragState(null);
    setDragError(null);
  }, [data?.today, projectId]);

  const visibleDayCount = WINDOW_DAYS[timeWindow];

  const days = useMemo(() => {
    if (!data || !data.today) return [];
    const effectiveDayCount = timeWindow === '1W' ? WINDOW_DAYS['1M'] : visibleDayCount;
    const effectiveWindow = timeWindow === '1W' ? '1M' : timeWindow;
    return visibleDaysFromToday(data.today, effectiveDayCount, effectiveWindow);
  }, [data, visibleDayCount, timeWindow]);

  const todayIso = data?.today ?? null;
  const todayColumnIndex = useMemo(() => {
    if (!todayIso) return -1;
    return days.findIndex((d) => formatLocalIsoDay(d) === todayIso);
  }, [days, todayIso]);

  const monthGroups = useMemo(() => {
    if (days.length === 0) return [];
    const groups: Array<{ label: string; count: number }> = [];
    for (const d of days) {
      const label = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, count: 1 });
      else last.count += 1;
    }
    return groups;
  }, [days]);

  const columnWidth = COLUMN_WIDTH_BY_WINDOW[timeWindow];
  const totalDays = days.length;
  const timelineWidth = totalDays * columnWidth;
  const headerLayout = resolveHeaderLayout(columnWidth, timeWindow);
  const headerTopPx = headerLayout === 'monthOnly' ? 40 : 80;

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (activeBands.length === 0) return [];
    return data.rows.filter((row) => activeBands.includes(row.band));
  }, [data, activeBands]);

  const totalFiltered = filteredRows.length;
  const effectivePageSize =
    pageSizeMode === 'all' ? Math.max(1, totalFiltered) : Math.max(1, appliedPageSize);
  const totalPages =
    pageSizeMode === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / effectivePageSize));
  const pagedRows =
    pageSizeMode === 'all'
      ? filteredRows
      : filteredRows.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  type RowDensity = 'full' | 'compact' | 'minimal';
  const densityMode: RowDensity =
    effectivePageSize <= 6 ? 'full' : effectivePageSize <= 12 ? 'compact' : 'minimal';
  const rowHeight = densityMode === 'full' ? 80 : densityMode === 'compact' ? 56 : 40;
  const bodyFontSize = densityMode === 'full' ? 14 : densityMode === 'compact' ? 12 : 11;
  const subFontSize = Math.max(11, bodyFontSize - 2);
  const statusFontSize = Math.max(11, bodyFontSize - 3);
  const rowInset = Math.max(2, Math.round(rowHeight * 0.1));

  const toggleBand = useCallback((band: GanttRow['band']) => {
    setActiveBands((prev) => {
      if (prev.includes(band)) return prev.filter((b) => b !== band);
      return [...prev, band];
    });
  }, []);

  const commitCustomPageSize = useCallback(() => {
    const n = Number(customPageInput.trim());
    if (!Number.isFinite(n)) { setCustomPageInput(String(appliedPageSize)); return; }
    const clamped = Math.min(100, Math.max(1, Math.round(n)));
    setAppliedPageSize(clamped);
    setCustomPageInput(String(clamped));
  }, [customPageInput, appliedPageSize]);

  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [projectId, data?.today, timeWindow, columnWidth]);

  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    if (todayColumnIndex < 0) return;
    const scroller = timelineScrollRef.current;
    if (!scroller) return;
    requestAnimationFrame(() => {
      const vw = scroller.clientWidth;
      const anchor = 0.28;
      const targetLeft =
        timeWindow === '1M'
          ? todayColumnIndex * columnWidth - vw * anchor
          : timeWindow === '1W'
            ? todayColumnIndex * columnWidth + columnWidth / 2 - vw * 0.3
            : todayColumnIndex * columnWidth + columnWidth / 2 - vw * anchor;
      scroller.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
      hasAutoScrolledRef.current = true;
    });
  }, [todayColumnIndex, columnWidth, timeWindow]);

  useEffect(() => {
    if (!dragError) return;
    const t = window.setTimeout(() => setDragError(null), 2200);
    return () => window.clearTimeout(t);
  }, [dragError]);

  useEffect(() => { setCurrentPage(1); }, [activeBands, pageSizeMode, appliedPageSize]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!dragState || days.length === 0) return;
    const onMove = (e: MouseEvent) => {
      const deltaCols = Math.round((e.clientX - dragState.startClientX) / columnWidth);
      const lastIdx = days.length - 1;
      let nextStart = dragState.origStartIdx;
      let nextEnd = dragState.origEndIdx;
      if (dragState.side === 'left') {
        nextStart = Math.min(Math.max(dragState.origStartIdx + deltaCols, 0), dragState.origEndIdx);
      } else {
        nextEnd = Math.max(Math.min(dragState.origEndIdx + deltaCols, lastIdx), dragState.origStartIdx);
      }
      if (nextEnd < nextStart) {
        if (dragState.side === 'left') nextStart = nextEnd;
        else nextEnd = nextStart;
      }
      nextStart = Math.max(0, Math.min(nextStart, lastIdx));
      nextEnd = Math.max(0, Math.min(nextEnd, lastIdx));

      const nextStartIso = formatLocalIsoDay(days[nextStart]);
      const nextEndIso = formatLocalIsoDay(days[nextEnd]);
      setBarOverrides((prev) => ({
        ...prev,
        [dragState.rowId]: { bar_start: nextStartIso, bar_end: nextEndIso },
      }));
      setDragState((prev) =>
        prev ? { ...prev, lastStartIdx: nextStart, lastEndIdx: nextEnd } : prev
      );
    };
    const onUp = async () => {
      const finalState = dragState;
      setDragState(null);
      if (!finalState) return;
      const changed =
        finalState.lastStartIdx !== finalState.origStartIdx ||
        finalState.lastEndIdx !== finalState.origEndIdx;
      if (changed) {
        const nextStartIso = formatLocalIsoDay(days[finalState.lastStartIdx]);
        const nextEndIso = formatLocalIsoDay(days[finalState.lastEndIdx]);
        try {
          await TaskAPI.updateTask(finalState.rowId, {
            planned_start_date: nextStartIso,
            due_date: nextEndIso,
          });
        } catch {
          setBarOverrides((prev) => ({
            ...prev,
            [finalState.rowId]: {
              bar_start: finalState.origStartIso,
              bar_end: finalState.origEndIso,
            },
          }));
          setDragError('Failed to update dates. Reverted.');
        }
      }
      window.setTimeout(() => {
        suppressRowClickRef.current = false;
      }, 0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, days, columnWidth]);

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 p-6 text-sm text-rose-600 ring-1 ring-rose-100">
        {error}
      </div>
    );
  }

  if (projectContextLoading || (projectId && loading && !data)) {
    return (
      <div className="space-y-3" data-testid="gantt-loading">
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-[320px] w-full rounded-xl sm:h-[420px]" />
      </div>
    );
  }

  if (!projectId) {
    return (
      <p className="text-sm text-gray-500" data-testid="gantt-no-project">
        Select a project to view the Gantt chart.
      </p>
    );
  }

  if (!data) return null;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
      data-testid="gantt-chart"
    >
      {dragError ? (
        <div className="mx-4 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
          {dragError}
        </div>
      ) : null}

      <header className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-[min(100%,280px)] items-center rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 text-sm font-medium text-brand-teal">
            {data.sprint_label}
          </span>
          <span className="text-sm text-gray-400">
            {filteredRows.length} / {data.task_count} task{data.task_count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-1 justify-center">
          <div
            className="inline-flex rounded-[10px] border border-slate-200 bg-slate-50/90 p-0.5"
            role="tablist"
            aria-label="Time window"
          >
            {TIME_WINDOW_OPTIONS.map((id) => {
              const selected = timeWindow === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTimeWindow(id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${selected
                    ? 'bg-white text-brand-teal shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {data.legend.map((item) => (
            <button
              key={item.band}
              type="button"
              onClick={() => toggleBand(item.band)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition ${LEGEND_STYLE[item.band]} ${activeBands.includes(item.band) ? '' : 'opacity-35 grayscale'
                }`}
              aria-pressed={activeBands.includes(item.band)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div ref={timelineScrollRef} className="flex min-w-0 overflow-x-auto">
        {/* Left sticky panel */}
        <div className="sticky left-0 z-20 w-[280px] min-w-[280px] shrink-0 self-start border-r border-gray-300 bg-white">
          <div className="shrink-0 border-b border-gray-100" style={{ height: headerTopPx }} />
          {pagedRows.map((row) => (
            <button
              key={`left-${row.id}`}
              type="button"
              onClick={() => router.push(`/tasks/${row.id}`)}
              className="flex w-full items-center gap-2 border-b border-gray-50 px-3 py-3 text-left transition hover:bg-gray-50/80"
              style={{ height: rowHeight }}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ${AVATAR_BG[row.owner_color_index % AVATAR_BG.length]
                  }`}
              >
                {row.owner_initials.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden" style={{ fontSize: bodyFontSize }}>
                {densityMode === 'minimal' ? (
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className={`shrink-0 font-semibold ${KEY_TEXT[row.band]}`} style={{ fontSize: bodyFontSize }}>
                      {row.display_key}
                    </span>
                    <p className="truncate font-semibold text-gray-900" style={{ fontSize: bodyFontSize, lineHeight: 1.2 }}>
                      {row.summary}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden">
                      <span className={`font-semibold ${KEY_TEXT[row.band]}`} style={{ fontSize: bodyFontSize }}>
                        {row.display_key}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${LEGEND_STYLE[row.band]}`}>
                        {row.band}
                      </span>
                    </div>
                    <p className="truncate font-semibold text-gray-900" style={{ fontSize: bodyFontSize, lineHeight: 1.25 }}>
                      {row.summary}
                    </p>
                    {densityMode === 'full' ? (
                      <p className="mt-0.5 truncate text-gray-400" style={{ fontSize: statusFontSize, lineHeight: 1.2 }}>
                        {row.status_label}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </button>
          ))}
          {filteredRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              No tasks for the selected risk levels.
            </p>
          ) : null}
        </div>

        {/* Right timeline grid */}
        <div className="relative shrink-0" style={{ width: `${timelineWidth}px` }}>
          {/* Header */}
          <div className="relative z-[1] border-b border-[#e5e5e5]">
            {headerLayout === 'monthOnly' ? (
              <div className="relative z-[1] flex h-[24px] bg-transparent">
                {monthGroups.map((group, idx) => {
                  const startIdx = monthGroups.slice(0, idx).reduce((s, g) => s + g.count, 0);
                  const spansToday =
                    todayColumnIndex >= startIdx && todayColumnIndex < startIdx + group.count;
                  return (
                    <div
                      key={`${group.label}-${idx}`}
                      className={`relative flex shrink-0 items-center justify-start px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 ${spansToday
                        ? 'border-r border-brand-teal bg-brand-teal/[0.12]'
                        : HEADER_DAY_LINE
                        }`}
                      style={{ width: `${group.count * columnWidth}px` }}
                    >
                      <span className="truncate pl-1">{group.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="relative z-[1] flex h-[24px] border-b border-[#e5e5e5] bg-transparent">
                  {monthGroups.map((group, idx) => (
                    <div
                      key={`${group.label}-${idx}`}
                      className={`relative flex shrink-0 items-center justify-start px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 ${HEADER_DAY_LINE}`}
                      style={{ width: `${group.count * columnWidth}px` }}
                    >
                      {group.label}
                    </div>
                  ))}
                </div>
                <div className="relative z-[1] flex overflow-visible">
                  {days.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = i === todayColumnIndex;
                    const showDate =
                      headerLayout === 'dateAndWeekday' || i === 0 || i % 7 === 0;
                    const sparseFontPx =
                      headerLayout === 'sparseWeek'
                        ? Math.max(8, Math.min(12, columnWidth * 1.2))
                        : 13;
                    return (
                      <div
                        key={`head-${i}`}
                        className={`relative z-[1] flex h-[56px] shrink-0 flex-col items-center justify-center overflow-visible py-1 text-center ${isToday
                          ? 'border-r border-brand-teal bg-brand-teal/[0.12]'
                          : `${HEADER_DAY_LINE} ${isWeekend && !isToday ? 'bg-[#f8f8f8]' : ''}`
                          }`}
                        style={{ width: columnWidth }}
                      >
                        {showDate ? (
                          <span
                            className={`font-semibold tabular-nums leading-none ${headerLayout === 'sparseWeek' ? '' : 'text-[13px]'
                              } ${isToday ? 'text-brand-teal' : 'text-gray-700'}`}
                            style={
                              headerLayout === 'sparseWeek'
                                ? { fontSize: `${sparseFontPx}px` }
                                : undefined
                            }
                          >
                            {d.getDate()}
                          </span>
                        ) : null}
                        {showDate && headerLayout === 'dateAndWeekday' ? (
                          <span
                            className={`mt-1 text-[10px] font-medium uppercase ${isToday ? 'text-brand-teal' : 'text-gray-400'
                              }`}
                          >
                            {WEEKDAY_LETTERS[d.getDay()]}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {pagedRows.map((row) => (
            <button
              key={`right-${row.id}`}
              type="button"
              onClick={() => {
                if (dragState || suppressRowClickRef.current) return;
                router.push(`/tasks/${row.id}`);
              }}
              className="group relative z-[1] block border-b border-gray-50 text-left transition hover:bg-gray-50/80"
              style={{ width: `${timelineWidth}px`, height: rowHeight }}
            >
              <div className="absolute inset-0 flex">
                {days.map((_, i) => {
                  const isTodayCol = i === todayColumnIndex;
                  return (
                    <div key={`cell-${row.id}-${i}`} className="relative shrink-0" style={{ width: columnWidth }}>
                      {isTodayCol ? (
                        <div
                          className="pointer-events-none absolute inset-x-2 z-[1] rounded-sm bg-brand-teal/[0.14]"
                          style={{ top: rowInset, bottom: rowInset }}
                          aria-hidden
                        />
                      ) : null}
                      <div
                        className={`pointer-events-none absolute right-0 z-[2] w-px ${isTodayCol ? 'bg-brand-teal' : 'bg-gray-200/80'
                          }`}
                        style={{ top: rowInset, bottom: rowInset }}
                        aria-hidden
                      />
                    </div>
                  );
                })}
              </div>

              {(() => {
                const override = barOverrides[row.id];
                const effectiveStart = override?.bar_start ?? row.bar_start;
                const effectiveEnd = override?.bar_end ?? row.bar_end;
                const { startIdx, span } = barSlot(effectiveStart, effectiveEnd, days);
                const barW = Math.max(span * columnWidth, BAR_MIN_WIDTH);
                const barShape = barW >= BAR_PILL_MIN_WIDTH ? 'rounded-full' : 'rounded-md';
                const leftPx = startIdx * columnWidth;
                const rightPx = leftPx + barW;
                const isDraggingThisRow = dragState?.rowId === row.id;

                return (
                  <div className="absolute inset-y-0 left-0 right-0 z-[2] flex items-center pointer-events-none">
                    <div
                      className={`absolute top-1/2 h-6 -translate-y-1/2 shadow-sm transition-transform duration-150 ease-out ${timeWindow === '1W' || timeWindow === '1M' ? 'group-hover:scale-[1.02]' : ''
                        } ${barShape} ${BAR_CLASS[row.band]}`}
                      style={{ left: `${leftPx}px`, width: `${barW}px`, minWidth: `${BAR_MIN_WIDTH}px` }}
                    >
                      <span
                        className="absolute inset-y-0 left-2 flex items-center font-semibold text-white/95"
                        style={{ fontSize: subFontSize }}
                      >
                        {span}d
                      </span>
                    </div>
                    {(timeWindow === '1W' || timeWindow === '1M') && (
                      <button
                        type="button"
                        className={`pointer-events-auto absolute top-1/2 z-[5] h-[18px] w-[18px] -translate-y-1/2 cursor-ew-resize bg-transparent transition-opacity ${isDraggingThisRow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        style={{ left: `${leftPx - 9}px` }}
                        aria-label={`Resize start of task ${row.display_key}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          suppressRowClickRef.current = true;
                          const orig = barSlot(effectiveStart, effectiveEnd, days);
                          setDragState({
                            rowId: row.id,
                            side: 'left',
                            startClientX: e.clientX,
                            origStartIdx: orig.startIdx,
                            origEndIdx: orig.startIdx + orig.span - 1,
                            lastStartIdx: orig.startIdx,
                            lastEndIdx: orig.startIdx + orig.span - 1,
                            origStartIso: effectiveStart,
                            origEndIso: effectiveEnd,
                          });
                        }}
                      >
                        <span
                          className="absolute left-1 top-1 h-[10px] w-[10px] rounded-full border border-[rgba(0,0,0,0.15)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all duration-150 ease-in-out group-hover:h-[12px] group-hover:w-[12px] group-hover:left-[3px] group-hover:top-[3px]"
                          aria-hidden
                        />
                      </button>
                    )}
                    {(timeWindow === '1W' || timeWindow === '1M') && (
                      <button
                        type="button"
                        className={`pointer-events-auto absolute top-1/2 z-[5] h-[18px] w-[18px] -translate-y-1/2 cursor-ew-resize bg-transparent transition-opacity ${isDraggingThisRow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        style={{ left: `${rightPx - 9}px` }}
                        aria-label={`Resize end of task ${row.display_key}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          suppressRowClickRef.current = true;
                          const orig = barSlot(effectiveStart, effectiveEnd, days);
                          setDragState({
                            rowId: row.id,
                            side: 'right',
                            startClientX: e.clientX,
                            origStartIdx: orig.startIdx,
                            origEndIdx: orig.startIdx + orig.span - 1,
                            lastStartIdx: orig.startIdx,
                            lastEndIdx: orig.startIdx + orig.span - 1,
                            origStartIso: effectiveStart,
                            origEndIso: effectiveEnd,
                          });
                        }}
                      >
                        <span
                          className="absolute left-1 top-1 h-[10px] w-[10px] rounded-full border border-[rgba(0,0,0,0.15)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all duration-150 ease-in-out group-hover:h-[12px] group-hover:w-[12px] group-hover:left-[3px] group-hover:top-[3px]"
                          aria-hidden
                        />
                      </button>
                    )}
                  </div>
                );
              })()}
            </button>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-2">
        <button
          type="button"
          className={`text-sm ${currentPage <= 1 || totalPages <= 1 ? 'cursor-not-allowed text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1 || totalPages <= 1}
        >
          ← Prev
        </button>
        <span className="text-sm text-gray-500">
          {`Page ${Math.min(currentPage, totalPages)} / ${totalPages}`}
        </span>
        <button
          type="button"
          className={`text-sm ${currentPage >= totalPages || totalPages <= 1 ? 'cursor-not-allowed text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages || totalPages <= 1}
        >
          Next →
        </button>
        <span className="ml-2 text-sm text-gray-500">Per page:</span>
        <select
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700"
          value={pageSizeMode}
          onChange={(e) => {
            const v = e.target.value as PageSizeMode;
            setPageSizeMode(v);
            if (v === '6' || v === '10' || v === '15') {
              setAppliedPageSize(Number(v));
            } else if (v === 'custom') {
              setCustomPageInput(String(appliedPageSize));
            }
          }}
        >
          <option value="6">6</option>
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="all">All</option>
          <option value="custom">Custom</option>
        </select>
        {pageSizeMode === 'custom' ? (
          <input
            className="h-8 w-14 rounded-md border border-gray-200 px-2 text-sm text-gray-700"
            value={customPageInput}
            onChange={(e) => setCustomPageInput(e.target.value)}
            onBlur={commitCustomPageSize}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitCustomPageSize();
                (e.target as HTMLInputElement).blur();
              }
            }}
            inputMode="numeric"
            aria-label="Custom page size"
          />
        ) : null}
      </div>
    </div>
  );
}
