/**
 * Per-task-type field schemas for /tasks-v2/new.
 *
 * Each Task.type that has a dedicated Django sub-model (budget_approval,
 * asset, retrospective, policy, ...) gets an entry here. The schema drives:
 *   - dynamic field rendering in the create form
 *   - commit-readiness checklist on the right aside
 *   - two-step submit (create Task -> create sub-model -> link)
 *
 * Field set is intentionally the user-visible minimum that maps to each
 * backend model: all required columns plus the most common optional ones.
 * Advanced configuration (nested JSON metrics, per-step rollout data, etc.)
 * is deferred to each type's dedicated detail page.
 *
 * Execution (`type === 'execution'`) has no sub-model — tasks of that type
 * only carry base Task fields, so there is no schema here.
 */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'date'
  | 'url'
  | 'number'
  | 'tags';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  /** Payload key on the sub-model create endpoint. */
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholder?: string;
  /** Rows for textarea kind. */
  rows?: number;
  /** Static options for select kind. */
  options?: FieldOption[];
  /** Key into option-loader registry for dynamic options. */
  optionsLoader?: string;
  helpText?: string;
}

export interface TypeSchema {
  /** Matches Task.type value exactly. */
  type: string;
  /** Human-readable label, mirrors TYPE_META. */
  label: string;
  /** Django ContentType.model value used by /api/tasks/{id}/link/. */
  contentType: string;
  fields: FieldDef[];
}

// ---------------------------------------------------------------------------
// Individual schemas
// ---------------------------------------------------------------------------

const BUDGET: TypeSchema = {
  type: 'budget',
  label: 'Budget',
  contentType: 'budgetrequest',
  fields: [
    {
      key: 'amount',
      label: 'Amount',
      kind: 'number',
      required: true,
      placeholder: 'Requested amount',
    },
    {
      key: 'currency',
      label: 'Currency',
      kind: 'text',
      required: true,
      placeholder: 'AUD / USD / EUR',
    },
    {
      key: 'budget_pool',
      label: 'Budget pool id',
      kind: 'number',
      required: true,
      helpText: 'Pool to draw from. Future iteration will resolve to a picker.',
    },
    {
      key: 'ad_channel',
      label: 'Ad channel id',
      kind: 'number',
      required: true,
      helpText: 'Ad channel id. Future iteration will resolve to a picker.',
    },
    {
      key: 'notes',
      label: 'Notes',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Context for this budget request',
    },
  ],
};

const ASSET: TypeSchema = {
  type: 'asset',
  label: 'Asset',
  contentType: 'asset',
  fields: [
    {
      key: 'tags',
      label: 'Tags',
      kind: 'tags',
      required: true,
      placeholder: 'Comma-separated tags',
    },
    {
      key: 'team',
      label: 'Team id',
      kind: 'number',
      required: false,
      helpText: 'Optional team ownership. Leave blank for personal.',
    },
  ],
};

const RETROSPECTIVE: TypeSchema = {
  type: 'retrospective',
  label: 'Retrospective',
  contentType: 'retrospectivetask',
  fields: [
    {
      key: 'campaign',
      label: 'Campaign id',
      kind: 'text',
      required: true,
      placeholder: 'Campaign identifier',
    },
    {
      key: 'scheduled_at',
      label: 'Scheduled at',
      kind: 'date',
      required: false,
      helpText: 'Defaults to today if left blank.',
    },
    {
      key: 'decision',
      label: 'Decision summary',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Summarise the decision under review',
    },
    {
      key: 'primary_assumption',
      label: 'Primary assumption',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Key assumption the decision relied on',
    },
    {
      key: 'key_risk_ignore',
      label: 'Key risk ignored',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Risk knowingly not mitigated',
    },
  ],
};

