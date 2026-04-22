'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FileSearch, Plus, ExternalLink, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { KnowledgeNavigationLink } from '@/types/meeting';

interface Props {
  projectId: number;
  meetingId: number;
  meetingTitle: string;
  generatedDecisions: KnowledgeNavigationLink[];
  generatedTasks: KnowledgeNavigationLink[];
  readOnly?: boolean;
  onMutated: () => void;
}

function rewriteToV2(link: KnowledgeNavigationLink, kind: 'decision' | 'task', projectId: number): string {
  const base = kind === 'decision' ? '/decisions' : '/tasks';
  return `${base}/${link.id}?project_id=${projectId}`;
}

export default function ContextualKnowledgeSection({
  projectId,
  meetingId,
  meetingTitle,
  generatedDecisions,
  generatedTasks,
  readOnly = false,
  onMutated,
}: Props) {
  const [creatingDecision, setCreatingDecision] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const disabledTitle = readOnly
    ? 'Meeting is archived; unarchive to spawn new artifacts.'
    : undefined;

  const createDecision = async () => {
    setCreatingDecision(true);
    try {
      const response = await api.post<{ id: number }>(
        '/api/decisions/drafts/',
        {
          project: projectId,
          origin_meeting_id: meetingId,
          title: '',
        },
        { headers: { 'X-Project-Id': String(projectId) } },
      );
      const newId = response.data?.id;
      if (newId) {
        toast.success('Decision draft created');
        onMutated();
        window.location.href = `/decisions/${newId}?project_id=${projectId}`;
      } else {
        toast.error('Decision created but no id returned.');
      }
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string; origin_meeting_id?: string } }; message?: string };
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.origin_meeting_id ||
          err.message ||
          'Could not create decision.',
      );
    } finally {
      setCreatingDecision(false);
    }
  };

  const createTask = async () => {
    setCreatingTask(true);
    try {
      const response = await api.post<{ id: number }>('/api/tasks/', {
        project_id: projectId,
        origin_meeting_id: meetingId,
        type: 'execution',
        summary: (meetingTitle || 'New task').slice(0, 200),
        create_as_draft: true,
      });
      const newId = response.data?.id;
      if (newId) {
        toast.success('Task draft created');
        onMutated();
        window.location.href = `/tasks/${newId}?project_id=${projectId}`;
      } else {
        toast.error('Task created but no id returned.');
      }
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string; summary?: string[] } }; message?: string };
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.summary?.[0] ||
          err.message ||
          'Could not create task.',
      );
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center gap-2">
        <FileSearch className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Generated from this meeting
        </h2>
      </header>
      <p className="mb-4 text-xs text-gray-500">
        Decisions and tasks created with this meeting as their origin. Use{' '}
        <span className="font-medium text-gray-700">+ Create</span> to spawn a new draft;
        the link back to this meeting is automatic.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Decisions
            </h3>
            <button
              type="button"
              onClick={createDecision}
              disabled={creatingDecision || readOnly}
              title={disabledTitle}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingDecision ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3 w-3" aria-hidden="true" />
              )}
              <span>Create</span>
            </button>
          </div>
          {generatedDecisions.length === 0 ? (
            <p className="text-xs italic text-gray-400">No generated decisions.</p>
          ) : (
            <ul className="space-y-1.5">
              {generatedDecisions.map((link) => (
                <li key={`dec-${link.id}`}>
                  <Link
                    href={rewriteToV2(link, 'decision', projectId)}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-gray-800 transition hover:bg-gray-50"
                  >
                    <span className="truncate">{link.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Tasks
            </h3>
            <button
              type="button"
              onClick={createTask}
              disabled={creatingTask || readOnly}
              title={disabledTitle}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingTask ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3 w-3" aria-hidden="true" />
              )}
              <span>Create</span>
            </button>
          </div>
          {generatedTasks.length === 0 ? (
            <p className="text-xs italic text-gray-400">No generated tasks.</p>
          ) : (
            <ul className="space-y-1.5">
              {generatedTasks.map((link) => (
                <li key={`task-${link.id}`}>
                  <Link
                    href={rewriteToV2(link, 'task', projectId)}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-gray-800 transition hover:bg-gray-50"
                  >
                    <span className="truncate">{link.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
