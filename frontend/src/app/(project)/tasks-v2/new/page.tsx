'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import { useProjectStore } from '@/lib/projectStore';
import { TaskAPI } from '@/lib/api/taskApi';
import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import TaskTypeFieldsSection, { fieldId } from '@/components/tasks-v2/new/TaskTypeFieldsSection';
import TaskCreateChecklistAside, {
  type ChecklistItem,
} from '@/components/tasks-v2/new/TaskCreateChecklistAside';
import { getTypeSchema, getUnfilledRequiredKeys } from '@/lib/tasks-v2/typeFieldSchemas';
import { TASK_TYPE_CONFIG_STATIC } from '@/lib/taskTypeConfigRegistry';

const PRIORITIES: { value: string; label: string }[] = [
  { value: 'HIGHEST', label: 'Highest' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'LOWEST', label: 'Lowest' },
];

const BRAND_GRADIENT = 'linear-gradient(90deg, #3CCED7 0%, #A6E661 100%)';

const todayIso = () => new Date().toISOString().slice(0, 10);

const COMMON_ANCHOR = {
  summary: 'task-common-summary',
  type: 'task-common-type',
  priority: 'task-common-priority',
  schedule: 'task-common-schedule',
  approver: 'task-common-approver',
};

function flashAndFocus(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-2', 'ring-[#3CCED7]', 'ring-offset-2', 'rounded-md');
  const focusable =
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
      ? (el as HTMLInputElement)
      : (el.querySelector('input, textarea, select, button') as HTMLElement | null);
  if (focusable) focusable.focus();
  setTimeout(() => {
    el.classList.remove('ring-2', 'ring-[#3CCED7]', 'ring-offset-2', 'rounded-md');
  }, 1500);
}

export default function CreateTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const linkDecisionIdParam = searchParams?.get('link_decision_id');
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = projectIdParam
    ? Number(projectIdParam)
    : activeProject?.id ?? null;
  const linkDecisionId =
    linkDecisionIdParam && Number.isFinite(Number(linkDecisionIdParam))
      ? Number(linkDecisionIdParam)
      : null;

  const [taskTypes, setTaskTypes] = useState<{ value: string; label: string }[]>([]);
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [submitting, setSubmitting] = useState<'submit' | 'draft' | null>(null);

  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [approverId, setApproverId] = useState('');
  const [typeFormState, setTypeFormState] = useState<Record<string, string>>({});

  useEffect(() => {
    TaskAPI.getTaskTypes()
      .then(setTaskTypes)
      .catch(() => toast.error('Failed to load task types'));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    ProjectAPI.getProjectMembers(projectId)
      .then(setMembers)
      .catch(() => {
        // Members are optional for the form; surface silently.
      });
  }, [projectId]);

  const schema = useMemo(() => getTypeSchema(type), [type]);

  const updateTypeField = useCallback((key: string, value: string) => {
    setTypeFormState((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Reset type-specific fields when the type changes so stale values don't leak.
  useEffect(() => {
    setTypeFormState({});
  }, [type]);

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const base: ChecklistItem[] = [
      {
        key: 'summary',
        label: 'Summary',
        required: true,
        filled: summary.trim().length > 0,
        anchorId: COMMON_ANCHOR.summary,
      },
      {
        key: 'type',
        label: 'Work type',
        required: true,
        filled: type.length > 0,
        anchorId: COMMON_ANCHOR.type,
      },
      {
        key: 'priority',
        label: 'Priority',
        required: false,
        filled: priority.length > 0,
        anchorId: COMMON_ANCHOR.priority,
      },
      {
        key: 'dates',
        label: 'Dates',
        required: false,
        filled: Boolean(plannedStartDate || startDate || dueDate),
        anchorId: COMMON_ANCHOR.schedule,
      },
      {
        key: 'approver',
        label: 'Approver',
        required: false,
        filled: approverId.length > 0,
        anchorId: COMMON_ANCHOR.approver,
      },
    ];
    if (schema) {
      for (const field of schema.fields) {
        const filled = (typeFormState[field.key] ?? '').toString().trim().length > 0;
        base.push({
          key: `schema:${field.key}`,
          label: field.label,
          required: field.required,
          filled,
          anchorId: fieldId(schema.type, field.key),
        });
      }
    }
    return base;
  }, [summary, type, priority, approverId, plannedStartDate, startDate, dueDate, schema, typeFormState]);

  const allRequiredReady = useMemo(
    () => checklistItems.filter((i) => i.required).every((i) => i.filled),
    [checklistItems],
  );

  const onJump = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (!el) return;
    flashAndFocus(el);
  }, []);

  const submit = async (asDraft: boolean) => {
    if (!projectId) {
      toast.error('No active project. Pick a project first.');
      return;
    }
    if (!allRequiredReady) {
      toast.error('Fill all required fields first.');
      return;
    }
    setSubmitting(asDraft ? 'draft' : 'submit');
    try {
      const payload: Record<string, unknown> = {
        summary: summary.trim(),
        description: description.trim() || undefined,
        type,
        project_id: projectId,
        priority,
        create_as_draft: asDraft,
      };
      if (approverId) payload.current_approver_id = Number(approverId);
      if (plannedStartDate) payload.planned_start_date = plannedStartDate;
      if (startDate) payload.start_date = startDate;
      if (dueDate) payload.due_date = dueDate;

      const res = await TaskAPI.createTask(payload as never);
      const createdTask = (res?.data as any) ?? {};
      const createdTaskId = createdTask.id;

      if (linkDecisionId && createdTaskId) {
        try {
          await TaskAPI.linkTask(createdTaskId, 'decision', String(linkDecisionId));
        } catch {
          toast.error('Task created but failed to link to decision');
        }
      }

      if (schema && createdTaskId) {
        const missing = getUnfilledRequiredKeys(schema, typeFormState);
        if (missing.length > 0) {
          toast.error(`Missing required fields: ${missing.join(', ')}`);
          return;
        }
        const cfg = TASK_TYPE_CONFIG_STATIC[schema.type];
        if (cfg) {
          try {
            const subPayload = cfg.getPayload(
              typeFormState,
              {
                project_id: projectId,
                summary: summary.trim(),
                current_approver_id: approverId ? Number(approverId) : null,
              },
              { id: createdTaskId },
            );
            if (subPayload) {
              const subRes: any = await cfg.api(subPayload);
              const subId = (subRes?.data as any)?.id ?? (subRes as any)?.id ?? null;
              if (subId) {
                await TaskAPI.linkTask(createdTaskId, cfg.contentType, String(subId));
              }
            }
          } catch {
            toast.error('Task created but failed to save type-specific fields. You can edit the task to retry.');
          }
        }
      }

      toast.success(asDraft ? 'Saved as draft' : 'Task submitted for review');
      if (linkDecisionId) {
        const qs = projectId ? `?project_id=${projectId}` : '';
        router.push(`/decisions-v2/${linkDecisionId}${qs}`);
      } else {
        router.push('/tasks-v2');
      }
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string; detail?: string } };
        message?: string;
      };
      toast.error(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.message ||
          'Failed to create task',
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <button
          type="button"
          onClick={() => {
            if (linkDecisionId) {
              const qs = projectId ? `?project_id=${projectId}` : '';
              router.push(`/decisions-v2/${linkDecisionId}${qs}`);
            } else {
              router.push('/tasks-v2');
            }
          }}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {linkDecisionId ? `Back to decision #${linkDecisionId}` : 'Back to tasks'}
        </button>
        {linkDecisionId && (
          <div className="mb-4 rounded-md border border-[#3CCED7]/30 bg-[#3CCED7]/5 px-3 py-2 text-[12px] text-gray-700">
            This task will be linked to <span className="font-medium">Decision #{linkDecisionId}</span> on create.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="h-[3px] w-full" style={{ background: BRAND_GRADIENT }} aria-hidden />

            <div id={COMMON_ANCHOR.summary} className="px-8 pt-7 pb-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                New task in {activeProject?.name ?? 'project'}
              </p>
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summary of this task"
                className="mt-2 w-full border-0 bg-transparent p-0 text-[22px] font-semibold leading-tight text-gray-900 outline-none placeholder:text-gray-300 focus:border-b-2 focus:border-[#3CCED7]"
                autoFocus
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add some details (optional)"
                rows={2}
                className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-gray-700 outline-none placeholder:text-gray-300"
              />
            </div>

            <div className="my-2 border-t border-gray-100" />

            <div id={COMMON_ANCHOR.type} className="px-8 py-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Work type *
              </p>
              <div className="flex flex-wrap gap-2">
                {taskTypes.map((t) => {
                  const selected = t.value === type;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        selected
                          ? 'border border-transparent bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                          : 'border border-transparent bg-gray-100 text-gray-700 hover:border-[#3CCED7]/40'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {schema && (
              <>
                <div className="my-2 border-t border-gray-100" />
                <div className="px-8 py-5">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    {schema.label} details
                  </p>
                  <TaskTypeFieldsSection
                    schema={schema}
                    values={typeFormState}
                    onChange={updateTypeField}
                  />
                </div>
              </>
            )}

            <div id={COMMON_ANCHOR.priority} className="px-8 py-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Priority
              </p>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => {
                  const selected = p.value === priority;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        selected
                          ? 'border border-transparent bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                          : 'border border-transparent bg-gray-100 text-gray-700 hover:border-[#3CCED7]/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="my-2 border-t border-gray-100" />

            <div id={COMMON_ANCHOR.schedule} className="px-8 py-5">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Schedule
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateField
                  label="Planned start"
                  value={plannedStartDate}
                  onChange={setPlannedStartDate}
                  placeholder={todayIso()}
                />
                <DateField
                  label="Actual start"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder={todayIso()}
                />
                <DateField
                  label="Due"
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder={todayIso()}
                />
              </div>
            </div>

            <div id={COMMON_ANCHOR.approver} className="px-8 py-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Approver
              </p>
              <select
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.username || m.user.name || `User ${m.user.id}`}
                    {m.user.email ? ` · ${m.user.email}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-8 py-4">
              <button
                type="button"
                onClick={() => router.push('/tasks-v2')}
                disabled={submitting !== null}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={submitting !== null || !allRequiredReady}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                {submitting === 'draft' ? 'Saving…' : 'Save as draft'}
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={submitting !== null || !allRequiredReady}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting === 'submit' ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create task'
                )}
              </button>
            </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
            <TaskCreateChecklistAside items={checklistItems} onJump={onJump} />
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 text-xs text-gray-500 leading-5">
              Drafts can be edited later. Submitting routes the task into the approval chain configured for this project + work type.
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

function DateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
      />
    </div>
  );
}
