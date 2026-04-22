'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from 'date-fns';
import { Plus } from 'lucide-react';
import type { TaskData } from '@/types/task';
import TimelineHeader, {
  type TimelineFilterOption,
  type TimelineHeaderUser,
} from './TimelineHeader';
import TimelineGrid from './TimelineGrid';
import TaskRow from './TaskRow';
import { buildTimelineColumns, dateToX } from './timelineUtils';
import type { TimelineScale } from './timelineUtils';
import { TaskAPI } from '@/lib/api/taskApi';
import { getTaskTypeLabel } from '@/lib/taskTypeLabels';

type WorkTypeFilter = 'all' | string;

interface TimelineViewProps {
  tasks: TaskData[];
  onTaskClick?: (task: TaskData) => void;
  reloadTasks?: () => Promise<void>;
  onCreateTask?: (projectId: number | null) => void;
  currentUser?: TimelineHeaderUser;
}

const getDefaultRange = (scale: TimelineScale) => {
  const today = new Date();
  if (scale === 'today') {
    return {
      start: startOfDay(today),
      end: endOfDay(today),
    };
  }

  if (scale === 'week') {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return { start, end: addDays(start, 6) };
  }

  if (scale === 'quarter') {
    const start = startOfQuarter(today);
    const end = endOfQuarter(addMonths(start, 9));
    return { start, end };
  }

  const start = startOfMonth(today);
  return { start, end: endOfMonth(today) };
};

const normalizeRange = (start: Date, end: Date) => ({
  start: startOfDay(start),
  end: endOfDay(end),
});

const normalizeTaskType = (value?: string | null) => {
  if (!value) return 'task';
  return value.toLowerCase();
};

