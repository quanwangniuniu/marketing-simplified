'use client';

import { useRouter } from 'next/navigation';
import type { TaskData } from '@/types/task';
import { PRIORITY_META, STATUS_META, formatDateShort } from './TYPE_META';

interface TaskCardMiniProps {
  task: TaskData;
}

export default function TaskCardMini({ task }: TaskCardMiniProps) {
  const router = useRouter();
  const priority = task.priority ?? 'MEDIUM';
  const status = task.status ?? 'DRAFT';
  const statusMeta = STATUS_META[status] ?? STATUS_META.DRAFT;

  return (
    <button
      type="button"
      onClick={() => router.push(`/tasks-v2/${task.id}`)}
      className="group flex w-full flex-col gap-2 rounded-md bg-white p-3 text-left shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-200"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_META[priority]?.dot ?? 'bg-gray-300'}`}
          title={`Priority: ${priority}`}
        />
        <div className="min-w-0 flex-1 text-sm font-medium text-gray-900 line-clamp-2">
          {task.summary || `Task #${task.id}`}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusMeta.classes}`}
        >
          {statusMeta.label}
        </span>
        <span className="text-[11px] text-gray-400">
          {task.owner?.username ?? '—'} · {formatDateShort(task.due_date)}
        </span>
      </div>
    </button>
  );
}
