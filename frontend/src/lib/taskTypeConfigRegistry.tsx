/**
 * Single source of truth for task-type-specific config: contentType, api, form component,
 * requiredFields, and getPayload. Pages (tasks, timeline) wire in their local state
 * (formData, setFormData, validation) when building their taskTypeConfig.
 */

import type { ComponentType } from "react";
import { BudgetAPI } from "@/lib/api/budgetApi";
import { AssetAPI } from "@/lib/api/assetApi";
import { RetrospectiveAPI } from "@/lib/api/retrospectiveApi";
import { OptimizationScalingAPI } from "@/lib/api/optimizationScalingApi";
import { AlertingAPI } from "@/lib/api/alertingApi";
import { ClientCommunicationAPI } from "@/lib/api/clientCommunicationApi";
import { ExperimentAPI } from "@/lib/api/experimentApi";
import { OptimizationAPI } from "@/lib/api/optimizationApi";
import { ReportAPI } from "@/lib/api/reportApi";
import { PolicyAPI } from "@/lib/api/policyApi";
import NewBudgetRequestForm from "@/components/tasks/NewBudgetRequestForm";
import NewAssetForm from "@/components/tasks/NewAssetForm";
import NewRetrospectiveForm from "@/components/tasks/NewRetrospectiveForm";
import { ScalingPlanForm } from "@/components/tasks/ScalingPlanForm";
import AlertTaskForm from "@/components/tasks/AlertTaskForm";
import NewClientCommunicationForm from "@/components/tasks/NewClientCommunicationForm";
import { ExperimentForm } from "@/components/tasks/ExperimentForm";
import { OptimizationForm } from "@/components/tasks/OptimizationForm";
import { ReportForm } from "@/components/tasks/ReportForm";
import NewPlatformPolicyUpdateForm from "@/components/tasks/NewPlatformPolicyUpdateForm";

const defaultReportContext = {
  reporting_period: null,
  situation: "",
  what_changed: "",
};

const parseArr = (v: string) =>
  (v || "").split(",").map((s: string) => s.trim()).filter(Boolean);

const toEditStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return "";
  return String(v);
};

export type TaskTypeConfigStatic = {
  contentType: string;
  successMessage: string;
  api: (payload: any) => Promise<unknown>;
  formComponent: ComponentType<any>;
  requiredFields: string[];
  getPayload: (
    formData: any,
    taskData: { project_id?: number; summary?: string; current_approver_id?: number | null },
    createdTask: { id: number }
  ) => Record<string, unknown> | null;
  updateApi: (id: number | string, payload: any) => Promise<unknown>;
  getUpdatePayload: (formData: any) => Record<string, unknown>;
  initEditState: (linked: Record<string, unknown>) => Record<string, string>;
};