const REPORT: TypeSchema = {
  type: 'report',
  label: 'Report',
  contentType: 'reporttask',
  fields: [
    {
      key: 'audience_type',
      label: 'Audience type',
      kind: 'text',
      required: true,
      placeholder: 'e.g. executive, client, internal',
    },
    {
      key: 'audience_details',
      label: 'Audience details',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Names, roles, or distribution list',
    },
    {
      key: 'outcome_summary',
      label: 'Outcome summary',
      kind: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Top-line outcome for the reporting period',
    },
    {
      key: 'narrative_explanation',
      label: 'Narrative explanation',
      kind: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Why the outcome happened',
    },
  ],
};

const SCALING: TypeSchema = {
  type: 'scaling',
  label: 'Scaling',
  contentType: 'scalingplan',
  fields: [
    {
      key: 'strategy',
      label: 'Strategy',
      kind: 'select',
      required: false,
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
      helpText: 'Defaults to horizontal.',
    },
    {
      key: 'scaling_target',
      label: 'Scaling target',
      kind: 'textarea',
      required: true,
      rows: 2,
      placeholder: 'What you want to scale (campaign, ad set, budget)',
    },
    {
      key: 'risk_considerations',
      label: 'Risk considerations',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Main risks to watch',
    },
    {
      key: 'max_scaling_limit',
      label: 'Max scaling limit',
      kind: 'text',
      required: false,
      placeholder: 'e.g. 2x current daily spend',
    },
    {
      key: 'stop_conditions',
      label: 'Stop conditions',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Thresholds that would pause scaling',
    },
    {
      key: 'expected_outcomes',
      label: 'Expected outcomes',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Metrics you expect to see move',
    },
  ],
};

