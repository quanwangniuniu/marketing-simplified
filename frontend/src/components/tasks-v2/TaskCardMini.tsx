'use client';

import { useRouter } from 'next/navigation';
import type { TaskData } from '@/types/task';
import UserAvatar from '@/people/UserAvatar';
import { STATUS_META } from './TYPE_META';
import { getTaskStatusLucideIcon } from './taskStatusIcons';

interface TaskCardMiniProps {
  task: TaskData;
  /** Kanban column accent — same as `TASK_TYPES[].hex` / board header dot. */
  columnAccentHex?: string;
}

export default function TaskCardMini({ task, columnAccentHex }: TaskCardMiniProps) {
  const router = useRouter();
  const status = task.status ?? 'DRAFT';
  const statusMeta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const statusLabel = STATUS_META[status]?.label ?? status;
  const description = task.description?.trim() ?? '';
  const StatusIcon = getTaskStatusLucideIcon(status);

  return (
    <button
      type="button"
      onClick={() => router.push(`/tasks/${task.id}`)}
      className={`group flex w-full flex-col rounded-md border-t-4 border-solid bg-white px-3 py-3.5 text-left shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-200${columnAccentHex ? '' : ` ${statusMeta.cardTopBorder}`}`}
      style={columnAccentHex ? { borderTopColor: columnAccentHex } : undefined}
    >
      <div className="flex w-full flex-1 flex-col gap-2.5">
        <div
          className={
            columnAccentHex
              ? 'inline-flex w-fit max-w-full items-start gap-2 self-start rounded-md px-1.5 py-1'
              : `inline-flex w-fit max-w-full items-start gap-2 self-start rounded-md px-1.5 py-1 ${statusMeta.summaryStrip}`
          }
          style={
            columnAccentHex
              ? {
                  backgroundColor: `color-mix(in srgb, ${columnAccentHex} 16%, white)`,
                  color: columnAccentHex,
                }
              : undefined
          }
        >
          <StatusIcon
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          <div className="min-w-0 text-sm font-medium leading-snug line-clamp-2">
            {statusLabel}
          </div>
        </div>
        <p
          className={
            description
              ? 'w-full text-left line-clamp-3 text-sm font-bold text-gray-900'
              : 'w-full text-left line-clamp-3 text-sm font-normal text-gray-400'
          }
        >
          {description || 'No description'}
        </p>
      </div>
      {task.owner ? (
        <div className="mt-3 flex w-full justify-start">
          <UserAvatar
            size="sm"
            emptyAvatar="user-icon"
            className="ring-2 ring-white shadow-sm"
            user={{
              name: task.owner.username,
              email: task.owner.email,
              avatar: task.owner.avatar ?? undefined,
            }}
          />
        </div>
      ) : null}
    </button>
  );
}
