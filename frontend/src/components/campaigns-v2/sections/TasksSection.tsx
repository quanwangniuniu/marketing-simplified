'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCampaignTasks } from '@/hooks/campaigns-v2/useCampaignTasks';
import type { TaskData } from '@/types/task';

export interface TasksSectionProps {
  campaignId: string;
}

export interface TasksSectionHandle {
  refresh: () => Promise<void>;
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800';
    case 'UNDER_REVIEW':
      return 'bg-yellow-100 text-yellow-800';
    case 'SUBMITTED':
      return 'bg-[#3CCED7]/10 text-[#0E8A96]';
    case 'REJECTED':
      return 'bg-red-100 text-red-800';
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const TasksSection = forwardRef<TasksSectionHandle, TasksSectionProps>(
  function TasksSection({ campaignId }, ref) {
    const router = useRouter();
    const { items, loading, error, refresh } = useCampaignTasks(campaignId);

    useEffect(() => {
      if (!campaignId) return;
      void refresh();
    }, [campaignId, refresh]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: async () => {
          await refresh();
        },
      }),
      [refresh]
    );

    const visibleItems = useMemo(
      () => items.filter((entry) => entry.task !== null),
      [items]
    );

    const errorMessage = useMemo(() => {
      if (!error) return null;
      const anyErr = error as any;
      return anyErr?.response?.data?.error || anyErr?.message || 'Failed to load tasks';
    }, [error]);

    const handleRowClick = useCallback(
      (task: TaskData) => {
        if (task?.id != null) router.push(`/tasks-v2/${task.id}`);
      },
      [router]
    );

    const renderHeader = (count: number | null) => (
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
        Related Tasks
        {count !== null && count > 0 && (
          <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">{count}</span>
        )}
      </h2>
    );

    if (loading && items.length === 0) {
      return (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          {renderHeader(null)}
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[#3CCED7]" />
            <span className="ml-3 text-sm text-gray-600">Loading tasks...</span>
          </div>
        </section>
      );
    }

    if (errorMessage && items.length === 0) {
      return (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          {renderHeader(null)}
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {errorMessage}
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        {renderHeader(visibleItems.length)}

        {visibleItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No tasks linked to this campaign yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((entry) => {
                  const task = entry.task as TaskData;
                  return (
                    <TableRow
                      key={entry.link.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(task)}
                    >
                      <TableCell className="font-medium">
                        {task.summary || `Task #${task.id}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {task.type || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(task.status)}`}
                        >
                          {task.status || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {task.owner?.username || task.owner?.email || 'Unassigned'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {formatDate(task.due_date)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    );
  }
);

export default TasksSection;
