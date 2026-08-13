'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Square } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import { useBuildUrl } from '@/lib/buildUrl';
import { TaskData, userDisplayName } from '@/types/task';
import SubtaskModal from './SubtaskModal';

interface SubtasksProps {
  taskId: number | string;
  taskProjectId?: number | string;
  parentTaskIsSubtask?: boolean;
}

export default function Subtasks({ taskId, taskProjectId, parentTaskIsSubtask }: SubtasksProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const [subtasks, setSubtasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadSubtasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TaskAPI.getSubtasks(taskId);
      setSubtasks(data);
    } catch (e: any) {
      console.error('Failed to load subtasks:', e);
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        'Failed to load subtasks.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId) return;
    loadSubtasks();
  }, [taskId]);

  const handleSubtaskAdded = () => {
    loadSubtasks();
    setIsModalOpen(false);
  };

  const handleTaskClick = (subtaskKey: number | string) => {
    router.push(buildUrl(`/tasks/${subtaskKey}`));
  };

  return (
    <section
      data-testid="task-subtasks-section"
      className="border-t border-slate-200 pt-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChevronDown className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900">Subtasks</h3>
        </div>
        {!parentTaskIsSubtask && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Add subtask"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        {parentTaskIsSubtask && (
          <div className="text-xs text-slate-500 italic">
            Subtasks cannot have subtasks
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-slate-500"></div>
          <span className="ml-2 text-sm text-slate-600">Loading subtasks...</span>
        </div>
      )}

      {error && !loading && (
        <div className="py-2 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && subtasks.length === 0 && (
        <div className="py-2 text-sm text-slate-500">No subtasks yet.</div>
      )}

      {!loading && !error && subtasks.length > 0 && (
        <div className="divide-y divide-slate-200">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              onClick={() => subtask.id && handleTaskClick(subtask.slug ?? subtask.id)}
              className="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-slate-50"
            >
              <div className="flex flex-1 items-center space-x-3">
                <Square className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {subtask.summary || `Task #${subtask.id}`}
                    </span>
                    {subtask.id && (
                      <span className="text-xs text-slate-500">
                        #{subtask.id}
                      </span>
                    )}
                  </div>
                  {subtask.owner && (
                    <div className="mt-1 flex items-center space-x-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200">
                        <span className="text-[10px] text-slate-700">
                          {userDisplayName(subtask.owner)[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {userDisplayName(subtask.owner)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Only render SubtaskModal if parent task is not a subtask */}
      {!parentTaskIsSubtask && (
        <SubtaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubtaskAdded={handleSubtaskAdded}
          parentTaskId={taskId}
          parentTaskProjectId={taskProjectId}
          parentTaskIsSubtask={parentTaskIsSubtask}
        />
      )}
    </section>
  );
}

