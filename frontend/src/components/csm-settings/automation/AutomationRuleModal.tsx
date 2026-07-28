'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import {
  BUILDER_CONTROL_CLASS,
  BUILDER_PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/csm-settings/constants';
import {
  AutomationAPI,
  TRIGGER_EVENTS,
  CONDITION_FIELDS,
  operatorsForField,
  VALUELESS_OPERATORS,
  ACTION_TYPES,
  PRIORITY_OPTIONS,
  NOTIFY_RECIPIENTS,
  type AutomationRule,
  type AutomationCondition,
  type AutomationAction,
} from '@/lib/api/automationApi';
import type { TicketStatus } from '@/lib/api/ticketStatusMachineApi';

interface QueueOption {
  id: number;
  name: string;
}

interface Props {
  isOpen: boolean;
  projectId: number;
  editing: AutomationRule | null;
  statuses: TicketStatus[];
  queues: QueueOption[];
  onClose: () => void;
  onSaved: () => void;
}

// Condition fields whose value is a numeric id, so the input is coerced to a number.
const NUMERIC_FIELDS = ['queue', 'assignee', 'work_type', 'support_project'];

const emptyCondition = (): AutomationCondition => ({ field: 'status', operator: 'eq', value: '' });
const emptyAction = (): AutomationAction => ({ type: 'add_tag', value: '' });

const isBlank = (v: unknown) => v == null || String(v).trim() === '';

// Actions that carry a single value (tag / priority / status / queue / agent id)
// need it filled; the message actions need their text.
const VALUE_ACTIONS = ['add_tag', 'set_priority', 'set_status', 'assign_queue', 'assign_agent'];
const TEXT_ACTIONS = ['notify', 'customer_notify', 'add_note'];

const actionIncomplete = (a: AutomationAction) => {
  if (VALUE_ACTIONS.includes(a.type)) return isBlank(a.value);
  if (TEXT_ACTIONS.includes(a.type)) return isBlank(a.text);
  return false;
};

// A condition needs a value unless its operator is "is set" / "is empty".
const conditionIncomplete = (c: AutomationCondition) =>
  !VALUELESS_OPERATORS.includes(c.operator) && isBlank(c.value);