export const TASK_TYPE_CONFIG_STATIC: Record<string, TaskTypeConfigStatic> = {
  budget: {
    contentType: "budgetrequest",
    successMessage: "Budget Request created successfully",
    api: BudgetAPI.createBudgetRequest,
    formComponent: NewBudgetRequestForm,
    requiredFields: [],
    getPayload: (formData, taskData, createdTask) => {
      // Approver can come from the budget form (formData.current_approver) or the task itself
      const approverId =
        formData.current_approver ||
        taskData.current_approver_id ||
        (taskData as any).current_approver?.id ||
        null;
      if (!approverId) return null;
      const composite: string = formData.budget_pool_composite || "";
      const parts = composite.split(":");
      if (parts.length < 3) return null;
      const [poolId, adChannelId, currency] = parts;
      return {
        task: createdTask.id,
        amount: formData.amount,
        currency,
        ad_channel: Number(adChannelId),
        budget_pool_id: Number(poolId),
        notes: formData.notes || "",
        current_approver: approverId,
      };
    },
    updateApi: (id, data) => BudgetAPI.patchBudgetRequest(id, data),
    getUpdatePayload: (formData) => {
      const payload: Record<string, unknown> = {
        notes: formData.notes || "",
        current_approver: formData.current_approver ? Number(formData.current_approver) : null,
      };
      const amt = Number(formData.amount);
      if (formData.amount && !Number.isNaN(amt)) {
        payload.amount = formData.amount;
      }
      return payload;
    },
    initEditState: (linked) => {
      const pool = linked.budget_pool as any;
      // If budget_pool_composite is explicitly present in the source (e.g. from draft_payload,
      // even as '') it takes priority — the user may have cleared it. Only reconstruct from the
      // pool object when the composite key is absent entirely (pure linked-object restore).
      const hasComposite = 'budget_pool_composite' in (linked as any);
      return {
        budget_pool_composite: hasComposite
          ? toEditStr(linked.budget_pool_composite)
          : (pool?.id ? `${pool.id}:${pool.ad_channel_id ?? ""}:${pool.currency ?? toEditStr(linked.currency)}` : ''),
        amount: toEditStr(linked.amount),
        notes: toEditStr(linked.notes),
        current_approver: (() => {
          const a = (linked as any).current_approver;
          // API returns current_approver as a plain integer (PrimaryKeyRelatedField)
          // but guard against object shape too
          return toEditStr(typeof a === 'object' && a !== null ? a.id : a);
        })(),
      };
    },
  },
  asset: {
    contentType: "asset",
    successMessage: "Asset task created successfully",
    api: AssetAPI.createAsset,
    formComponent: NewAssetForm,
    requiredFields: ["tags"],
    getPayload: (formData, _taskData, createdTask) => {
      const tagsArray = (formData.tags || "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        task: createdTask.id,
        tags: tagsArray,
      };
      if (formData.team) {
        const teamNum = Number(formData.team);
        if (!Number.isNaN(teamNum)) payload.team = teamNum;
      }
      return payload;
    },
    updateApi: (id, data) => AssetAPI.updateAsset(Number(id), data),
    getUpdatePayload: (formData) => {
      const payload: Record<string, unknown> = { tags: parseArr(formData.tags) };
      if (formData.team) {
        const n = Number(formData.team);
        if (!Number.isNaN(n)) payload.team = n;
      }
      return payload;
    },
    initEditState: (linked) => ({
      tags: Array.isArray(linked.tags) ? (linked.tags as string[]).join(", ") : toEditStr(linked.tags),
      team: toEditStr(linked.team),
    }),
  },
  retrospective: {
    contentType: "retrospectivetask",
    successMessage: "Retrospective created successfully",
    api: RetrospectiveAPI.createRetrospective,
    formComponent: NewRetrospectiveForm,
    requiredFields: [],
    getPayload: (formData, taskData, createdTask) => ({
      campaign: taskData.project_id,
      scheduled_at: formData.scheduled_at || new Date().toISOString(),
      status: formData.status || "scheduled",
      decision: formData.decision || "",
      confidence_level: formData.confidence_level || undefined,
      primary_assumption: formData.primary_assumption || "",
      key_risk_ignore: formData.key_risk_ignore?.trim() || undefined,
    }),
    updateApi: RetrospectiveAPI.updateRetrospective,
    getUpdatePayload: (formData) => ({
      scheduled_at: formData.scheduled_at || undefined,
      status: formData.status || "scheduled",
      decision: formData.decision || "",
      confidence_level: formData.confidence_level ? Number(formData.confidence_level) : undefined,
      primary_assumption: formData.primary_assumption || "",
      key_risk_ignore: formData.key_risk_ignore?.trim() || undefined,
      outcome_compared_to_expectation: formData.outcome_compared_to_expectation || null,
      biggest_wrong_assumption: formData.biggest_wrong_assumption || "",
      would_make_same_decision_again: formData.would_make_same_decision_again || null,
      report_url: formData.report_url || "",
    }),
    initEditState: (linked) => ({
      scheduled_at: toEditStr(linked.scheduled_at).substring(0, 10),
      status: toEditStr(linked.status),
      decision: toEditStr(linked.decision),
      confidence_level: linked.confidence_level != null ? String(linked.confidence_level) : "",
      primary_assumption: toEditStr(linked.primary_assumption),
      key_risk_ignore: toEditStr(linked.key_risk_ignore),
      outcome_compared_to_expectation: toEditStr(linked.outcome_compared_to_expectation),
      biggest_wrong_assumption: toEditStr(linked.biggest_wrong_assumption),
      would_make_same_decision_again: toEditStr(linked.would_make_same_decision_again),
      report_url: toEditStr(linked.report_url),
    }),
  },
  scaling: {
    contentType: "scalingplan",
    successMessage: "Scaling Plan created successfully",
    api: OptimizationScalingAPI.createScalingPlan,
    formComponent: ScalingPlanForm,
    requiredFields: ["scaling_target"],
    getPayload: (formData, _taskData, createdTask) => {
      if (!createdTask?.id) {
        throw new Error("Task ID is required to create scaling plan");
      }
      const scalingEntities = (formData.affected_entities || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      return {
        task: createdTask.id,
        strategy: formData.strategy || "horizontal",
        scaling_target: formData.scaling_target || "",
        risk_considerations: formData.risk_considerations || "",
        max_scaling_limit: formData.max_scaling_limit || "",
        stop_conditions: formData.stop_conditions || "",
        expected_outcomes: formData.expected_outcomes || "",
        status: formData.status || "planned",
        affected_entities: scalingEntities.length ? scalingEntities : null,
      };
    },
    updateApi: OptimizationScalingAPI.updateScalingPlan,
    getUpdatePayload: (formData) => ({
      strategy: formData.strategy || "horizontal",
      scaling_target: formData.scaling_target || "",
      risk_considerations: formData.risk_considerations || "",
      max_scaling_limit: formData.max_scaling_limit || "",
      stop_conditions: formData.stop_conditions || "",
      expected_outcomes: formData.expected_outcomes || "",
      status: formData.status || "planned",
      affected_entities: parseArr(formData.affected_entities).length
        ? parseArr(formData.affected_entities)
        : null,
      review_summary: formData.review_summary || "",
      review_lessons_learned: formData.review_lessons_learned || "",
      review_future_actions: formData.review_future_actions || "",
    }),
    initEditState: (linked) => ({
      strategy: toEditStr(linked.strategy),
      scaling_target: toEditStr(linked.scaling_target),
      risk_considerations: toEditStr(linked.risk_considerations),
      max_scaling_limit: toEditStr(linked.max_scaling_limit),
      stop_conditions: toEditStr(linked.stop_conditions),
      expected_outcomes: toEditStr(linked.expected_outcomes),
      status: toEditStr(linked.status),
      affected_entities: Array.isArray(linked.affected_entities)
        ? (linked.affected_entities as string[]).join(", ")
        : toEditStr(linked.affected_entities),
      review_summary: toEditStr(linked.review_summary),
      review_lessons_learned: toEditStr(linked.review_lessons_learned),
      review_future_actions: toEditStr(linked.review_future_actions),
    }),
  },
  alert: {
    contentType: "alerttask",
    successMessage: "Alert task created successfully",
    api: AlertingAPI.createAlertTask,
    formComponent: AlertTaskForm,
    requiredFields: ["alert_type", "severity"],
    getPayload: (formData, _taskData, createdTask) => {
      if (!createdTask?.id) {
        throw new Error("Task ID is required to create alert details");
      }
      const rawMetricValue = formData.change_value ? Number(formData.change_value) : null;
      const rawCurrentValue = formData.current_value ? Number(formData.current_value) : null;
      const rawPreviousValue = formData.previous_value ? Number(formData.previous_value) : null;
      const metricValue = Number.isNaN(rawMetricValue as number) ? null : rawMetricValue;
      const currentValue = Number.isNaN(rawCurrentValue as number) ? null : rawCurrentValue;
      const previousValue = Number.isNaN(rawPreviousValue as number) ? null : rawPreviousValue;
      const investigationNotes =
        formData.investigation_notes ||
        [formData.investigation_assumption ? `Assumption: ${formData.investigation_assumption}` : null]
          .filter(Boolean)
          .join(" | ");
      const resolutionSteps =
        formData.resolution_steps ||
        [...(formData.resolution_actions || []), formData.resolution_notes || null]
          .filter(Boolean)
          .join(" | ");
      return {
        task: createdTask.id,
        alert_type: formData.alert_type || "spend_spike",
        severity: formData.severity || "medium",
        status: formData.status || "open",
        affected_entities: (formData.affected_entities || "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        initial_metrics: {
          metric_key: formData.metric_key || "spend",
          change_type: formData.change_type || "percent",
          change_value: metricValue,
          change_window: formData.change_window || "daily",
          current_value: currentValue,
          previous_value: previousValue,
        },
        assigned_to: formData.assigned_to ? Number(formData.assigned_to) : null,
        acknowledged_by: formData.acknowledged_by ? Number(formData.acknowledged_by) : null,
        investigation_notes: investigationNotes,
        resolution_steps: resolutionSteps,
        related_references: formData.related_references || [],
        postmortem_root_cause: formData.postmortem_root_cause || "",
        postmortem_prevention: formData.postmortem_prevention || "",
      };
    },
    updateApi: AlertingAPI.updateAlertTask,
    getUpdatePayload: (formData) => {
      const toNum = (v: string) => { const n = Number(v); return Number.isNaN(n) ? null : n; };
      return {
        alert_type: formData.alert_type,
        severity: formData.severity,
        status: formData.status,
        investigation_notes: formData.investigation_notes || "",
        resolution_steps: formData.resolution_steps || "",
        affected_entities: parseArr(formData.affected_entities),
        postmortem_root_cause: formData.postmortem_root_cause || "",
        postmortem_prevention: formData.postmortem_prevention || "",
        initial_metrics: {
          metric_key: formData.metric_key || "spend",
          change_type: formData.change_type || "percent",
          change_value: formData.change_value ? toNum(formData.change_value) : null,
          change_window: formData.change_window || "daily",
          current_value: formData.current_value ? toNum(formData.current_value) : null,
          previous_value: formData.previous_value ? toNum(formData.previous_value) : null,
        },
      };
    },
    initEditState: (linked) => {
      const m = (linked.initial_metrics as Record<string, unknown>) ?? {};
      return {
        alert_type: toEditStr(linked.alert_type),
        severity: toEditStr(linked.severity),
        status: toEditStr(linked.status),
        investigation_notes: toEditStr(linked.investigation_notes),
        resolution_steps: toEditStr(linked.resolution_steps),
        affected_entities: Array.isArray(linked.affected_entities)
          ? (linked.affected_entities as string[]).join(", ")
          : toEditStr(linked.affected_entities),
        postmortem_root_cause: toEditStr(linked.postmortem_root_cause),
        postmortem_prevention: toEditStr(linked.postmortem_prevention),
        metric_key: toEditStr(m.metric_key),
        change_type: toEditStr(m.change_type),
        change_value: toEditStr(m.change_value),
        change_window: toEditStr(m.change_window),
        current_value: toEditStr(m.current_value),
        previous_value: toEditStr(m.previous_value),
      };
    },
  },
  communication: {
    contentType: "clientcommunication",
    successMessage: "Client Communication task created successfully",
    api: ClientCommunicationAPI.create,
    formComponent: NewClientCommunicationForm,
    requiredFields: ["communication_type"],
    getPayload: (formData, _taskData, createdTask) => {
      if (!createdTask?.id) return null;
      if (!formData.communication_type) return null;
      const impactedAreas = (formData.impacted_areas || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      return {
        task: createdTask.id,
        communication_type: formData.communication_type,
        stakeholders: formData.stakeholders || "",
        impacted_areas: impactedAreas,
        required_actions: formData.required_actions,
        client_deadline:
          formData.client_deadline && formData.client_deadline.trim() !== ""
            ? formData.client_deadline
            : null,
        notes: formData.notes || "",
      };
    },
    updateApi: ClientCommunicationAPI.update,
    getUpdatePayload: (formData) => ({
      communication_type: formData.communication_type,
      stakeholders: formData.stakeholders || "",
      impacted_areas: parseArr(formData.impacted_areas),
      required_actions: formData.required_actions || "",
      client_deadline: formData.client_deadline?.trim() || null,
      notes: formData.notes || "",
    }),
    initEditState: (linked) => ({
      communication_type: toEditStr(linked.communication_type),
      stakeholders: toEditStr(linked.stakeholders),
      impacted_areas: Array.isArray(linked.impacted_areas)
        ? (linked.impacted_areas as string[]).join(", ")
        : toEditStr(linked.impacted_areas),
      required_actions: toEditStr(linked.required_actions),
      client_deadline: toEditStr(linked.client_deadline).substring(0, 10),
      notes: toEditStr(linked.notes),
    }),
  },
  experiment: {
    contentType: "experiment",
    successMessage: "Experiment task created successfully",
    api: ExperimentAPI.createExperiment,
    formComponent: ExperimentForm,
    requiredFields: ["hypothesis"],
    getPayload: (formData, taskData, createdTask) => ({
      task: createdTask.id,
      name: taskData.summary || "Experiment task",
      hypothesis: formData.hypothesis || "",
      expected_outcome: formData.expected_outcome,
      description: formData.description,
      success_metric: formData.success_metric,
      constraints: formData.constraints,
      status: formData.status || "draft",
    }),
    updateApi: ExperimentAPI.updateExperiment,
    getUpdatePayload: (formData) => ({
      hypothesis: formData.hypothesis || "",
      expected_outcome: formData.expected_outcome || "",
      description: formData.description || "",
      success_metric: formData.success_metric || "",
      constraints: formData.constraints || "",
      status: formData.status || "draft",
      // Outcome fields only sent when status is 'completed'
      ...(formData.status === "completed"
        ? { experiment_outcome: formData.experiment_outcome || null, outcome_notes: formData.outcome_notes || "" }
        : { experiment_outcome: null, outcome_notes: "" }),
    }),
    initEditState: (linked) => ({
      hypothesis: toEditStr(linked.hypothesis),
      expected_outcome: toEditStr(linked.expected_outcome),
      description: toEditStr(linked.description),
      success_metric: toEditStr(linked.success_metric),
      constraints: toEditStr(linked.constraints),
      status: toEditStr(linked.status),
      experiment_outcome: toEditStr(linked.experiment_outcome),
      outcome_notes: toEditStr(linked.outcome_notes),
    }),
  },
  optimization: {
    contentType: "optimization",
    successMessage: "Optimization task created successfully",
    api: OptimizationAPI.createOptimization,
    formComponent: OptimizationForm,
    requiredFields: [],
    getPayload: (formData, _taskData, createdTask) => ({
      task: createdTask.id,
      ...formData,
    }),
    updateApi: OptimizationAPI.updateOptimization,
    getUpdatePayload: (formData) => ({
      action_type: formData.action_type,
      rationale: formData.rationale || "",
      execution_status: formData.execution_status || "detected",
      planned_action: formData.planned_action || "",
      outcome_notes: formData.outcome_notes || "",
    }),
    initEditState: (linked) => ({
      action_type: toEditStr(linked.action_type),
      rationale: toEditStr(linked.rationale),
      execution_status: toEditStr(linked.execution_status),
      planned_action: toEditStr(linked.planned_action),
      outcome_notes: toEditStr(linked.outcome_notes),
    }),
  },
  report: {
    contentType: "reporttask",
    successMessage: "Report task created successfully",
    api: ReportAPI.createReport,
    formComponent: ReportForm,
    requiredFields: [],
    getPayload: (formData, _taskData, createdTask) => {
    if (
      formData.audience_type === 'other' &&
      !(formData.audience_details ?? '').trim()
    ) {
      throw new Error('Audience details are required when audience type is "Other".');
    }
    return {
      task: createdTask.id,
      audience_type: formData.audience_type,
      audience_details: formData.audience_details || '',
      context: formData.context || defaultReportContext,
      outcome_summary: formData.outcome_summary || '',
      narrative_explanation: formData.narrative_explanation || '',
      key_actions: formData.key_actions || [],
    };
    },
    updateApi: ReportAPI.updateReport,
    getUpdatePayload: (formData) => ({
      audience_type: formData.audience_type,
      audience_details: formData.audience_details || "",
      outcome_summary: formData.outcome_summary || "",
      narrative_explanation: formData.narrative_explanation || "",
    }),
    initEditState: (linked) => ({
      audience_type: toEditStr(linked.audience_type),
      audience_details: toEditStr(linked.audience_details),
      outcome_summary: toEditStr(linked.outcome_summary),
      narrative_explanation: toEditStr(linked.narrative_explanation),
    }),
  },
  platform_policy_update: {
    contentType: "platformpolicyupdate",
    successMessage: "Platform Policy Update created successfully",
    api: PolicyAPI.create,
    formComponent: NewPlatformPolicyUpdateForm,
    requiredFields: ["platform", "policy_change_type", "policy_description"],
    getPayload: (formData, _taskData, createdTask) => {
      if (!createdTask?.id) return null;
      if (!formData.platform) return null;
      const parseCommaSeparated = (val: string) =>
        (val || "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      return {
        task: createdTask.id,
        platform: formData.platform,
        policy_change_type: formData.policy_change_type,
        policy_description: formData.policy_description,
        policy_reference_url: formData.policy_reference_url || undefined,
        effective_date: formData.effective_date || undefined,
        affected_campaigns: parseCommaSeparated(formData.affected_campaigns || ""),
        affected_ad_sets: parseCommaSeparated(formData.affected_ad_sets || ""),
        affected_assets: parseCommaSeparated(formData.affected_assets || ""),
        performance_impact: formData.performance_impact || "",
        budget_impact: formData.budget_impact || "",
        compliance_risk: formData.compliance_risk || "",
        immediate_actions_required: formData.immediate_actions_required,
        action_deadline: formData.action_deadline || undefined,
      };
    },
    updateApi: PolicyAPI.update,
    getUpdatePayload: (formData) => {
      const parseCS = (v: string) => parseArr(v);
      return {
        platform: formData.platform,
        policy_change_type: formData.policy_change_type,
        policy_description: formData.policy_description || "",
        immediate_actions_required: formData.immediate_actions_required || "",
        policy_reference_url: formData.policy_reference_url || undefined,
        effective_date: formData.effective_date || undefined,
        action_deadline: formData.action_deadline || undefined,
        affected_campaigns: parseCS(formData.affected_campaigns || ""),
        affected_ad_sets: parseCS(formData.affected_ad_sets || ""),
        affected_assets: parseCS(formData.affected_assets || ""),
        performance_impact: formData.performance_impact || "",
        budget_impact: formData.budget_impact || "",
        compliance_risk: formData.compliance_risk || "",
      };
    },
    initEditState: (linked) => ({
      platform: toEditStr(linked.platform),
      policy_change_type: toEditStr(linked.policy_change_type),
      policy_description: toEditStr(linked.policy_description),
      immediate_actions_required: toEditStr(linked.immediate_actions_required),
      policy_reference_url: toEditStr(linked.policy_reference_url),
      effective_date: toEditStr(linked.effective_date).substring(0, 10),
      action_deadline: toEditStr(linked.action_deadline).substring(0, 10),
      affected_campaigns: Array.isArray(linked.affected_campaigns)
        ? (linked.affected_campaigns as string[]).join(", ") : toEditStr(linked.affected_campaigns),
      affected_ad_sets: Array.isArray(linked.affected_ad_sets)
        ? (linked.affected_ad_sets as string[]).join(", ") : toEditStr(linked.affected_ad_sets),
      affected_assets: Array.isArray(linked.affected_assets)
        ? (linked.affected_assets as string[]).join(", ") : toEditStr(linked.affected_assets),
      performance_impact: toEditStr(linked.performance_impact),
      budget_impact: toEditStr(linked.budget_impact),
      compliance_risk: toEditStr(linked.compliance_risk),
    }),
  },
};

export { defaultReportContext };
