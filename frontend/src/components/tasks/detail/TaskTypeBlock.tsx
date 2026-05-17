'use client';

import { useState, useEffect } from 'react';
import { Pencil, X, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TaskData } from '@/types/task';
import { Skeleton } from '@/components/ui/skeleton';
import { getTypeSchema } from '@/lib/tasks/typeFieldSchemas';
import { TASK_TYPE_CONFIG_STATIC } from '@/lib/taskTypeConfigRegistry';
import TaskTypeFieldsSection from '@/components/tasks/new/TaskTypeFieldsSection';
import { TaskAPI } from '@/lib/api/taskApi';
import { loadFieldOptions } from '@/lib/tasks/typeFieldOptions';

function prettyLabel(type?: string): string {
  if (!type) return 'Work type';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyValue(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) {
    const items = v.filter((x) => x !== null && x !== undefined && x !== '');
    if (items.length === 0) return null;
    return items.map((x) => (typeof x === 'string' ? x.replace(/_/g, ' ') : String(x))).join(', ');
  }
  if (typeof v === 'object') {
    const parts = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val !== null && val !== undefined && val !== '')
      .map(([k, val]) => `${k.replace(/_/g, ' ')}: ${String(val)}`);
    return parts.length ? parts.join(' · ') : null;
  }
  if (typeof v === 'string') return v.replace(/_/g, ' ');
  return String(v);
}

const HIDDEN_KEYS = new Set(['id', 'task', 'task_id', 'created_at', 'updated_at']);

// Keys that are raw IDs, computed duplicates, or internal fields not worth surfacing (all types)
const REDUNDANT_ID_KEYS = new Set([
  // budget
  'current_approver', 'ad_channel', 'budget_pool_id', 'budget_pool_composite', 'is_escalated', 'status',
  // asset
  'owner',
  // retrospective
  'kpi_count', 'insight_count', 'campaign', 'status_display',
  // policy — hide internal/computed fields; creation-form fields are shown
  'all_impacts_addressed',
  'created_by_id', 'assigned_to_id', 'reviewed_by_id', 'task_id',
  'created_by', 'assigned_to', 'reviewed_by',
  'mitigation_status',
  'mitigation_plan', 'mitigation_steps', 'mitigation_execution_notes',
  'mitigation_completed_at', 'mitigation_results',
  'post_mitigation_review', 'review_completed_at',
  'lessons_learned', 'related_references',
  // report
  'audience_prompt_version', 'prompt_template', 'key_actions', 'is_complete',
  // experiment
  'start_date', 'end_date', 'control_group', 'variant_group', 'name',
  // optimization — complex JSON fields need the full detail page editor
  'affected_entity_ids', 'triggered_metrics', 'baseline_metrics', 'observed_metrics',
  'executed_at', 'monitored_at', 'rationale',
]);

// Additional keys to hide per task type
const TYPE_HIDDEN_KEYS: Record<string, Set<string>> = {
  policy: new Set(['notes']),
};

// Human-readable labels for known keys
const KEY_LABELS: Record<string, string> = {
  requested_by: 'Requested by',
  current_approver_name: 'Approver',
  ad_channel_name: 'Ad channel',
  is_escalated: 'Escalated',
  budget_pool: 'Budget pool',
  submitted_at: 'Submitted at',
  campaign_name: 'Campaign',
  campaign_description: 'Campaign description',
  // experiment
  experiment_outcome: 'Outcome',
  outcome_notes: 'Outcome notes',
  // retrospective
  outcome_compared_to_expectation: 'Outcome vs expectation',
  biggest_wrong_assumption: 'Biggest wrong assumption',
  would_make_same_decision_again: 'Same decision again?',
  report_url: 'Report URL',
  // scaling
  review_summary: 'Review summary',
  review_lessons_learned: 'Lessons learned',
  review_future_actions: 'Future actions',
  // alert
  postmortem_root_cause: 'Root cause',
  postmortem_prevention: 'Prevention',
  // optimization
  planned_action: 'Planned action',
  execution_status: 'Execution status',
  // policy
  platform: 'Platform',
  policy_change_type: 'Change type',
  policy_description: 'Description',
  policy_reference_url: 'Reference URL',
  effective_date: 'Effective date',
  affected_campaigns: 'Affected campaigns',
  affected_ad_sets: 'Affected ad sets',
  affected_assets: 'Affected assets',
  performance_impact: 'Performance impact',
  budget_impact: 'Budget impact',
  compliance_risk: 'Compliance risk',
  immediate_actions_required: 'Immediate actions',
  action_deadline: 'Action deadline',
};

