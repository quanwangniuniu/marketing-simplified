"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTask, AlertingAPI } from "@/lib/api/alertingApi";
import { ProjectAPI } from "@/lib/api/projectApi";
import { toast } from "react-hot-toast";

interface AlertDetailProps {
  alert: AlertTask;
  projectId?: number | null;
  onRefresh?: () => void;
}

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In Progress" },
  { value: "mitigated", label: "Mitigated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const statusStyles: Record<string, string> = {
  open: "bg-gray-100 text-gray-700 border-gray-200",
  acknowledged: "bg-[#3CCED7]/15 text-[#1a9ba3] border-[#3CCED7]/30",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  mitigated: "bg-teal-100 text-teal-700 border-teal-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-slate-200 text-slate-700 border-slate-300",
};

const severityStyles: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const severityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const metricOptions = [
  { value: "spend", label: "Spend" },
  { value: "roas", label: "ROAS" },
  { value: "cpa", label: "CPA" },
  { value: "ctr", label: "CTR" },
  { value: "cpc", label: "CPC" },
];

const changeTypeOptions = [
  { value: "percent", label: "Percent" },
  { value: "amount", label: "Amount" },
];

const windowOptions = [
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
];

const alertTypeOptions = [
  { value: "spend_spike", label: "Spend Spike" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "performance_drop", label: "Performance Drop" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "other", label: "Other" },
];

const quickAssumptions = [
  "Budget misconfiguration",
  "Policy rejection",
  "Creative fatigue",
  "Tracking issue",
  "Seasonality shift",
];

const quickResolutions = [
  "Pause campaign",
  "Reduce budget",
  "Appeal policy",
  "Replace creative",
  "Adjust targeting",
  "Fix tracking",
];

const IMPLICIT_ALERT_FIELD_BASE =
  "rounded-md border border-transparent bg-white/70 text-sm text-slate-900 shadow-none transition-colors hover:border-slate-200 hover:bg-white focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-0";
const IMPLICIT_ALERT_FIELD_CLASS = `w-full px-3 py-2 ${IMPLICIT_ALERT_FIELD_BASE}`;
const IMPLICIT_ALERT_INLINE_FIELD_CLASS = `flex-1 px-3 py-2 ${IMPLICIT_ALERT_FIELD_BASE}`;

const quickRootCauses = [
  "Wrong targeting",
  "Budget pacing error",
  "Policy enforcement",
  "Learning phase reset",
  "External traffic drop",
];

const quickPreventions = [
  "Add guardrails",
  "Pre-launch checklist",
  "Budget alert rules",
  "Creative rotation",
  "Tracking validation",
];

