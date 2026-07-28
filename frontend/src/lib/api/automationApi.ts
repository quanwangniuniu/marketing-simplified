import api from '../api';

// Workflow automation rules: "when <trigger> fires and <conditions> hold, run
// <actions>". Rules and their execution logs are project-scoped via ?project={id}.

export interface AutomationCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export interface AutomationAction {
  type: string;
  value?: unknown;
  text?: string;
  template_id?: number;
  recipient?: string;
  email?: boolean;
}

export interface AutomationRule {
  id: number;
  name: string;
  trigger_event: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  order: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// The trigger / condition / action vocabulary the backend accepts. Kept in sync
// with the engine's allowlists so the rule builder only offers valid choices.
export const TRIGGER_EVENTS = [
  { value: 'ticket_created', label: 'Ticket created' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'priority_changed', label: 'Priority changed' },
  { value: 'sla_breached', label: 'SLA breached' },
  { value: 'customer_replied', label: 'Customer replied' },
  { value: 'tag_added', label: 'Tag added' },
] as const;

export const CONDITION_FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'queue', label: 'Queue' },
  { value: 'assignee', label: 'Assignee (user id)' },
  { value: 'work_type', label: 'Work type (id)' },
  { value: 'support_project', label: 'Support project (id)' },
  { value: 'tags', label: 'Tags' },
  { value: 'customer_email', label: 'Customer email' },
  { value: 'channel', label: 'Channel' },
] as const;

export const CONDITION_OPERATORS = [
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
  { value: 'in', label: 'is any of' },
  { value: 'contains', label: 'contains' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_empty', label: 'is empty' },
] as const;

// Operators that need no value input.
export const VALUELESS_OPERATORS = ['is_set', 'is_empty'];

// 'contains' only makes sense for list/text fields; kept in sync with the
// backend so the operator dropdown never offers a nonsensical combo.
export const CONTAINS_FIELDS = ['tags', 'customer_email'];

export const operatorsForField = (field: string) =>
  CONDITION_OPERATORS.filter((o) => o.value !== 'contains' || CONTAINS_FIELDS.includes(field));

export const ACTION_TYPES = [
  { value: 'set_priority', label: 'Set priority' },
  { value: 'set_status', label: 'Set status' },
  { value: 'add_tag', label: 'Add tag' },
  { value: 'assign_agent', label: 'Assign to agent (user id)' },
  { value: 'assign_queue', label: 'Move to queue' },
  { value: 'notify', label: 'Notify agent / supervisor' },
  { value: 'customer_notify', label: 'Message the customer' },
  { value: 'add_note', label: 'Add internal note' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export const NOTIFY_RECIPIENTS = [
  { value: 'assigned_agent', label: 'Assigned agent' },
  { value: 'supervisor', label: 'Queue supervisor' },
  { value: 'both', label: 'Both' },
] as const;

const BASE = '/api/csm';

export type AutomationRuleInput = Pick<
  AutomationRule,
  'name' | 'trigger_event' | 'conditions' | 'actions'
> &
  Partial<Pick<AutomationRule, 'is_active' | 'order'>>;

export const AutomationAPI = {
  listRules: (projectId: number) =>
    api
      .get<AutomationRule[] | { results: AutomationRule[] }>(`${BASE}/automation-rules/`, {
        params: { project: projectId },
      })
      .then((res) => (Array.isArray(res.data) ? res.data : res.data.results)),

  createRule: (projectId: number, data: AutomationRuleInput) =>
    api
      .post<AutomationRule>(`${BASE}/automation-rules/`, data, { params: { project: projectId } })
      .then((res) => res.data),

  updateRule: (id: number, data: Partial<AutomationRuleInput>) =>
    api.patch<AutomationRule>(`${BASE}/automation-rules/${id}/`, data).then((res) => res.data),

  deleteRule: (id: number) => api.delete(`${BASE}/automation-rules/${id}/`),
};