function labelFor(key: string): string {
  return KEY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_KEYS = new Set(['execution_status']);

const DATETIME_KEYS = new Set(['submitted_at']);

function formatLocalDatetime(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return null;
  }
}

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  completed:  'bg-green-50 text-green-800',
  monitoring: 'bg-[#3CCED7]/10 text-[#1a9ba3]',
  executed:   'bg-purple-50 text-purple-800',
  planned:    'bg-yellow-50 text-yellow-800',
  cancelled:  'bg-red-50 text-red-800',
  detected:   'bg-gray-50 text-gray-800',
};

type EntryKind = 'text' | 'array' | 'status';
type TypedEntry = [string, string, EntryKind];

function flattenEntries(obj: Record<string, unknown>, taskType?: string): TypedEntry[] {
  const typeHidden = taskType ? (TYPE_HIDDEN_KEYS[taskType] ?? null) : null;
  const result: TypedEntry[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (HIDDEN_KEYS.has(k) || REDUNDANT_ID_KEYS.has(k) || typeHidden?.has(k)) continue;
    if (Array.isArray(v)) {
      const items = v.filter((x) => x !== null && x !== undefined && x !== '') as string[];
      if (items.length > 0) result.push([k, items.join('\x00'), 'array']);
    } else if (k === 'budget_pool' && typeof v === 'string') {
      // Resolved label string injected from draft_payload pool lookup
      if (v.trim()) result.push([k, v, 'text']);
    } else if (v !== null && v !== undefined && typeof v === 'object') {
      const rec = v as Record<string, unknown>;
      if (k === 'budget_pool') {
        const namePart = rec.name ? `${rec.name} · ` : '';
        const avail = rec.available_amount != null ? Number(rec.available_amount).toLocaleString() : '?';
        result.push([k, `${namePart}${rec.currency} (available: ${avail})`, 'text']);
        continue;
      }
      const display = prettyValue(v);
      if (display !== null) result.push([k, display, 'text']);
    } else if (STATUS_KEYS.has(k)) {
      const display = prettyValue(v);
      if (display !== null) result.push([k, display, 'status']);
    } else if (DATETIME_KEYS.has(k)) {
      const display = formatLocalDatetime(v);
      if (display !== null) result.push([k, display, 'text']);
    } else {
      const display = prettyValue(v);
      if (display !== null) result.push([k, display, 'text']);
    }
  }
  return result.slice(0, 30);
}