export default function AlertDetail({ alert, projectId, onRefresh }: AlertDetailProps) {
  const [formData, setFormData] = useState({
    alert_type: alert.alert_type || "spend_spike",
    status: alert.status,
    severity: alert.severity,
    assigned_to: alert.assigned_to || "",
    acknowledged_by: alert.acknowledged_by || "",
    investigation_notes: alert.investigation_notes || "",
    resolution_steps: alert.resolution_steps || "",
    postmortem_root_cause: alert.postmortem_root_cause || "",
    postmortem_prevention: alert.postmortem_prevention || "",
    affected_entities: alert.affected_entities || [],
    related_references: alert.related_references || [],
    initial_metrics: {
      metric_key: alert.initial_metrics?.metric_key || "spend",
      change_type: alert.initial_metrics?.change_type || "percent",
      change_value: alert.initial_metrics?.change_value ?? "",
      change_window: alert.initial_metrics?.change_window || "daily",
      current_value: alert.initial_metrics?.current_value ?? "",
      previous_value: alert.initial_metrics?.previous_value ?? "",
    },
  });
  const [members, setMembers] = useState<
    { id: number; username: string; email: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const statusClassName =
    (formData.status
      ? statusStyles[formData.status as keyof typeof statusStyles]
      : undefined) || "bg-gray-100 text-gray-700 border-gray-200";
  const [draftNotes, setDraftNotes] = useState({
    investigation: "",
    resolution: "",
    rootCause: "",
    prevention: "",
  });
  const relatedReferences = (formData.related_references || []).filter(
    (ref): ref is string => typeof ref === "string"
  );

  useEffect(() => {
    setFormData({
      alert_type: alert.alert_type || "spend_spike",
      status: alert.status,
      severity: alert.severity,
      assigned_to: alert.assigned_to || "",
      acknowledged_by: alert.acknowledged_by || "",
      investigation_notes: alert.investigation_notes || "",
      resolution_steps: alert.resolution_steps || "",
      postmortem_root_cause: alert.postmortem_root_cause || "",
      postmortem_prevention: alert.postmortem_prevention || "",
      affected_entities: alert.affected_entities || [],
      related_references: alert.related_references || [],
      initial_metrics: {
        metric_key: alert.initial_metrics?.metric_key || "spend",
        change_type: alert.initial_metrics?.change_type || "percent",
        change_value: alert.initial_metrics?.change_value ?? "",
        change_window: alert.initial_metrics?.change_window || "daily",
        current_value: alert.initial_metrics?.current_value ?? "",
        previous_value: alert.initial_metrics?.previous_value ?? "",
      },
    });
  }, [alert]);

  useEffect(() => {
    if (!projectId) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        const resp = await ProjectAPI.getProjectMembers(projectId);
        const mapped =
          resp?.map((member) => ({
            id: member.user.id,
            username: member.user.username || "",
            email: member.user.email || "",
          })) || [];
        setMembers(mapped);
      } catch (error) {
        console.error("Failed to load project members:", error);
        setMembers([]);
      }
    };

    loadMembers();
  }, [projectId]);

  const memberOptions = useMemo(() => {
    return members.map((member) => ({
      value: member.id,
      label: member.username || member.email || `User #${member.id}`,
    }));
  }, [members]);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const splitTokens = (value: string) => {
    const seen = new Set<string>();
    return value
      .split("|")
      .map((token) => token.trim())
      .filter((token) => {
        if (!token || seen.has(token)) return false;
        seen.add(token);
        return true;
      });
  };

  const addToken = (field: string, value: string) => {
    setFormData((prev) => {
      const current = (prev as any)[field] || "";
      const tokens = splitTokens(current);
      if (tokens.includes(value)) {
        return prev;
      }
      const next = tokens.length > 0 ? `${current} | ${value}` : value;
      return { ...prev, [field]: next };
    });
  };

  const removeToken = (field: string, index: number) => {
    setFormData((prev) => {
      const current = (prev as any)[field] || "";
      const tokens = splitTokens(current);
      tokens.splice(index, 1);
      return { ...prev, [field]: tokens.join(" | ") };
    });
  };

  const updateMetrics = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      initial_metrics: {
        ...(prev as any).initial_metrics,
        [field]: value,
      },
    }));
  };

  const updateAffectedEntities = (next: Record<string, any>[]) => {
    setFormData((prev) => ({
      ...prev,
      affected_entities: next,
    }));
  };

  const updateReferences = (next: string[]) => {
    setFormData((prev) => ({
      ...prev,
      related_references: next,
    }));
  };

  const getEntityDisplay = (entity: Record<string, any>) => {
    const idValue =
      entity.entity_id ||
      entity.campaign_id ||
      entity.ad_set_id ||
      entity.adset_id ||
      entity.campaignId ||
      entity.adSetId ||
      entity.id;
    const platform = entity.platform || "unknown";
    const entityType = entity.entity_type || entity.type || "entity";
    return `${platform} / ${entityType} / ${idValue || "id"}`;
  };

  const [entityDraft, setEntityDraft] = useState({
    platform: "facebook",
    entity_type: "campaign",
    entity_id: "",
  });
  const [referenceDraft, setReferenceDraft] = useState("");

  const addEntity = () => {
    const entityId = entityDraft.entity_id.trim();
    if (!entityId) return;
    const exists = formData.affected_entities.some(
      (item: Record<string, any>) =>
        item.platform === entityDraft.platform &&
        item.entity_type === entityDraft.entity_type &&
        (item.entity_id || item.campaign_id || item.ad_set_id || item.id) ===
          entityId
    );
    if (exists) return;
    updateAffectedEntities([
      ...formData.affected_entities,
      {
        platform: entityDraft.platform,
        entity_type: entityDraft.entity_type,
        entity_id: entityId,
      },
    ]);
    setEntityDraft((prev) => ({ ...prev, entity_id: "" }));
  };

  const removeEntity = (index: number) => {
    const next = formData.affected_entities.filter((_, idx) => idx !== index);
    updateAffectedEntities(next);
  };

  const addReference = () => {
    const value = referenceDraft.trim();
    if (!value) return;
    const existingReferences = (formData.related_references || []).filter(
      (ref): ref is string => typeof ref === "string"
    );
    const next = Array.from(
      new Set([...existingReferences, value])
    );
    updateReferences(next);
    setReferenceDraft("");
  };

  const removeReference = (index: number) => {
    const next = (formData.related_references || [])
      .filter((ref): ref is string => typeof ref === "string")
      .filter((_, idx) => idx !== index);
    updateReferences(next);
  };

  const handleSave = async () => {
    if (!alert?.id) return;
    try {
      setSaving(true);
      await AlertingAPI.updateAlertTask(alert.id, {
        alert_type: formData.alert_type as AlertTask["alert_type"],
        status: formData.status,
        severity: formData.severity as AlertTask["severity"],
        assigned_to: formData.assigned_to ? Number(formData.assigned_to) : null,
        acknowledged_by: formData.acknowledged_by
          ? Number(formData.acknowledged_by)
          : null,
        investigation_notes: formData.investigation_notes || "",
        resolution_steps: formData.resolution_steps || "",
        postmortem_root_cause: formData.postmortem_root_cause || "",
        postmortem_prevention: formData.postmortem_prevention || "",
        affected_entities: formData.affected_entities || [],
        related_references: formData.related_references || [],
        initial_metrics: {
          metric_key: formData.initial_metrics.metric_key || "spend",
          change_type: formData.initial_metrics.change_type || "percent",
          change_value:
            formData.initial_metrics.change_value === ""
              ? null
              : Number(formData.initial_metrics.change_value),
          change_window: formData.initial_metrics.change_window || "daily",
          current_value:
            formData.initial_metrics.current_value === ""
              ? null
              : Number(formData.initial_metrics.current_value),
          previous_value:
            formData.initial_metrics.previous_value === ""
              ? null
              : Number(formData.initial_metrics.previous_value),
        },
      });
      toast.success("Alert updated.");
      onRefresh?.();
    } catch (error: any) {
      console.error("Failed to update alert:", error);
      toast.error("Failed to update alert.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-slate-200 pt-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Alert Details</h3>
          <p className="text-sm text-gray-500">
            Keep updates short and action-focused.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white text-slate-700"
            value={formData.alert_type}
            onChange={(e) => updateField("alert_type", e.target.value)}
          >
            {alertTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className={`px-3 py-1 rounded-full text-xs font-medium border bg-white ${
              severityStyles[formData.severity] || "text-gray-700 border-gray-200"
            }`}
            value={formData.severity}
            onChange={(e) => updateField("severity", e.target.value)}
          >
            {severityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusClassName
            }`}
          >
            {(formData.status || "unknown").replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">Status</h4>
            <span className="text-xs text-slate-500">Tap to update</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => {
              const active = formData.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField("status", opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    active
                      ? statusStyles[opt.value]
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Assigned To
              </label>
              <select
                className={IMPLICIT_ALERT_FIELD_CLASS}
                value={formData.assigned_to || ""}
                onChange={(e) => updateField("assigned_to", e.target.value)}
              >
                <option value="">Unassigned</option>
                {memberOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Acknowledged By
              </label>
              <select
                className={IMPLICIT_ALERT_FIELD_CLASS}
                value={formData.acknowledged_by || ""}
                onChange={(e) => updateField("acknowledged_by", e.target.value)}
              >
                <option value="">Not acknowledged</option>
                {memberOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-amber-900">
              Investigation Notes
            </h4>
            <span className="text-xs text-amber-700">Quick presets</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickAssumptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => addToken("investigation_notes", item)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white text-amber-700 border border-amber-200"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {splitTokens(formData.investigation_notes || "").map((token, index) => (
              <span
                key={`${token}-${index}`}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
              >
                {token}
                <button
                  type="button"
                  className="text-amber-700"
                  onClick={() => removeToken("investigation_notes", index)}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={IMPLICIT_ALERT_INLINE_FIELD_CLASS}
              value={draftNotes.investigation}
              onChange={(e) =>
                setDraftNotes((prev) => ({ ...prev, investigation: e.target.value }))
              }
              placeholder="Optional if not mentioned above."
            />
            <button
              type="button"
              className="px-3 py-2 bg-amber-600 text-white text-sm rounded-md"
              onClick={() => {
                if (!draftNotes.investigation.trim()) return;
                addToken("investigation_notes", draftNotes.investigation.trim());
                setDraftNotes((prev) => ({ ...prev, investigation: "" }));
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0f757a]">Resolution Steps</h4>
            <span className="text-xs text-[#3CCED7]">Tap to add</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickResolutions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => addToken("resolution_steps", item)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white text-[#1a9ba3] border border-[#3CCED7]/30"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {splitTokens(formData.resolution_steps || "").map((token, index) => (
              <span
                key={`${token}-${index}`}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#3CCED7]/15 text-[#1a9ba3]"
              >
                {token}
                <button
                  type="button"
                  className="text-[#1a9ba3]"
                  onClick={() => removeToken("resolution_steps", index)}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={IMPLICIT_ALERT_INLINE_FIELD_CLASS}
              value={draftNotes.resolution}
              onChange={(e) =>
                setDraftNotes((prev) => ({ ...prev, resolution: e.target.value }))
              }
              placeholder="Optional if not mentioned above."
            />
            <button
              type="button"
              className="px-3 py-2 bg-[#3CCED7] text-white text-sm rounded-md"
              onClick={() => {
                if (!draftNotes.resolution.trim()) return;
                addToken("resolution_steps", draftNotes.resolution.trim());
                setDraftNotes((prev) => ({ ...prev, resolution: "" }));
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-emerald-900 mb-2">
              Post-Resolution Review
            </h4>
            <div className="text-xs font-medium text-emerald-700 mb-2">
              Root Cause
            </div>
            <div className="flex flex-wrap gap-2">
              {quickRootCauses.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => addToken("postmortem_root_cause", item)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white text-emerald-700 border border-emerald-200"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {splitTokens(formData.postmortem_root_cause || "").map(
                (token, index) => (
                  <span
                    key={`${token}-${index}`}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                  >
                    {token}
                    <button
                      type="button"
                      className="text-emerald-700"
                      onClick={() => removeToken("postmortem_root_cause", index)}
                    >
                      x
                    </button>
                  </span>
                )
              )}
            </div>
            <div className="flex gap-2 mt-2">
            <input
              className={IMPLICIT_ALERT_INLINE_FIELD_CLASS}
              value={draftNotes.rootCause}
              onChange={(e) =>
                setDraftNotes((prev) => ({ ...prev, rootCause: e.target.value }))
              }
              placeholder="Optional if not mentioned above."
            />
              <button
                type="button"
                className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-md"
                onClick={() => {
                  if (!draftNotes.rootCause.trim()) return;
                  addToken("postmortem_root_cause", draftNotes.rootCause.trim());
                  setDraftNotes((prev) => ({ ...prev, rootCause: "" }));
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-emerald-700 mb-2">
              Preventive Measures
            </div>
            <div className="flex flex-wrap gap-2">
              {quickPreventions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => addToken("postmortem_prevention", item)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white text-emerald-700 border border-emerald-200"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {splitTokens(formData.postmortem_prevention || "").map(
                (token, index) => (
                  <span
                    key={`${token}-${index}`}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                  >
                    {token}
                    <button
                      type="button"
                      className="text-emerald-700"
                      onClick={() => removeToken("postmortem_prevention", index)}
                    >
                      x
                    </button>
                  </span>
                )
              )}
            </div>
            <div className="flex gap-2 mt-2">
            <input
              className={IMPLICIT_ALERT_INLINE_FIELD_CLASS}
              value={draftNotes.prevention}
              onChange={(e) =>
                setDraftNotes((prev) => ({ ...prev, prevention: e.target.value }))
              }
              placeholder="Optional if not mentioned above."
            />
              <button
                type="button"
                className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-md"
                onClick={() => {
                  if (!draftNotes.prevention.trim()) return;
                  addToken("postmortem_prevention", draftNotes.prevention.trim());
                  setDraftNotes((prev) => ({ ...prev, prevention: "" }));
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 pt-1">
        {alert.initial_metrics && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-800">
                Initial Metrics
              </h4>
              <span className="text-xs text-slate-500">Snapshot</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2.5">
                <div className="text-xs text-slate-500">Metric</div>
                <select
                  className={IMPLICIT_ALERT_FIELD_CLASS}
                  value={formData.initial_metrics.metric_key}
                  onChange={(e) => updateMetrics("metric_key", e.target.value)}
                >
                  {metricOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-2.5">
                <div className="text-xs text-amber-700">Change Type</div>
                <select
                  className={IMPLICIT_ALERT_FIELD_CLASS}
                  value={formData.initial_metrics.change_type}
                  onChange={(e) => updateMetrics("change_type", e.target.value)}
                >
                  {changeTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-2.5">
                <div className="text-xs text-amber-700">Change Value</div>
                <input
                  type="number"
                  className={IMPLICIT_ALERT_FIELD_CLASS}
                  value={formData.initial_metrics.change_value}
                  onChange={(e) => updateMetrics("change_value", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-md p-4 space-y-2.5">
                <div className="text-xs text-[#1a9ba3]">Window</div>
                <select
                  className={IMPLICIT_ALERT_FIELD_CLASS}
                  value={formData.initial_metrics.change_window}
                  onChange={(e) => updateMetrics("change_window", e.target.value)}
                >
                  {windowOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 space-y-2.5">
                <div className="text-xs text-emerald-700">Current Value</div>
                <input
                  type="number"
                  className={IMPLICIT_ALERT_FIELD_CLASS}
                  value={formData.initial_metrics.current_value}
                  onChange={(e) => updateMetrics("current_value", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-md p-4 space-y-2.5">
                <div className="text-xs text-rose-700">Previous Value</div>
                <input
                  type="number"
                  className={IMPLICIT_ALERT_FIELD_CLASS}
                  value={formData.initial_metrics.previous_value}
                  onChange={(e) => updateMetrics("previous_value", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="font-medium text-slate-900 text-sm">
            Affected Entities
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              className={IMPLICIT_ALERT_FIELD_CLASS}
              value={entityDraft.platform}
              onChange={(e) =>
                setEntityDraft((prev) => ({ ...prev, platform: e.target.value }))
              }
            >
              <option value="facebook">Facebook</option>
              <option value="google">Google</option>
              <option value="tiktok">TikTok</option>
              <option value="other">Other</option>
            </select>
            <select
              className={IMPLICIT_ALERT_FIELD_CLASS}
              value={entityDraft.entity_type}
              onChange={(e) =>
                setEntityDraft((prev) => ({
                  ...prev,
                  entity_type: e.target.value,
                }))
              }
            >
              <option value="campaign">Campaign</option>
              <option value="ad_set">Ad Set</option>
              <option value="ad">Ad</option>
            </select>
            <input
              className={IMPLICIT_ALERT_FIELD_CLASS}
              value={entityDraft.entity_id}
              onChange={(e) =>
                setEntityDraft((prev) => ({ ...prev, entity_id: e.target.value }))
              }
              placeholder="ID"
            />
            <button
              type="button"
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md"
              onClick={addEntity}
            >
              Add
            </button>
          </div>
          {formData.affected_entities.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {formData.affected_entities.map((entity, index) => (
                <span
                  key={`${getEntityDisplay(entity)}-${index}`}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                >
                  {getEntityDisplay(entity)}
                  <button
                    type="button"
                    className="ml-2 text-slate-500"
                    onClick={() => removeEntity(index)}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="font-medium text-slate-900 text-sm">References</div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              className={IMPLICIT_ALERT_INLINE_FIELD_CLASS}
              value={referenceDraft}
              onChange={(e) => setReferenceDraft(e.target.value)}
              placeholder="Paste ID or link"
            />
            <button
              type="button"
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md"
              onClick={addReference}
            >
              Add
            </button>
          </div>
          {relatedReferences.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {relatedReferences.map((ref, index) => (
                <span
                  key={`${ref}-${index}`}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  {ref}
                  <button
                    type="button"
                    className="ml-2 text-indigo-500"
                    onClick={() => removeReference(index)}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
              saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {saving ? "Saving..." : "Save Alert"}
          </button>
        </div>
      </div>
    </section>
  );
}