export default function AutomationRuleModal({
  isOpen,
  projectId,
  editing,
  statuses,
  queues,
  onClose,
  onSaved,
}: Props) {
  const isEdit = editing !== null;
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<string>(TRIGGER_EVENTS[0].value);
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([emptyAction()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? '');
    setTrigger(editing?.trigger_event ?? TRIGGER_EVENTS[0].value);
    setConditions(editing?.conditions ?? []);
    setActions(editing?.actions?.length ? editing.actions : [emptyAction()]);
    setError(null);
  }, [isOpen, editing]);

  const patchCondition = (i: number, patch: Partial<AutomationCondition>) =>
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const patchAction = (i: number, patch: Partial<AutomationAction>) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    if (actions.length === 0) {
      setError('Add at least one action.');
      return;
    }
    const badCondition = conditions.find(conditionIncomplete);
    if (badCondition) {
      const label = CONDITION_FIELDS.find((f) => f.value === badCondition.field)?.label ?? badCondition.field;
      setError(`The "${label}" condition needs a value.`);
      return;
    }
    const badAction = actions.find(actionIncomplete);
    if (badAction) {
      const label = ACTION_TYPES.find((t) => t.value === badAction.type)?.label ?? badAction.type;
      setError(`The "${label}" action needs a value.`);
      return;
    }
    // Coerce numeric-id condition values so they compare equal to the ticket's ids.
    const cleanConditions = conditions.map((c) =>
      NUMERIC_FIELDS.includes(c.field) && c.value !== '' && c.value != null
        ? { ...c, value: Number(c.value) }
        : c,
    );
    const cleanActions = actions.map((a) =>
      (a.type === 'assign_agent' || a.type === 'assign_queue') && a.value !== '' && a.value != null
        ? { ...a, value: Number(a.value) }
        : a,
    );

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: trimmed,
        trigger_event: trigger,
        conditions: cleanConditions,
        actions: cleanActions,
      };
      if (isEdit) {
        await AutomationAPI.updateRule(editing!.id, payload);
      } else {
        await AutomationAPI.createRule(projectId, payload);
      }
      onSaved();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const firstOf = (v: unknown) =>
        Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : null;
      const detail =
        firstOf(data?.detail) ||
        firstOf(data?.non_field_errors) ||   // e.g. an illegal status transition
        firstOf(data?.name) ||               // e.g. a duplicate rule name
        (Array.isArray(data?.conditions) && `Conditions: ${data.conditions[0]}`) ||
        (Array.isArray(data?.actions) && `Actions: ${data.actions[0]}`) ||
        null;
      setError(detail || (isEdit ? 'Could not update rule.' : 'Could not create rule.'));
    } finally {
      setSubmitting(false);
    }
  };

  // A value control appropriate to a condition field, or a plain text input.
  const conditionValueInput = (c: AutomationCondition, i: number) => {
    if (VALUELESS_OPERATORS.includes(c.operator)) return null;
    const common = {
      value: c.value == null ? '' : String(c.value),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        patchCondition(i, { value: e.target.value }),
      className: BUILDER_CONTROL_CLASS,
      disabled: submitting,
    };
    if (c.field === 'priority') {
      return (
        <select {...common}>
          <option value="">Select…</option>
          {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (c.field === 'status') {
      return (
        <select {...common}>
          <option value="">Select…</option>
          {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      );
    }
    if (c.field === 'queue') {
      return (
        <select {...common}>
          <option value="">Select…</option>
          {queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
        </select>
      );
    }
    return <input type="text" placeholder="value" {...common} />;
  };

  // The value/text/recipient controls an action needs, keyed off its type.
  const actionValueInputs = (a: AutomationAction, i: number) => {
    const valueSelect = (options: readonly { value: string; label: string }[]) => (
      <select
        value={a.value == null ? '' : String(a.value)}
        onChange={(e) => patchAction(i, { value: e.target.value })}
        className={BUILDER_CONTROL_CLASS}
        disabled={submitting}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
    switch (a.type) {
      case 'set_priority':
        return valueSelect(PRIORITY_OPTIONS);
      case 'set_status':
        return valueSelect(statuses.map((s) => ({ value: s.slug, label: s.name })));
      case 'assign_queue':
        return valueSelect(queues.map((q) => ({ value: String(q.id), label: q.name })));
      case 'add_tag':
        return (
          <input
            type="text" placeholder="tag" value={a.value == null ? '' : String(a.value)}
            onChange={(e) => patchAction(i, { value: e.target.value })}
            className={BUILDER_CONTROL_CLASS} disabled={submitting}
          />
        );
      case 'assign_agent':
        return (
          <input
            type="number" placeholder="user id" value={a.value == null ? '' : String(a.value)}
            onChange={(e) => patchAction(i, { value: e.target.value })}
            className={BUILDER_CONTROL_CLASS} disabled={submitting}
          />
        );
      case 'notify':
        return (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={a.recipient ?? 'assigned_agent'}
                onChange={(e) => patchAction(i, { recipient: e.target.value })}
                className={BUILDER_CONTROL_CLASS} disabled={submitting}
              >
                {NOTIFY_RECIPIENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                type="text" placeholder="message" value={a.text ?? ''}
                onChange={(e) => patchAction(i, { text: e.target.value })}
                className={BUILDER_CONTROL_CLASS} disabled={submitting}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox" checked={!!a.email}
                onChange={(e) => patchAction(i, { email: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]"
                disabled={submitting}
              />
              Also send an email
            </label>
          </div>
        );
      case 'customer_notify':
      case 'add_note':
        return (
          <textarea
            placeholder={a.type === 'add_note' ? 'note text' : 'message to customer'}
            value={a.text ?? ''}
            onChange={(e) => patchAction(i, { text: e.target.value })}
            rows={2} className={BUILDER_CONTROL_CLASS} disabled={submitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit rule' : 'New automation rule'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-5 overflow-y-auto p-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rule-name" className="text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="rule-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Escalate breached high-priority tickets"
                disabled={submitting} className={BUILDER_CONTROL_CLASS} autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rule-trigger" className="text-sm font-medium text-gray-700">When</label>
              <select
                id="rule-trigger" value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                disabled={submitting} className={BUILDER_CONTROL_CLASS}
              >
                {TRIGGER_EVENTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* ── Conditions (all must hold) ────────────────────────── */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">
                And these conditions all hold <span className="font-normal text-gray-400">(optional)</span>
              </span>
              {conditions.map((c, i) => (
                <div key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <select
                    value={c.field}
                    onChange={(e) => {
                      const field = e.target.value;
                      // Drop 'contains' if it isn't valid for the new field.
                      const operator = operatorsForField(field).some((o) => o.value === c.operator)
                        ? c.operator
                        : 'eq';
                      patchCondition(i, { field, operator, value: '' });
                    }}
                    className={BUILDER_CONTROL_CLASS} disabled={submitting}
                  >
                    {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select
                    value={c.operator}
                    onChange={(e) => patchCondition(i, { operator: e.target.value })}
                    className={`${BUILDER_CONTROL_CLASS} sm:w-32`} disabled={submitting}
                  >
                    {operatorsForField(c.field).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="min-w-[8rem] flex-1">{conditionValueInput(c, i)}</div>
                  <button
                    type="button"
                    onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove condition" disabled={submitting}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
                disabled={submitting}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add condition
              </button>
            </div>

            {/* ── Actions ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">
                Then do <span className="text-red-500">*</span>
              </span>
              {actions.map((a, i) => (
                <div key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <select
                    value={a.type}
                    onChange={(e) => patchAction(i, { type: e.target.value, value: '', text: '', recipient: undefined, email: undefined })}
                    className={BUILDER_CONTROL_CLASS} disabled={submitting}
                  >
                    {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="min-w-[10rem] flex-1">{actionValueInputs(a, i)}</div>
                  <button
                    type="button"
                    onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove action" disabled={submitting || actions.length === 1}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setActions((prev) => [...prev, emptyAction()])}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
                disabled={submitting}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add action
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
            <button type="button" onClick={onClose} disabled={submitting} className={SECONDARY_BUTTON_CLASS}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={BUILDER_PRIMARY_BUTTON_CLASS}>
              {submitting ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