const ALERT: TypeSchema = {
  type: 'alert',
  label: 'Alert',
  contentType: 'alerttask',
  fields: [
    {
      key: 'alert_type',
      label: 'Alert type',
      kind: 'select',
      required: true,
      options: [
        { value: 'spend_spike', label: 'Spend spike' },
        { value: 'cpa_drift', label: 'CPA drift' },
        { value: 'ctr_drop', label: 'CTR drop' },
        { value: 'delivery_issue', label: 'Delivery issue' },
        { value: 'compliance', label: 'Compliance' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      key: 'severity',
      label: 'Severity',
      kind: 'select',
      required: true,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    {
      key: 'investigation_notes',
      label: 'Investigation notes',
      kind: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'What you know so far',
    },
    {
      key: 'resolution_steps',
      label: 'Resolution steps',
      kind: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Planned mitigation steps',
    },
  ],
};

const EXPERIMENT: TypeSchema = {
  type: 'experiment',
  label: 'Experiment',
  contentType: 'experiment',
  fields: [
    {
      key: 'hypothesis',
      label: 'Hypothesis',
      kind: 'textarea',
      required: true,
      rows: 3,
      placeholder: 'If we change X, then Y will happen because …',
    },
    {
      key: 'expected_outcome',
      label: 'Expected outcome',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'What success looks like',
    },
    {
      key: 'success_metric',
      label: 'Success metric',
      kind: 'text',
      required: false,
      placeholder: 'e.g. CPA, ROAS, conversion rate',
    },
    {
      key: 'description',
      label: 'Description',
      kind: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Further context for the experiment',
    },
    {
      key: 'constraints',
      label: 'Constraints',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Budget, time, or data constraints',
    },
  ],
};

const OPTIMIZATION: TypeSchema = {
  type: 'optimization',
  label: 'Optimization',
  contentType: 'optimization',
  fields: [
    {
      key: 'action_type',
      label: 'Action type',
      kind: 'select',
      required: true,
      options: [
        { value: 'pause', label: 'Pause' },
        { value: 'scale', label: 'Scale' },
        { value: 'duplicate', label: 'Duplicate' },
        { value: 'edit', label: 'Edit' },
      ],
    },
    {
      key: 'rationale',
      label: 'Rationale',
      kind: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Why this optimization is needed',
    },
  ],
};

const COMMUNICATION: TypeSchema = {
  type: 'communication',
  label: 'Client Communication',
  contentType: 'clientcommunication',
  fields: [
    {
      key: 'communication_type',
      label: 'Communication type',
      kind: 'select',
      required: true,
      options: [
        { value: 'status_update', label: 'Status update' },
        { value: 'policy_change', label: 'Policy change' },
        { value: 'performance_review', label: 'Performance review' },
        { value: 'budget_change', label: 'Budget change' },
        { value: 'incident', label: 'Incident' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      key: 'stakeholders',
      label: 'Stakeholders',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Names or roles to notify',
    },
    {
      key: 'required_actions',
      label: 'Required actions',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'What you need the client to do',
    },
    {
      key: 'client_deadline',
      label: 'Client deadline',
      kind: 'date',
      required: false,
    },
    {
      key: 'notes',
      label: 'Notes',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Additional context',
    },
  ],
};

const PLATFORM_POLICY_UPDATE: TypeSchema = {
  type: 'platform_policy_update',
  label: 'Platform Policy Update',
  contentType: 'platformpolicyupdate',
  fields: [
    {
      key: 'platform',
      label: 'Platform',
      kind: 'select',
      required: true,
      optionsLoader: 'policy.platforms',
      placeholder: 'Select a platform',
    },
    {
      key: 'policy_change_type',
      label: 'Policy change type',
      kind: 'select',
      required: true,
      optionsLoader: 'policy.change_types',
      placeholder: 'Select a policy change type',
    },
    {
      key: 'policy_description',
      label: 'Policy description',
      kind: 'textarea',
      required: true,
      rows: 3,
      placeholder: 'Describe the policy change and its implications',
    },
    {
      key: 'immediate_actions_required',
      label: 'Immediate actions required',
      kind: 'textarea',
      required: true,
      rows: 3,
      placeholder: 'Describe immediate actions that need to be taken',
    },
    {
      key: 'policy_reference_url',
      label: 'Policy reference URL',
      kind: 'url',
      required: false,
      placeholder: 'https://example.com/policy-update',
    },
    {
      key: 'effective_date',
      label: 'Effective date',
      kind: 'date',
      required: false,
    },
    {
      key: 'action_deadline',
      label: 'Action deadline',
      kind: 'date',
      required: false,
    },
    {
      key: 'affected_campaigns',
      label: 'Affected campaigns',
      kind: 'tags',
      required: false,
      placeholder: 'Comma-separated campaign names',
    },
    {
      key: 'affected_ad_sets',
      label: 'Affected ad sets',
      kind: 'tags',
      required: false,
      placeholder: 'Comma-separated ad set names',
    },
    {
      key: 'affected_assets',
      label: 'Affected assets',
      kind: 'tags',
      required: false,
      placeholder: 'Comma-separated asset names',
    },
    {
      key: 'performance_impact',
      label: 'Performance impact',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Describe potential impact on performance metrics',
    },
    {
      key: 'budget_impact',
      label: 'Budget impact',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Describe potential impact on budget or spend',
    },
    {
      key: 'compliance_risk',
      label: 'Compliance risk',
      kind: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Describe risk if the policy change is not addressed',
    },
  ],
};

export const TYPE_SCHEMAS: Record<string, TypeSchema> = {
  [BUDGET.type]: BUDGET,
  [ASSET.type]: ASSET,
  [RETROSPECTIVE.type]: RETROSPECTIVE,
  [REPORT.type]: REPORT,
  [SCALING.type]: SCALING,
  [ALERT.type]: ALERT,
  [EXPERIMENT.type]: EXPERIMENT,
  [OPTIMIZATION.type]: OPTIMIZATION,
  [COMMUNICATION.type]: COMMUNICATION,
  [PLATFORM_POLICY_UPDATE.type]: PLATFORM_POLICY_UPDATE,
};

export function getTypeSchema(type: string | null | undefined): TypeSchema | null {
  if (!type) return null;
  return TYPE_SCHEMAS[type] ?? null;
}

/** Return just the required-field keys that are currently unfilled. */
export function getUnfilledRequiredKeys(
  schema: TypeSchema,
  formState: Record<string, string>,
): string[] {
  return schema.fields
    .filter((f) => f.required)
    .filter((f) => !(formState[f.key] ?? '').toString().trim())
    .map((f) => f.key);
}
