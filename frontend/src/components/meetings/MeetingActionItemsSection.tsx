'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CheckSquare, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import { TaskAPI } from '@/lib/api/taskApi';
import { formatMeetingsApiError } from '@/lib/meetingsApiErrors';
import { formatProjectMemberLabel } from '@/components/meetings/projectMemberLabel';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import type { MeetingActionItem } from '@/types/meeting';

// Keep this intentionally small: the product only wants "extremes" for meeting action item conversion.
const PRIORITIES = ['HIGHEST', 'LOWEST'] as const;

export interface MeetingActionItemsSectionProps {
  projectId: number;
  meetingId: number;
  projectMembers: ProjectMemberData[];
  onChanged?: () => void;
}

export function MeetingActionItemsSection({
  projectId,
  meetingId,
  projectMembers,
  onChanged,
}: MeetingActionItemsSectionProps) {
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskTypes, setTaskTypes] = useState<{ value: string; label: string }[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [openConvertId, setOpenConvertId] = useState<number | null>(null);
  const [convertOwnerId, setConvertOwnerId] = useState<number | ''>('');
  const [convertDue, setConvertDue] = useState('');
  const [convertPriority, setConvertPriority] = useState<string>('HIGHEST');
  const [convertType, setConvertType] = useState('execution');

  const defaultOwnerId = useMemo(() => {
    const m = projectMembers[0];
    return m ? m.user.id : '';
  }, [projectMembers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, types] = await Promise.all([
        MeetingsAPI.listMeetingActionItems(projectId, meetingId),
        TaskAPI.getTaskTypes().catch(() => []),
      ]);
      setItems(list);
      setTaskTypes(types);
    } catch {
      setItems([]);
      toast.error('Could not load action items');
    } finally {
      setLoading(false);
    }
  }, [projectId, meetingId]);

  useEffect(() => {
    if (taskTypes.length === 0) return;
    setConvertType((prev) =>
      taskTypes.some((t) => t.value === prev) ? prev : taskTypes[0].value,
    );
  }, [taskTypes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (convertOwnerId === '' && defaultOwnerId !== '') {
      setConvertOwnerId(defaultOwnerId);
    }
  }, [defaultOwnerId, convertOwnerId]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addItem = async () => {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const created = await MeetingsAPI.createMeetingActionItem(projectId, meetingId, {
        title: newTitle.trim(),
        description: newDescription.trim(),
        order_index: items.length,
      });
      setItems((prev) => [...prev, created]);
      setNewTitle('');
      setNewDescription('');
      toast.success('Action item added');
      onChanged?.();
    } catch (e) {
      toast.error(formatMeetingsApiError(e, 'Could not add action item'));
    } finally {
      setAdding(false);
    }
  };

  const removeItem = async (row: MeetingActionItem) => {
    if (row.converted_task_id != null) {
      toast.error('Cannot delete an item that already has a task');
      return;
    }
    if (!window.confirm('Remove this action item?')) return;
    try {
      await MeetingsAPI.deleteMeetingActionItem(projectId, meetingId, row.id);
      setItems((prev) => prev.filter((x) => x.id !== row.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      toast.success('Removed');
      onChanged?.();
    } catch (e) {
      toast.error(formatMeetingsApiError(e, 'Could not remove'));
    }
  };

  const convertOne = async (actionItemId: number) => {
    if (convertOwnerId === '' || rowBusy != null) return;
    setRowBusy(actionItemId);
    try {
      const createdTask = await MeetingsAPI.convertMeetingActionItemToTask(
        projectId,
        meetingId,
        actionItemId,
        {
        owner_id: Number(convertOwnerId),
        due_date: convertDue.trim() || null,
        priority: convertPriority,
        type: convertType,
        },
      );
      const createdTaskId =
        typeof createdTask.id === 'number' ? createdTask.id : null;
      setItems((prev) =>
        prev.map((item) =>
          item.id === actionItemId
            ? { ...item, converted_task_id: createdTaskId }
            : item,
        ),
      );
      toast.success('Task created');
      setOpenConvertId(null);
      // Keep server as source of truth, but UI should reflect conversion immediately.
      void load();
      onChanged?.();
    } catch (e) {
      toast.error(formatMeetingsApiError(e, 'Could not convert'));
    } finally {
      setRowBusy(null);
    }
  };

  const bulkConvert = async () => {
    const ids = items
      .filter((i) => selected.has(i.id) && i.converted_task_id == null)
      .map((i) => i.id);
    if (ids.length < 1 || bulkBusy || convertOwnerId === '') return;
    setBulkBusy(true);
    try {
      const tasks = await MeetingsAPI.bulkConvertMeetingActionItemsToTasks(projectId, meetingId, {
        items: ids.map((action_item_id) => ({
          action_item_id,
          owner_id: Number(convertOwnerId),
          due_date: convertDue.trim() || null,
          priority: convertPriority,
          type: convertType,
        })),
      });
      // Align selected rows immediately with returned tasks order.
      setItems((prev) => {
        const nextTaskIdByActionItemId = new Map<number, number>();
        ids.forEach((actionItemId, idx) => {
          const task = tasks[idx];
          if (task?.id) nextTaskIdByActionItemId.set(actionItemId, task.id);
        });
        return prev.map((item) =>
          nextTaskIdByActionItemId.has(item.id)
            ? { ...item, converted_task_id: nextTaskIdByActionItemId.get(item.id) ?? item.converted_task_id }
            : item,
        );
      });
      toast.success(`Created ${ids.length} task(s)`);
      setSelected(new Set());
      void load();
      onChanged?.();
    } catch (e) {
      toast.error(formatMeetingsApiError(e, 'Bulk convert failed'));
    } finally {
      setBulkBusy(false);
    }
  };

  const selectableIds = items.filter((i) => i.converted_task_id == null).map((i) => i.id);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-slate-500">Loading action items…</p>
      ) : (
        <>
          <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-700">Add action item</p>
            <input
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Description (optional)"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={adding || !newTitle.trim()}
              onClick={() => void addItem()}
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span className="ml-1">Add</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 pb-2">
            <div>
              <label className="block text-[10px] font-medium text-slate-500">Owner (convert)</label>
              <select
                className="mt-0.5 rounded border border-slate-200 px-2 py-1 text-xs"
                value={convertOwnerId === '' ? '' : String(convertOwnerId)}
                onChange={(e) => setConvertOwnerId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select…</option>
                {projectMembers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {formatProjectMemberLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500">Due</label>
              <input
                type="date"
                className="mt-0.5 rounded border border-slate-200 px-2 py-1 text-xs"
                value={convertDue}
                onChange={(e) => setConvertDue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500">Priority</label>
              <select
                className="mt-0.5 rounded border border-slate-200 px-2 py-1 text-xs"
                value={convertPriority}
                onChange={(e) => setConvertPriority(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500">Type</label>
              <select
                className="mt-0.5 max-w-[140px] rounded border border-slate-200 px-2 py-1 text-xs"
                value={convertType}
                onChange={(e) => setConvertType(e.target.value)}
              >
                {taskTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                bulkBusy ||
                selected.size < 1 ||
                convertOwnerId === '' ||
                selectableIds.length === 0
              }
              onClick={() => void bulkConvert()}
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckSquare className="h-3.5 w-3.5" />
              )}
              <span className="ml-1">Convert selected</span>
            </Button>
          </div>

          <ul className="space-y-2">
            {items.length === 0 ? (
              <li className="text-xs text-slate-500">No action items yet.</li>
            ) : (
              items.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(row.id)}
                      disabled={row.converted_task_id != null}
                      onChange={() => toggleSelect(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{row.title}</p>
                        {row.converted_task_id != null ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Converted
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Not converted
                          </span>
                        )}
                      </div>
                      {row.description ? (
                        <p className="mt-0.5 text-xs text-slate-600 whitespace-pre-wrap">
                          {row.description}
                        </p>
                      ) : null}
                      {row.converted_task_id != null ? (
                        <Link
                          href={`/tasks/${row.converted_task_id}`}
                          className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
                        >
                          Open task #{row.converted_task_id}
                        </Link>
                      ) : openConvertId === row.id ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={rowBusy === row.id || convertOwnerId === ''}
                            onClick={() => void convertOne(row.id)}
                          >
                            {rowBusy === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            <span className="ml-1">Create task</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpenConvertId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setOpenConvertId(row.id)}
                            disabled={row.converted_task_id != null}
                          >
                            Convert
                          </Button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            disabled={row.converted_task_id != null}
                            onClick={() => void removeItem(row)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
