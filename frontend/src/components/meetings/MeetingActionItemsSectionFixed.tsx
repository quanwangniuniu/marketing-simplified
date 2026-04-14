'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ChevronDown, Loader2, Plus, RefreshCcw, Square, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { MeetingsAPI } from '@/lib/api/meetingsApi';
import { TaskAPI } from '@/lib/api/taskApi';
import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import { Button } from '@/components/ui/button';
import type { MeetingActionItem } from '@/types/meeting';

interface MeetingActionItemsSectionProps {
  projectId: number;
  meetingId: number;
  compact?: boolean;
}

type MeetingTaskLite = {
  id: number;
  summary: string;
  origin_action_item_id?: number | null;
};

/** Must match backend `task.models.Task.Priority` (no URGENT). */
const PRIORITY_OPTIONS = ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'] as const;

/** API returns types in model order (budget first); avoid defaulting every meeting task to budget. */
function pickDefaultTaskTypeForMeeting(types: Array<{ value: string; label: string }>): string {
  const preferred = ['communication', 'execution', 'report', 'optimization', 'scaling', 'alert'];
  for (const p of preferred) {
    const hit = types.find((t) => t.value === p);
    if (hit) return hit.value;
  }
  return types[0]?.value ?? '';
}

/** Send ISO date only; avoids parsing quirks with datetimes. */
function normalizeDueDateForApi(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildConvertPayload(
  actionItem: MeetingActionItem,
  opts: {
    type: string;
    priority: string;
    ownerIdDraft: string;
    dueDateDraft: string;
    createAsDraft: boolean;
  },
) {
  const ownerId = opts.ownerIdDraft ? Number(opts.ownerIdDraft) : null;
  return {
    type: opts.type,
    priority: opts.priority,
    owner_id: Number.isFinite(ownerId) ? ownerId : null,
    due_date: normalizeDueDateForApi(opts.dueDateDraft),
    summary: actionItem.title,
    description: actionItem.description || null,
    create_as_draft: opts.createAsDraft,
  };
}

export function MeetingActionItemsSection({
  projectId,
  meetingId,
  compact = false,
}: MeetingActionItemsSectionProps) {
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [meetingTasks, setMeetingTasks] = useState<MeetingTaskLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [taskTypes, setTaskTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberData[]>([]);
  const [typeDraft, setTypeDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState('MEDIUM');
  const [ownerIdDraft, setOwnerIdDraft] = useState<string>('');
  const [dueDateDraft, setDueDateDraft] = useState('');
  /** Default off so tasks are submitted and show clearly on the project task board (not only Draft). */
  const [createAsDraft, setCreateAsDraft] = useState(false);

  const effectiveTaskType = typeDraft || taskTypes[0]?.value || '';

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => a.order_index - b.order_index || a.id - b.id),
    [items],
  );

  const convertedMap = useMemo(() => {
    const out = new Map<number, MeetingTaskLite>();
    for (const task of meetingTasks) {
      const originId = Number(task.origin_action_item_id);
      if (Number.isFinite(originId)) out.set(originId, task);
    }
    return out;
  }, [meetingTasks]);

  const tasksModuleHref = `/tasks?project_id=${projectId}`;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [actionItems, tasks, members, types] = await Promise.all([
        MeetingsAPI.listMeetingActionItems(projectId, meetingId),
        MeetingsAPI.listMeetingTasks(projectId, meetingId),
        ProjectAPI.getAllProjectMembers(projectId).catch(() => [] as ProjectMemberData[]),
        TaskAPI.getTaskTypes().catch(() => [] as Array<{ value: string; label: string }>),
      ]);
      setItems(Array.isArray(actionItems) ? actionItems : []);
      setMeetingTasks(Array.isArray(tasks) ? (tasks as MeetingTaskLite[]) : []);
      setProjectMembers(Array.isArray(members) ? members.filter((m) => m.is_active) : []);
      setTaskTypes(Array.isArray(types) ? types : []);
      if (!typeDraft && Array.isArray(types) && types.length > 0) {
        setTypeDraft(pickDefaultTaskTypeForMeeting(types));
      }
    } catch {
      setItems([]);
      setMeetingTasks([]);
      setProjectMembers([]);
      toast.error('Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, meetingId]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createItem = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error('Action item title is required');
      return;
    }
    setCreating(true);
    try {
      const nextOrder =
        orderedItems.length > 0 ? orderedItems[orderedItems.length - 1].order_index + 1 : 0;
      const created = await MeetingsAPI.createMeetingActionItem(projectId, meetingId, {
        title,
        description: newDescription.trim(),
        order_index: nextOrder,
      });
      setItems((prev) => [...prev, created]);
      setNewTitle('');
      setNewDescription('');
      toast.success('Action item created');
    } catch {
      toast.error('Failed to create action item');
    } finally {
      setCreating(false);
    }
  };

  const removeItem = async (actionItemId: number) => {
    if (busyId != null) return;
    setBusyId(actionItemId);
    try {
      await MeetingsAPI.deleteMeetingActionItem(projectId, meetingId, actionItemId);
      setItems((prev) => prev.filter((row) => row.id !== actionItemId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(actionItemId);
        return next;
      });
      toast.success('Action item deleted');
    } catch {
      toast.error('Failed to delete action item');
    } finally {
      setBusyId(null);
    }
  };

  const convertSingle = async (actionItem: MeetingActionItem) => {
    if (!effectiveTaskType) {
      toast.error('No task type available — check Tasks module configuration');
      return;
    }
    if (busyId != null) return;
    setBusyId(actionItem.id);
    try {
      await MeetingsAPI.convertMeetingActionItemToTask(
        projectId,
        meetingId,
        actionItem.id,
        buildConvertPayload(actionItem, {
          type: effectiveTaskType,
          priority: priorityDraft,
          ownerIdDraft,
          dueDateDraft,
          createAsDraft,
        }),
      );
      await loadAll();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agent:tasks-changed'));
      }
      toast.success('Task created — open Tasks module to verify');
    } catch {
      toast.error('Conversion failed (already converted or invalid payload)');
    } finally {
      setBusyId(null);
    }
  };

  const bulkConvert = async () => {
    if (!effectiveTaskType) {
      toast.error('No task type available — check Tasks module configuration');
      return;
    }
    const ids = orderedItems
      .map((item) => item.id)
      .filter((id) => selectedIds.has(id))
      .filter((id) => !convertedMap.has(id));
    if (ids.length === 0) {
      toast.error('Select at least one unconverted action item');
      return;
    }
    setBulkBusy(true);
    try {
      const ownerId = ownerIdDraft ? Number(ownerIdDraft) : null;
      const result = await MeetingsAPI.bulkConvertMeetingActionItemsToTasks(projectId, meetingId, {
        items: ids.map((action_item_id) => ({
          action_item_id,
          type: effectiveTaskType,
          priority: priorityDraft,
          owner_id: Number.isFinite(ownerId) ? ownerId : null,
          due_date: normalizeDueDateForApi(dueDateDraft),
          create_as_draft: createAsDraft,
        })),
      });
      const createdCount = Array.isArray(result) ? result.length : 0;
      const skippedCount = Math.max(0, ids.length - createdCount);
      await loadAll();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agent:tasks-changed'));
      }
      toast.success(`Created ${createdCount} task(s), skipped ${skippedCount} — check Tasks module`);
    } catch {
      toast.error('Bulk conversion failed');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Action Items → Tasks</h3>
          <p className="mt-0.5 text-xs text-gray-600">
            One-click <span className="font-medium text-gray-800">Convert</span> uses smart defaults.
            <Link
              href={tasksModuleHref}
              className="ml-1.5 font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:text-blue-800"
            >
              Open Tasks module (this project)
            </Link>
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCcw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className={`grid gap-2 ${compact ? '' : 'md:grid-cols-2'}`}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New action item — e.g. Send revised media plan to client"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Context (optional)"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mt-2">
        <Button type="button" size="sm" onClick={() => void createItem()} disabled={creating || !newTitle.trim()}>
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add action item
        </Button>
      </div>

      <details className="group mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-gray-800">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
          Optional: task type, assignee, due date, draft
          <span className="font-normal text-gray-500">— only if you need to override defaults</span>
        </summary>
        <div className={`mt-3 grid gap-2 ${compact ? '' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          <select
            value={typeDraft || (taskTypes[0]?.value ?? '')}
            onChange={(e) => setTypeDraft(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {taskTypes.length === 0 ? (
              <option value="">Loading types…</option>
            ) : (
              taskTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            )}
          </select>

          <select
            value={priorityDraft}
            onChange={(e) => setPriorityDraft(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={ownerIdDraft}
            onChange={(e) => setOwnerIdDraft(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Owner: me (default)</option>
            {projectMembers.map((m) => (
              <option key={m.user.id} value={String(m.user.id)}>
                {m.user.username}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dueDateDraft}
            onChange={(e) => setDueDateDraft(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <label className="inline-flex items-center gap-2 text-xs text-gray-700 md:col-span-2">
            <input
              type="checkbox"
              checked={createAsDraft}
              onChange={(e) => setCreateAsDraft(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Keep as draft only (stays in Draft column until submitted manually)
          </label>
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds(new Set(orderedItems.map((i) => i.id)))}>
          <CheckSquare className="h-3.5 w-3.5" />
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
          <Square className="h-3.5 w-3.5" />
          Clear
        </Button>
        <Button type="button" size="sm" onClick={() => void bulkConvert()} disabled={bulkBusy || loading}>
          {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Bulk convert selected
        </Button>
      </div>

      <div className="mt-4 grid gap-2">
        {loading ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            Loading action items...
          </div>
        ) : orderedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            No action items yet.
          </div>
        ) : (
          orderedItems.map((item) => {
            const linkedTask = convertedMap.get(item.id);
            const isConverted = Boolean(linkedTask) || item.converted_task_id != null;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    className="mt-1 h-3.5 w-3.5 rounded border-gray-300"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.title}</div>
                    {item.description ? <div className="text-xs text-gray-600">{item.description}</div> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>#{item.order_index}</span>
                      {isConverted ? (
                        <>
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                            Task #{linkedTask?.id ?? '?'}
                          </span>
                          {linkedTask?.id ? (
                            <Link
                              href={tasksModuleHref}
                              className="font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:text-blue-800"
                            >
                              View in Tasks module
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Not converted</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isConverted || busyId === item.id}
                    onClick={() => void convertSingle(item)}
                  >
                    {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Convert
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void removeItem(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
