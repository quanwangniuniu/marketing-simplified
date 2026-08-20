'use client';

import { useRouter } from 'next/navigation';
import type { TaskData } from '@/types/task';
import UserAvatar from '@/people/UserAvatar';
import { getTaskStatusDefinition } from '@/lib/tasks/taskStatuses';
import { getTaskStatusLucideIcon } from './taskStatusIcons';
import { useBuildUrl } from '@/lib/buildUrl';

interface TaskCardMiniProps {
  task: TaskData;
  /** Kanban column accent — same as `TASK_TYPE_DEFINITIONS[].hex` / board header dot. */
  columnAccentHex?: string;
}

export default function TaskCardMini({ task, columnAccentHex }: TaskCardMiniProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const status = task.status ?? 'DRAFT';
  const statusMeta = getTaskStatusDefinition(status);
  const statusLabel = statusMeta.label || status;
  const description = task.description?.trim() ?? '';
  const StatusIcon = getTaskStatusLucideIcon(status);

  return (
    <button
      type="button"
      onClick={() => router.push(buildUrl(`/tasks/${task.slug}`))}
      className={`group flex w-full flex-col rounded-md border-t-4 border-solid bg-white px-3 py-3 text-left shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-200${columnAccentHex ? '' : ` ${statusMeta.cardTopBorder}`}`}
      style={columnAccentHex ? { borderTopColor: columnAccentHex } : undefined}
    >
      <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 justify-start">
            <div
              className={
                columnAccentHex
                  ? 'inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-black/[0.06]'
                  : `inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-black/[0.06] ${statusMeta.summaryStrip}`
              }
              style={
                columnAccentHex
                  ? {
                      backgroundColor: `color-mix(in srgb, ${columnAccentHex} 12%, white)`,
                      color: columnAccentHex,
                    }
                  : undefined
              }
            >
              <StatusIcon className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
              <span className="min-w-0 truncate text-[11px] font-medium leading-none">{statusLabel}</span>
            </div>
          </div>
          {task.owner ? (
            <UserAvatar
              size="sm"
              emptyAvatar="user-icon"
              className="shrink-0 ring-1 ring-gray-200/90"
              user={{
                name: task.owner.username,
                email: task.owner.email,
                avatar: task.owner.avatar ?? undefined,
              }}
            />
          ) : null}
        </div>

        <p className="w-full min-w-0 text-left text-sm font-semibold leading-snug text-gray-900 line-clamp-3">
          {task.summary || 'Untitled'}
        </p>
        {description ? (
          <p className="w-full min-w-0 text-left text-xs leading-snug text-gray-500 line-clamp-2">
            {description}
          </p>
        ) : null}

        {task.tags && task.tags.length > 0 ? (
          <div className="flex w-full flex-wrap gap-1.5" aria-label="Task labels">
            {task.tags.map((tag) => (
              <span
                key={`${tag.name.toLowerCase()}:${tag.color}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-50 py-0.5 pl-1.5 pr-2 ring-1 ring-gray-200/90"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-medium text-gray-700">{tag.name}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
