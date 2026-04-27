'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { TaskData } from '@/types/task';
import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import {
  PRIORITY_META,
  STATUS_META,
  TASK_TYPES,
  formatDateShort,
} from './TYPE_META';
import { Skeleton } from '@/components/ui/skeleton';
import TaskListRowContextMenu, {
  type TaskListRowContextMenuState,
} from '@/components/tasks-v2/TaskListRowContextMenu';
import { useTaskStore } from '@/lib/taskStore';

interface ListViewProps {
  tasks: TaskData[];
  loading: boolean;
  error: string | null;
}

const TYPE_LABEL = TASK_TYPES.reduce<Record<string, string>>((acc, t) => {
  acc[t.value] = t.shortLabel;
  return acc;
}, {});

const TABLE_COLUMN_WIDTHS = {
  icon: 'w-10',
  type: 'w-24',
  status: 'w-28',
  owner: 'w-[120px]',
  approver: 'w-[120px]',
  due: 'w-[84px]',
} as const;

export default function ListView({ tasks, loading, error }: ListViewProps) {
  const router = useRouter();
  const removeTask = useTaskStore((s) => s.removeTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const [search, setSearch] = useState('');
  const [rowMenu, setRowMenu] = useState<TaskListRowContextMenuState>(null);
  const [menuMembers, setMenuMembers] = useState<ProjectMemberData[]>([]);
  const [menuMembersLoading, setMenuMembersLoading] = useState(false);
  const membersByProjectIdRef = useRef<Map<number, ProjectMemberData[]>>(new Map());
  const pendingMemberFetchesRef = useRef<Map<number, Promise<ProjectMemberData[]>>>(new Map());

  useEffect(() => {
    if (!rowMenu) {
      setMenuMembers([]);
      setMenuMembersLoading(false);
      return;
    }
    const pid = rowMenu.task.project_id ?? rowMenu.task.project?.id ?? null;
    if (pid == null) {
      setMenuMembers([]);
      setMenuMembersLoading(false);
      return;
    }

    const cached = membersByProjectIdRef.current.get(pid);
    if (cached) {
      setMenuMembers(cached);
      setMenuMembersLoading(false);
      return;
    }

    let cancelled = false;
    setMenuMembers([]);
    setMenuMembersLoading(true);

    const existing = pendingMemberFetchesRef.current.get(pid);
    const promise =
      existing ??
      ProjectAPI.getProjectMembers(pid)
        .then((rows) => {
          membersByProjectIdRef.current.set(pid, rows);
          pendingMemberFetchesRef.current.delete(pid);
          return rows;
        })
        .catch(() => {
          pendingMemberFetchesRef.current.delete(pid);
          return [] as ProjectMemberData[];
        });
    if (!existing) {
      pendingMemberFetchesRef.current.set(pid, promise);
    }

    void promise.then((rows) => {
      if (!cancelled) {
        setMenuMembers(rows);
        setMenuMembersLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rowMenu]);

  const openRowMenu = useCallback((e: MouseEvent, task: TaskData) => {
    e.preventDefault();
    e.stopPropagation();
    if (task.id == null) return;
    let x = e.clientX;
    let y = e.clientY;
    setRowMenu({ task, x, y });
  }, []);

  const closeRowMenu = useCallback(() => setRowMenu(null), []);

  const handleOpenDetail = useCallback(
    (taskId: number) => {
      router.push(`/tasks/${taskId}`);
    },
    [router]
  );

  const handleTaskDeleted = useCallback(
    (taskId: number) => {
      removeTask(taskId);
    },
    [removeTask]
  );

  const handleTaskPatched = useCallback(
    (taskId: number, data: Partial<TaskData>) => {
      updateTask(taskId, data);
    },
    [updateTask]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      `${t.summary ?? ''} ${t.type ?? ''} ${t.owner?.username ?? ''} ${t.current_approver?.username ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [search, tasks]);

  return (
    <div>
      <TaskListRowContextMenu
        state={rowMenu}
        menuMembers={menuMembers}
        menuMembersLoading={menuMembersLoading}
        onRequestClose={closeRowMenu}
        onOpenDetail={handleOpenDetail}
        onTaskDeleted={handleTaskDeleted}
        onTaskPatched={handleTaskPatched}
      />
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search summary, type or owner…"
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        {error ? (
          <div className="px-6 py-12 text-center text-sm text-rose-600">{error}</div>
        ) : !loading && visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-900">No tasks yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Click <span className="font-medium text-gray-700">Create task</span> to add the first one.
            </p>
          </div>
        ) : (
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className={TABLE_COLUMN_WIDTHS.icon} />
              <col />
              <col className={TABLE_COLUMN_WIDTHS.type} />
              <col className={TABLE_COLUMN_WIDTHS.status} />
              <col className={TABLE_COLUMN_WIDTHS.owner} />
              <col className={TABLE_COLUMN_WIDTHS.approver} />
              <col className={TABLE_COLUMN_WIDTHS.due} />
            </colgroup>
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className={`${TABLE_COLUMN_WIDTHS.icon} px-4 py-3 text-left`}></th>
                <th className="px-4 py-3 text-left">Summary</th>
                <th className={`${TABLE_COLUMN_WIDTHS.type} px-4 py-3 text-left`}>Type</th>
                <th className={`${TABLE_COLUMN_WIDTHS.status} px-4 py-3 text-left`}>Status</th>
                <th className={`${TABLE_COLUMN_WIDTHS.owner} px-4 py-3 text-left`}>Owner</th>
                <th className={`${TABLE_COLUMN_WIDTHS.approver} px-4 py-3 text-left`}>Approver</th>
                <th className={`${TABLE_COLUMN_WIDTHS.due} px-4 py-3 text-left`}>Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {(loading ? Array.from({ length: 6 }, () => undefined) : visible).map((task, index) => {
                if (loading) {
                  return (
                    <tr key={`tasks-list-skeleton-${index}`}>
                      <td className={`${TABLE_COLUMN_WIDTHS.icon} px-4 py-3`}>
                        <Skeleton className="h-2 w-2 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0 max-w-[32rem] space-y-2">
                          <Skeleton className="h-4 w-full max-w-[22rem]" />
                          <Skeleton className="h-3 w-full max-w-[32rem]" />
                        </div>
                      </td>
                      <td className={`${TABLE_COLUMN_WIDTHS.type} px-4 py-3`}>
                        <Skeleton className="h-3 w-16" />
                      </td>
                      <td className={`${TABLE_COLUMN_WIDTHS.status} px-4 py-3`}>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className={`${TABLE_COLUMN_WIDTHS.owner} px-4 py-3`}>
                        <Skeleton className="h-3 w-16" />
                      </td>
                      <td className={`${TABLE_COLUMN_WIDTHS.approver} px-4 py-3`}>
                        <Skeleton className="h-3 w-16" />
                      </td>
                      <td className={`${TABLE_COLUMN_WIDTHS.due} px-4 py-3`}>
                        <Skeleton className="h-3 w-14" />
                      </td>
                    </tr>
                  );
                }

                if (!task) {
                  return null;
                }

                const priority = task.priority ?? 'MEDIUM';
                const status = task.status ?? 'DRAFT';
                const statusMeta = STATUS_META[status] ?? STATUS_META.DRAFT;
                return (
                  <tr
                    key={task.id}
                    className="cursor-pointer transition hover:bg-gray-50/80"
                    onClick={() => router.push(`/tasks/${task.id}`)}
                    onContextMenu={(e) => openRowMenu(e, task)}
                  >
                    <td className={`${TABLE_COLUMN_WIDTHS.icon} px-4 py-3`}>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${PRIORITY_META[priority]?.dot ?? 'bg-gray-300'}`}
                        title={`Priority: ${priority}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0 max-w-[32rem]">
                        <div className="truncate font-medium text-gray-900">
                          {task.summary || `Task #${task.id}`}
                        </div>
                        {task.description ? (
                          <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                            {task.description}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${TABLE_COLUMN_WIDTHS.type} px-4 py-3 text-xs uppercase tracking-wide text-gray-500`}>
                      {TYPE_LABEL[task.type] ?? task.type ?? '—'}
                    </td>
                    <td className={`${TABLE_COLUMN_WIDTHS.status} px-4 py-3`}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusMeta.classes}`}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className={`${TABLE_COLUMN_WIDTHS.owner} px-4 py-3 text-xs text-gray-600`}>
                      <div className="truncate">{task.owner?.username ?? '—'}</div>
                    </td>
                    <td className={`${TABLE_COLUMN_WIDTHS.approver} px-4 py-3 text-xs text-gray-600`}>
                      <div className="truncate">{task.current_approver?.username ?? '—'}</div>
                    </td>
                    <td className={`${TABLE_COLUMN_WIDTHS.due} px-4 py-3 text-xs text-gray-500`}>
                      {formatDateShort(task.due_date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