const taskMatchesSearch = (task: TaskData, query: string) => {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const text = [
    task.id?.toString(),
    task.summary,
    task.description,
    task.type,
    task.status,
    task.project?.name,
    task.owner?.username,
    task.owner?.email,
    task.current_approver?.username,
    task.current_approver?.email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(normalized);
};

const getIssueKey = (task: TaskData) => {
  const projectName = task.project?.name || `PRJ${task.project_id ?? ''}`;
  const prefix = projectName
    .toString()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  return `${prefix || 'TASK'}-${task.id ?? 'NEW'}`;
};

const TimelineView = ({
  tasks,
  onTaskClick,
  reloadTasks,
  onCreateTask,
  currentUser,
}: TimelineViewProps) => {
  const [scale, setScale] = useState<TimelineScale>('week');
  const initialRange = useMemo(
    () => normalizeRange(...(Object.values(getDefaultRange('week')) as [Date, Date])),
    []
  );
  const [rangeStart, setRangeStart] = useState(initialRange.start);
  const [rangeEnd, setRangeEnd] = useState(initialRange.end);
  const [leftColumnWidth, setLeftColumnWidth] = useState(320);
  const [userResizedLeftColumn, setUserResizedLeftColumn] = useState(false);
  const minLeftWidth = 200;
  const maxLeftWidth = 520;
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panStartScrollRef = useRef(0);
  const [timelineSearchQuery, setTimelineSearchQuery] = useState('');
  const [displayRange, setDisplayRange] = useState('12');
  const [selectedWorkType, setSelectedWorkType] = useState<WorkTypeFilter>('all');

  const workTypeOptions = useMemo<TimelineFilterOption[]>(() => {
    const values = Array.from(new Set(tasks.map((task) => normalizeTaskType(task.type)))).sort((a, b) =>
      a.localeCompare(b)
    );
    return [
      { value: 'all', label: 'All work types' },
      ...values.map((value) => ({ value, label: getTaskTypeLabel(value) })),
    ];
  }, [tasks]);

  useEffect(() => {
    if (!workTypeOptions.some((option) => option.value === selectedWorkType)) {
      setSelectedWorkType('all');
    }
  }, [workTypeOptions, selectedWorkType]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const taskType = normalizeTaskType(task.type);
      if (selectedWorkType !== 'all' && taskType !== selectedWorkType) {
        return false;
      }

      return taskMatchesSearch(task, timelineSearchQuery.trim());
    });
  }, [tasks, selectedWorkType, timelineSearchQuery]);

  const columns = useMemo(
    () => buildTimelineColumns(rangeStart, rangeEnd, scale),
    [rangeStart, rangeEnd, scale]
  );
  const gridWidth = useMemo(
    () => columns.reduce((sum, column) => sum + column.width, 0),
    [columns]
  );
  const todayPosition = useMemo(() => {
    if (!columns.length) return null;
    const today = new Date();
    if (today < rangeStart || today > rangeEnd) return null;
    return dateToX(today, rangeStart, rangeEnd, columns);
  }, [columns, rangeStart, rangeEnd]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const aOrder = a.order_in_project ?? 0;
      const bOrder = b.order_in_project ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  }, [filteredTasks]);

  const preferredLeftWidth = useMemo(() => {
    const taskLabels = sortedTasks.map((t) => t.summary ?? '');
    const longestLabelLength = taskLabels.reduce((max, label) => Math.max(max, label.length), 0);
    const estimatedWidth = longestLabelLength * 8 + 160;
    return Math.min(maxLeftWidth, Math.max(minLeftWidth, Math.max(estimatedWidth, 280)));
  }, [sortedTasks, minLeftWidth, maxLeftWidth]);

  useEffect(() => {
    if (!userResizedLeftColumn) {
      setLeftColumnWidth(preferredLeftWidth);
    }
  }, [preferredLeftWidth, userResizedLeftColumn]);

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;
    const scrollEls = Array.from(container.querySelectorAll<HTMLElement>('[data-timeline-scroll]'));
    if (!scrollEls.length) return;

    const handleScroll = (source: HTMLElement) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const nextLeft = source.scrollLeft;
      scrollEls.forEach((el) => {
        if (el !== source && el.scrollLeft !== nextLeft) {
          el.scrollLeft = nextLeft;
        }
      });
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    };

    const listeners = scrollEls.map((el) => {
      const onScroll = () => handleScroll(el);
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    });

    return () => {
      listeners.forEach((cleanup) => cleanup());
    };
  }, [columns.length, sortedTasks.length]);

  const handleScaleChange = (nextScale: TimelineScale) => {
    setScale(nextScale);
    const nextRange = normalizeRange(...(Object.values(getDefaultRange(nextScale)) as [Date, Date]));
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
    if (nextScale === 'quarter') {
      setDisplayRange('12');
    }
    if (nextScale === 'month') {
      setDisplayRange('3');
    }
  };

  const handleRangeChange = (start: Date, end: Date) => {
    const nextRange = normalizeRange(start, end);
    setRangeStart(nextRange.start);
    setRangeEnd(nextRange.end);
  };

  const handleDisplayRangeChange = (value: string) => {
    setDisplayRange(value);
    const months = Number(value);
    if (!Number.isNaN(months) && months > 0) {
      const start = startOfMonth(new Date());
      const end = endOfMonth(addMonths(start, months - 1));
      handleRangeChange(start, end);
    }
  };

  const handleReorder = async (
    draggedId: number,
    targetId: number,
    position: 'before' | 'after'
  ) => {
    const targetTask = sortedTasks.find((task) => task.id === targetId);
    if (!targetTask) return;
    const targetProjectId = targetTask.project?.id ?? targetTask.project_id;
    if (!targetProjectId) return;

    const list = sortedTasks.filter(
      (task) => (task.project?.id ?? task.project_id) === targetProjectId
    );
    const next = [...list];
    const from = next.findIndex((t) => t.id === draggedId);
    const to = next.findIndex((t) => t.id === targetId);

    if (from < 0 || to < 0 || from === to) {
      return;
    }

    const [moved] = next.splice(from, 1);
    const insertIndex = position === 'before' ? to : to + 1;
    next.splice(insertIndex > from ? insertIndex - 1 : insertIndex, 0, moved);

    try {
      await Promise.all(
        next.map((t, idx) =>
          t.id ? TaskAPI.updateTask(t.id, { order_in_project: idx }) : Promise.resolve()
        )
      );
    } catch (e) {
      console.error('Reorder failed', e);
    } finally {
      if (reloadTasks) {
        await reloadTasks();
      }
    }
  };

  const scaleOptions: { value: TimelineScale; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Weeks' },
    { value: 'month', label: 'Months' },
    { value: 'quarter', label: 'Quarters' },
  ];

  return (
    <div className="flex flex-col gap-3">

      <div
        className="relative"
        ref={timelineRef}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          const target = event.target as HTMLElement;
          if (target.closest('button, a, input, textarea, select, [data-no-pan]')) return;
          if (!target.closest('[data-timeline-scroll]')) return;

          const scrollEl = timelineRef.current?.querySelector<HTMLElement>('[data-timeline-scroll]');
          if (!scrollEl) return;

          isPanningRef.current = true;
          panStartXRef.current = event.clientX;
          panStartScrollRef.current = scrollEl.scrollLeft;

          const onMove = (moveEvent: MouseEvent) => {
            if (!isPanningRef.current) return;
            const delta = moveEvent.clientX - panStartXRef.current;
            const nextLeft = Math.max(0, panStartScrollRef.current - delta);
            const scrollEls = timelineRef.current?.querySelectorAll<HTMLElement>('[data-timeline-scroll]') ?? [];
            scrollEls.forEach((el) => {
              el.scrollLeft = nextLeft;
            });
          };

          const onUp = () => {
            isPanningRef.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };

          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <TimelineGrid
          columns={columns}
          leftColumnWidth={leftColumnWidth}
          todayPosition={todayPosition}
          scale={scale}
        >
          {sortedTasks.map((task, index) => (
            <TaskRow
              key={task.id || task.summary}
              task={task}
              columns={columns}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              scale={scale}
              leftColumnWidth={leftColumnWidth}
              issueKey={getIssueKey(task)}
              className={index % 2 === 0 ? 'bg-white/60' : 'bg-slate-50/60'}
              onTaskClick={onTaskClick}
              onReorder={(draggedId, targetId, position) =>
                handleReorder(draggedId, targetId, position)
              }
              onDelete={async () => {
                if (reloadTasks) await reloadTasks();
              }}
            />
          ))}
          {sortedTasks.length === 0 ? (
            <div
              className="grid items-stretch bg-white"
              style={{ gridTemplateColumns: `${leftColumnWidth}px 1fr` }}
            >
              <div className="px-3 py-4 text-sm text-slate-500">No tasks match your filters.</div>
              <div className="relative overflow-x-auto scrollbar-hide" data-timeline-scroll>
                <div className="relative flex h-10 items-center" style={{ minWidth: gridWidth }} />
              </div>
            </div>
          ) : null}

          <div
            className="grid items-stretch bg-white"
            style={{ gridTemplateColumns: `${leftColumnWidth}px 1fr` }}
          >
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-[#3CCED7]">
              <button
                type="button"
                onClick={() => onCreateTask?.(null)}
                className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#3CCED7]/10"
              >
                <Plus className="h-4 w-4" />
                Create Task
              </button>
            </div>
            <div className="relative overflow-x-auto scrollbar-hide" data-timeline-scroll>
              <div className="relative flex h-10 items-center" style={{ minWidth: gridWidth }} />
            </div>
          </div>
        </TimelineGrid>

        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-1 shadow-sm">
            {scaleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleScaleChange(option.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  scale === option.value
                    ? 'bg-[#3CCED7] text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="timeline-resize-handle"
          style={{ left: leftColumnWidth - 1, top: scale === 'quarter' ? 72 : 46 }}
          data-no-pan
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setUserResizedLeftColumn(true);
            const startX = e.clientX;
            const startWidth = leftColumnWidth;

            const onMove = (ev: MouseEvent) => {
              const next = Math.min(maxLeftWidth, Math.max(minLeftWidth, startWidth + (ev.clientX - startX)));
              setLeftColumnWidth(next);
            };

            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
          onDoubleClick={() => {
            setUserResizedLeftColumn(false);
            setLeftColumnWidth(preferredLeftWidth);
          }}
        />
      </div>
    </div>
  );
};

export default TimelineView;