export default function TaskTypeBlock({
  task,
  loading = false,
  readOnly = false,
  onUpdated,
}: {
  task: TaskData;
  loading?: boolean;
  readOnly?: boolean;
  onUpdated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const linked = task.linked_object as Record<string, unknown> | null | undefined;
  const config = task.type ? TASK_TYPE_CONFIG_STATIC[task.type] : null;
  const schema = task.type ? getTypeSchema(task.type) : null;
  const linkedId = linked?.id as number | string | undefined;

  const hasLinked = linked && typeof linked === 'object' && Object.keys(linked).length > 0;
  const rawDraftPayload = task.draft_payload as Record<string, unknown> | null | undefined;
  // In DRAFT mode, draft_payload is the working copy — prefer it over the linked object for display/edit.
  // In other statuses, only use draft_payload when there's no linked object.
  const draftPayload = task.status === 'DRAFT'
    ? (rawDraftPayload ?? null)
    : (!hasLinked ? rawDraftPayload : null);

  // When showing from draft_payload for a budget task, resolve the pool label from options
  const draftComposite = draftPayload ? String(draftPayload.budget_pool_composite ?? '') : '';
  const [draftBudgetPoolLabel, setDraftBudgetPoolLabel] = useState<string | null>(null);
  // Derive currency and ad_channel_name from the composite/label so they show immediately
  // without waiting for a linked BudgetRequest to exist.
  const draftCurrency = draftComposite ? draftComposite.split(':')[2] || null : null;
  const draftAdChannelName = draftBudgetPoolLabel
    ? draftBudgetPoolLabel.split(' · ')[0].split(' – ')[0] || null
    : null;
  // Strip the channel name prefix from the pool label so Budget Pool doesn't duplicate
  // what's already shown in the Ad Channel field.
  // Format: "{channel}[ · {poolName}] – {currency} ..." → "{poolName} – {currency} ..."
  const draftBudgetPoolDisplay = draftBudgetPoolLabel
    ? (() => {
        const dotIdx = draftBudgetPoolLabel.indexOf(' · ');
        if (dotIdx >= 0) return draftBudgetPoolLabel.slice(dotIdx + 3);
        const dashIdx = draftBudgetPoolLabel.indexOf(' – ');
        return dashIdx >= 0 ? draftBudgetPoolLabel.slice(dashIdx + 3) : draftBudgetPoolLabel;
      })()
    : null;
  useEffect(() => {
    if (!draftComposite) { setDraftBudgetPoolLabel(null); return; }
    let cancelled = false;
    loadFieldOptions('budget.pools', { projectId: task.project_id })
      .then((opts) => {
        if (cancelled) return;
        setDraftBudgetPoolLabel(opts.find((o) => o.value === draftComposite)?.label ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [draftComposite, task.project_id]);

  // Only render if loading, or there's a linked object, draft_payload, or the task type has an editable schema
  if (!loading && !hasLinked && !draftPayload && !schema) return null;

  // Build display object.
  // In DRAFT mode: prefer draft_payload (working copy) and fall back to linked object for any missing fields.
  // In other statuses: use linked object; fall back to draft_payload only when no linked object exists.
  let displayObj: Record<string, unknown>;
  if (task.status === 'DRAFT' && rawDraftPayload) {
    const base: Record<string, unknown> = { ...(hasLinked ? linked! : {}), ...rawDraftPayload };
    // When a field is cleared in draft_payload, also remove its derived _name counterpart
    // so the display doesn't show stale data from the linked object (e.g. current_approver_name).
    for (const [k, v] of Object.entries(rawDraftPayload)) {
      if (v === '' || v === null || v === undefined) {
        delete base[`${k}_name`];
      }
    }
    // If budget pool composite is cleared, remove pool and all derived fields
    if (!rawDraftPayload.budget_pool_composite) {
      delete base.budget_pool;
      delete base.currency;
      delete base.ad_channel_name;
    }
    if (draftBudgetPoolDisplay) {
      base.budget_pool = draftBudgetPoolDisplay;
      if (draftCurrency) base.currency = draftCurrency;
      if (draftAdChannelName) base.ad_channel_name = draftAdChannelName;
    }
    displayObj = base;
  } else if (hasLinked) {
    displayObj = linked!;
  } else {
    displayObj = {
      ...(draftPayload ?? {}),
      ...(draftBudgetPoolDisplay ? {
        budget_pool: draftBudgetPoolDisplay,
        ...(draftCurrency ? { currency: draftCurrency } : {}),
        ...(draftAdChannelName ? { ad_channel_name: draftAdChannelName } : {}),
      } : {}),
    };
  }

  // When the task has its own current_approver set, override current_approver_name in
  // displayObj so the details section stays in sync with the properties panel after
  // any inline list edit (which patches task.current_approver_id, not the linked object).
  const taskApproverName = task.current_approver
    ? (task.current_approver.name || task.current_approver.username || task.current_approver.email || null)
    : null;
  if (taskApproverName !== null) {
    displayObj = { ...displayObj, current_approver_name: taskApproverName };
  }

  const rawEntries = flattenEntries(displayObj, task.type ?? undefined);
  const entries = task.status === 'DRAFT'
    ? rawEntries.filter(([k]) => k !== 'submitted_at')
    : rawEntries;

  // Required fields missing from either the linked object or draft_payload
  const missingRequiredFields = task.status === 'DRAFT' && schema
    ? (schema.editFields ?? schema.fields).filter((f) => {
        if (!f.required) return false;
        const checkData = editing ? formState : (displayObj as Record<string, unknown>);
        if (f.showWhen && !f.showWhen(checkData)) return false;
        const checkKey = (!editing && hasLinked) ? (f.linkedKey ?? f.key) : f.key;
        const val = checkData[checkKey];
        return !val || !String(val).trim();
      })
    : [];

  const startEdit = () => {
    if (!config) return;
    // In DRAFT mode, draft_payload is the working copy — init from it if available,
    // merging over the linked object so fields absent from draft_payload still populate.
    let initSource: Record<string, unknown>;
    if (task.status === 'DRAFT' && rawDraftPayload) {
      initSource = { ...(hasLinked ? linked! : {}), ...rawDraftPayload };
    } else if (hasLinked) {
      initSource = linked!;
    } else {
      initSource = rawDraftPayload ?? {};
    }
    setFormState(config.initEditState(initSource));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormState({});
  };

  const saveEdit = async () => {
    if (!config) return;
    if (task.type === 'experiment' && formState.experiment_outcome) {
      const expStatus = (linked as any)?.status;
      if (expStatus && expStatus !== 'completed') {
        toast.error('Experiment outcome can only be set once the experiment status is "Completed".');
        return;
      }
    }
    setSaving(true);
    try {
      if (linkedId) {
        // Linked object already exists — try to update it.
        // In DRAFT status, any failure (partial data, validation, etc.) silently falls back to draft_payload.
        if (task.status === 'DRAFT' && task.id) {
          // Always persist form state to draft_payload first (captures cleared fields).
          await TaskAPI.updateTask(task.id, { draft_payload: formState });
          // Then try to update the linked object with whatever is valid.
          try {
            await config.updateApi(linkedId, config.getUpdatePayload(formState));
          } catch {
            // Update failed (partial data) — draft_payload already saved above, just finish.
          }
        } else {
          await config.updateApi(linkedId, config.getUpdatePayload(formState));
        }
      } else {
        // No linked object yet — create it, passing the existing task as context
        const payload = config.getPayload(formState, task, task as any);
        if (!payload) {
          if (task.id) {
            // Payload can't be built yet (some required fields missing).
            // Save form state to draft_payload so nothing is lost.
            await TaskAPI.updateTask(task.id, { draft_payload: formState });
            toast.success('Details saved.');
            setEditing(false);
            onUpdated?.();
            return;
          }
          return;
        }
        try {
          const createRes = await config.api(payload);
          // Set the GFK on the task so lock/unlock/approval sync can find the linked object
          const createdId = (createRes as any)?.data?.id;
          if (task.id) {
            if (createdId && config.contentType) {
              try {
                await TaskAPI.linkTask(task.id, config.contentType, String(createdId));
              } catch {
                // Non-fatal: serializer fallback via reverse FK will still work
              }
            }
            // Linked object is now the source of truth — clear stale draft_payload so it
            // doesn't shadow fields like current_approver_name in the display merge.
            try {
              await TaskAPI.updateTask(task.id, { draft_payload: null });
            } catch {
              // Non-fatal
            }
          }
        } catch (createErr: unknown) {
          const data = (createErr as any)?.response?.data;
          const isAlreadyExists = JSON.stringify(data ?? '').toLowerCase().includes('already exists');
          if (isAlreadyExists) {
            throw new Error('Details already exist for this task. Reload the page to load them, then try editing again.');
          }
          throw createErr;
        }
      }
      toast.success('Details updated.');
      setEditing(false);
      onUpdated?.();
    } catch (e: unknown) {
      const detail = (e as any)?.response?.data
        ? JSON.stringify((e as any).response.data)
        : (e as any)?.message ?? 'Unknown error';
      toast.error(`Failed to save: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          {prettyLabel(task.type)} details
        </h2>
        {!loading && !readOnly && config && schema && task.status === 'DRAFT' && (
          editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1 rounded-md bg-[#3CCED7] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2fb8c0] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )
        )}
      </div>

      {loading ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`task-type-skeleton-${index}`} className="min-w-0 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </dl>
      ) : editing && schema ? (
        <>
          <TaskTypeFieldsSection
            schema={{ ...schema, fields: schema.editFields ?? schema.fields }}
            values={formState}
            onChange={(key, value) => setFormState((prev) => ({ ...prev, [key]: value }))}
            context={{ projectId: (task.project as any)?.id ?? task.project_id ?? null }}
          />
          {missingRequiredFields.length > 0 && (
            <p className="mt-3 text-[11px] text-amber-600">
              Required to submit: {missingRequiredFields.map((f) => f.label).join(', ')}
            </p>
          )}
        </>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No details added yet. Click Edit to fill them in.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {entries.map(([k, v, kind]) => (
            <div key={k} className="min-w-0 self-start">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {labelFor(k)}
              </dt>
              <dd className="mt-0.5 text-sm text-gray-900">
                {kind === 'array' ? (
                  <div className="flex flex-wrap gap-1">
                    {v.split('\x00').map((item) => (
                      <span key={item} className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : kind === 'status' ? (
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${EXECUTION_STATUS_STYLES[v] ?? 'bg-gray-50 text-gray-800'}`}>
                    {v}
                  </span>
                ) : v.startsWith('http://') || v.startsWith('https://') ? (
                  <a href={v} target="_blank" rel="noopener noreferrer" className="break-all text-[#2fb8c0] underline hover:text-[#1a9ba3]">
                    {v}
                  </a>
                ) : (
                  <span className="break-words">{v}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!editing && missingRequiredFields.length > 0 && (
        <p className="mt-3 text-[11px] text-amber-600">
          Required to submit: {missingRequiredFields.map((f) => f.label).join(', ')}
        </p>
      )}
    </section>
  );
}
