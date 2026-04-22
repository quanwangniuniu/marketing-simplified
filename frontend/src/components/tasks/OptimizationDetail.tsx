"use client";

import { useState, useEffect } from "react";
import {
  OptimizationAPI,
  Optimization,
  OptimizationCreateRequest,
  OptimizationUpdateRequest,
} from "@/lib/api/optimizationApi";
import { TaskAPI } from "@/lib/api/taskApi";
import toast from "react-hot-toast";
import Icon from "@/components/ui/Icon";
import AutoResizeTextarea from "@/components/ui/AutoResizeTextarea";
import { OptimizationForm } from "./OptimizationForm";

// Platform configuration
const PLATFORMS = [
  { code: "fb", name: "Facebook", icon: "facebook" as const },
  { code: "tt", name: "TikTok", icon: "tiktok" as const },
  { code: "ig", name: "Instagram", icon: "instagram" as const },
  { code: "ga", name: "Google Ads", icon: "google-ads" as const },
] as const;

// Preset metrics options
const PRESET_METRICS = [
  "CPA",
  "CTR",
  "ROAS",
  "CPM",
  "CPC",
  "CVR",
  "Impressions",
  "Clicks",
  "Conversions",
] as const;

// Window options for triggered metrics
const WINDOW_OPTIONS = ["24h", "48h", "7d", "14d", "30d"] as const;

const IMPLICIT_FIELD_BASE =
  "rounded-md border border-transparent bg-transparent text-sm text-gray-900 shadow-none transition-colors hover:border-slate-200 hover:bg-white/60 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-0";
const IMPLICIT_FIELD_CLASS = `w-full px-3 py-2 ${IMPLICIT_FIELD_BASE}`;
const IMPLICIT_FIELD_MONO_CLASS = `${IMPLICIT_FIELD_CLASS} font-mono`;
const IMPLICIT_FIELD_COMPACT_CLASS = `w-full px-2 py-1.5 ${IMPLICIT_FIELD_BASE}`;
const IMPLICIT_FIELD_COMPACT_MONO_CLASS = `${IMPLICIT_FIELD_COMPACT_CLASS} font-mono`;

// Types for metrics
interface TriggeredMetricItem {
  id: string;
  metricName: string;
  deltaPct: number | "";
  window: string;
  isCustom: boolean;
}

interface BaselineMetricItem {
  id: string;
  metricName: string;
  value: number | "";
  isCustom: boolean;
}

interface OptimizationDetailProps {
  optimization: Optimization | null;
  taskId: number;
  loading: boolean;
  onRefresh?: () => void;
}

function PlatformLegend() {
  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs text-gray-500">Available platforms:</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.code}
            className="flex min-w-0 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs"
          >
            <Icon name={platform.icon} size="sm" className="shrink-0 text-gray-600" />
            <span className="shrink-0 font-medium text-gray-700">{platform.code}</span>
            <span className="shrink-0 text-gray-500">-</span>
            <span className="truncate text-gray-600">{platform.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OptimizationDetail({
  optimization,
  taskId,
  loading,
  onRefresh,
}: OptimizationDetailProps) {
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<OptimizationCreateRequest & OptimizationUpdateRequest>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  // Convert JSON metrics to array format for UI
  const parseTriggeredMetrics = (
    metrics: Record<string, any> | null | undefined
  ): TriggeredMetricItem[] => {
    if (!metrics || typeof metrics !== "object") return [];
    return Object.entries(metrics).map(([key, value]) => ({
      id: crypto.randomUUID(),
      metricName: key,
      deltaPct: value?.delta_pct ?? "",
      window: value?.window ?? "24h",
      isCustom: !PRESET_METRICS.includes(key as any),
    }));
  };

  const parseBaselineMetrics = (
    metrics: Record<string, any> | null | undefined
  ): BaselineMetricItem[] => {
    if (!metrics || typeof metrics !== "object") return [];
    return Object.entries(metrics).map(([key, value]) => ({
      id: crypto.randomUUID(),
      metricName: key,
      value: typeof value === "number" ? value : "",
      isCustom: !PRESET_METRICS.includes(key as any),
    }));
  };

  // Convert array format back to JSON
  const buildTriggeredMetricsJSON = (
    items: TriggeredMetricItem[]
  ): Record<string, { delta_pct: number; window: string }> | null => {
    const result: Record<string, { delta_pct: number; window: string }> = {};
    items.forEach((item) => {
      if (
        item.metricName.trim() &&
        item.deltaPct !== "" &&
        typeof item.deltaPct === "number" &&
        item.window.trim()
      ) {
        result[item.metricName.trim()] = {
          delta_pct: item.deltaPct,
          window: item.window.trim(),
        };
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  const buildBaselineMetricsJSON = (
    items: BaselineMetricItem[]
  ): Record<string, number> | null => {
    const result: Record<string, number> = {};
    items.forEach((item) => {
      if (
        item.metricName.trim() &&
        item.value !== "" &&
        typeof item.value === "number"
      ) {
        result[item.metricName.trim()] = item.value;
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  // Local state for editable fields
  const [localAffectedEntityIds, setLocalAffectedEntityIds] = useState(
    optimization?.affected_entity_ids || null
  );
  const [localTriggeredMetrics, setLocalTriggeredMetrics] = useState<TriggeredMetricItem[]>(() => {
    return parseTriggeredMetrics(optimization?.triggered_metrics);
  });
  const [localBaselineMetrics, setLocalBaselineMetrics] = useState<BaselineMetricItem[]>(() => {
    return parseBaselineMetrics(optimization?.baseline_metrics);
  });
  const [localObservedMetrics, setLocalObservedMetrics] = useState(
    optimization?.observed_metrics || null
  );
  const [localActionType, setLocalActionType] = useState(
    optimization?.action_type || "pause"
  );
  const [localPlannedAction, setLocalPlannedAction] = useState(
    optimization?.planned_action || ""
  );
  const [localExecutionStatus, setLocalExecutionStatus] = useState(
    optimization?.execution_status || "detected"
  );
  const [localExecutedAt, setLocalExecutedAt] = useState(
    optimization?.executed_at || null
  );
  const [localMonitoredAt, setLocalMonitoredAt] = useState(
    optimization?.monitored_at || null
  );
  const [localOutcomeNotes, setLocalOutcomeNotes] = useState(
    optimization?.outcome_notes || ""
  );

  useEffect(() => {
    if (optimization) {
      setLocalAffectedEntityIds(optimization.affected_entity_ids || null);
      setLocalTriggeredMetrics(parseTriggeredMetrics(optimization.triggered_metrics));
      setLocalBaselineMetrics(parseBaselineMetrics(optimization.baseline_metrics));
      setLocalObservedMetrics(optimization.observed_metrics || null);
      setLocalActionType(optimization.action_type);
      setLocalPlannedAction(optimization.planned_action || "");
      setLocalExecutionStatus(optimization.execution_status);
      setLocalExecutedAt(optimization.executed_at || null);
      setLocalMonitoredAt(optimization.monitored_at || null);
      setLocalOutcomeNotes(optimization.outcome_notes || "");
    }
  }, [optimization]);

  const parseIdList = (value: string): string[] => {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  const formatIdList = (ids: string[] | undefined): string => {
    if (!ids || ids.length === 0) return "";
    return ids.join("\n");
  };

  const formatJSONField = (obj: Record<string, any> | null | undefined): string => {
    if (!obj) return "";
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return "";
    }
  };

  const parseJSONField = (value: string): Record<string, any> | null => {
    if (!value.trim()) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const handleSaveField = async (
    fieldName: string,
    updateData: Partial<OptimizationUpdateRequest>
  ) => {
    if (!optimization || savingField) return;

    try {
      setSavingField(fieldName);
      await OptimizationAPI.updateOptimization(optimization.id, updateData);
      toast.success(`${fieldName} updated successfully`);
      onRefresh && onRefresh();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          `Failed to update ${fieldName}`
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleCreate = async () => {
    if (creating || !formData) return;

    try {
      setCreating(true);
      const response = await OptimizationAPI.createOptimization({
        task: taskId,
        ...formData,
      } as any);
      const created = response.data;

      // Link task to optimization
      await TaskAPI.linkTask(taskId, "optimization", String(created.id));

      toast.success("Optimization created successfully");
      setFormData({});
      onRefresh && onRefresh();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Failed to create optimization"
      );
    } finally {
      setCreating(false);
    }
  };


  const formatDateTime = (value?: string | null) => {
    if (!value) return "Not set";
    return new Date(value).toLocaleString();
  };

  if (loading) {
    return (
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600">Loading optimization...</span>
        </div>
      </div>
    );
  }

  // Show create form if no optimization exists
  if (!optimization) {
    return (
      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Create Optimization
        </h3>
        <OptimizationForm
          mode="create"
          initialData={formData}
          onChange={(data) => setFormData(data)}
        />
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
              creating
                ? "bg-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {creating ? "Creating..." : "Create Optimization"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optimization Overview */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Optimization Details
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                localExecutionStatus === "completed"
                  ? "bg-green-50 text-green-800"
                  : localExecutionStatus === "monitoring"
                  ? "bg-[#3CCED7]/10 text-[#1a9ba3]"
                  : localExecutionStatus === "executed"
                  ? "bg-purple-50 text-purple-800"
                  : localExecutionStatus === "planned"
                  ? "bg-yellow-50 text-yellow-800"
                  : localExecutionStatus === "cancelled"
                  ? "bg-red-50 text-red-800"
                  : "bg-gray-50 text-gray-800"
              }`}
            >
              {localExecutionStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            {/* Affected Entity IDs */}
            <div className="border border-gray-200 rounded-md p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Affected Entities
              </h4>
              <PlatformLegend />
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Campaign IDs (format: platform:id, one per line)
                  </label>
                  <AutoResizeTextarea
                    value={formatIdList(localAffectedEntityIds?.campaign_ids)}
                    onChange={(e) => {
                      const updated = {
                        ...localAffectedEntityIds,
                        campaign_ids: parseIdList(e.target.value),
                      };
                      setLocalAffectedEntityIds(updated);
                    }}
                    onBlur={() => {
                      if (
                        JSON.stringify(localAffectedEntityIds) !==
                        JSON.stringify(optimization?.affected_entity_ids)
                      ) {
                        handleSaveField("Affected Entity IDs", {
                          affected_entity_ids: localAffectedEntityIds,
                        });
                      }
                    }}
                    disabled={savingField === "Affected Entity IDs"}
                    rows={3}
                    className={IMPLICIT_FIELD_MONO_CLASS}
                    placeholder="fb:123456&#10;tt:789012"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ad Set IDs (format: platform:id, one per line)
                  </label>
                  <AutoResizeTextarea
                    value={formatIdList(localAffectedEntityIds?.ad_set_ids)}
                    onChange={(e) => {
                      const updated = {
                        ...localAffectedEntityIds,
                        ad_set_ids: parseIdList(e.target.value),
                      };
                      setLocalAffectedEntityIds(updated);
                    }}
                    onBlur={() => {
                      if (
                        JSON.stringify(localAffectedEntityIds) !==
                        JSON.stringify(optimization?.affected_entity_ids)
                      ) {
                        handleSaveField("Affected Entity IDs", {
                          affected_entity_ids: localAffectedEntityIds,
                        });
                      }
                    }}
                    disabled={savingField === "Affected Entity IDs"}
                    rows={2}
                    className={IMPLICIT_FIELD_MONO_CLASS}
                    placeholder="fb:789"
                  />
                </div>
              </div>
            </div>

            {/* Triggered Metrics */}
            <div className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-900">
                  Triggered Metrics
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newMetric: TriggeredMetricItem = {
                      id: crypto.randomUUID(),
                      metricName: "",
                      deltaPct: "",
                      window: "24h",
                      isCustom: false,
                    };
                    setLocalTriggeredMetrics([...localTriggeredMetrics, newMetric]);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add Metric
                </button>
              </div>
              <div className="space-y-3">
                {localTriggeredMetrics.map((metric, index) => (
                  <div
                    key={metric.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-200"
                  >
                    <div className="flex-1 grid grid-cols-1 gap-3">
                      {/* Metric Name */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Metric Name
                        </label>
                        {metric.isCustom ? (
                          <input
                            type="text"
                            value={metric.metricName}
                            onChange={(e) => {
                              const updated = [...localTriggeredMetrics];
                              updated[index] = { ...updated[index], metricName: e.target.value };
                              setLocalTriggeredMetrics(updated);
                            }}
                            onBlur={() => {
                              const json = buildTriggeredMetricsJSON(localTriggeredMetrics);
                              if (JSON.stringify(json) !== JSON.stringify(optimization?.triggered_metrics)) {
                                handleSaveField("Triggered Metrics", {
                                  triggered_metrics: json,
                                });
                              }
                            }}
                            disabled={savingField === "Triggered Metrics"}
                            placeholder="Custom metric"
                            className={IMPLICIT_FIELD_COMPACT_CLASS}
                          />
                        ) : (
                          <select
                            value={metric.metricName || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const updated = [...localTriggeredMetrics];
                              if (value === "__custom__") {
                                updated[index] = { ...updated[index], isCustom: true, metricName: "" };
                              } else if (value !== "") {
                                updated[index] = { ...updated[index], isCustom: false, metricName: value };
                              } else {
                                updated[index] = { ...updated[index], metricName: "" };
                              }
                              setLocalTriggeredMetrics(updated);
                            }}
                            onBlur={() => {
                              const json = buildTriggeredMetricsJSON(localTriggeredMetrics);
                              if (JSON.stringify(json) !== JSON.stringify(optimization?.triggered_metrics)) {
                                handleSaveField("Triggered Metrics", {
                                  triggered_metrics: json,
                                });
                              }
                            }}
                            disabled={savingField === "Triggered Metrics"}
                            className={IMPLICIT_FIELD_COMPACT_CLASS}
                          >
                            <option value="">Select metric</option>
                            {PRESET_METRICS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                            <option value="__custom__">+ Custom</option>
                          </select>
                        )}
                      </div>

                      {/* Delta % */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Delta %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={metric.deltaPct === "" ? "" : metric.deltaPct}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            const updated = [...localTriggeredMetrics];
                            if (inputValue === "" || inputValue === "-") {
                              updated[index] = { ...updated[index], deltaPct: "" };
                            } else {
                              const numValue = parseFloat(inputValue);
                              if (!isNaN(numValue)) {
                                updated[index] = { ...updated[index], deltaPct: numValue };
                              }
                            }
                            setLocalTriggeredMetrics(updated);
                          }}
                          onBlur={() => {
                            const json = buildTriggeredMetricsJSON(localTriggeredMetrics);
                            if (JSON.stringify(json) !== JSON.stringify(optimization?.triggered_metrics)) {
                              handleSaveField("Triggered Metrics", {
                                triggered_metrics: json,
                              });
                            }
                          }}
                          disabled={savingField === "Triggered Metrics"}
                          placeholder="35"
                          className={IMPLICIT_FIELD_COMPACT_CLASS}
                        />
                      </div>

                      {/* Window */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Window
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={metric.window}
                            onChange={(e) => {
                              const updated = [...localTriggeredMetrics];
                              updated[index] = { ...updated[index], window: e.target.value };
                              setLocalTriggeredMetrics(updated);
                            }}
                            onBlur={() => {
                              const json = buildTriggeredMetricsJSON(localTriggeredMetrics);
                              if (JSON.stringify(json) !== JSON.stringify(optimization?.triggered_metrics)) {
                                handleSaveField("Triggered Metrics", {
                                  triggered_metrics: json,
                                });
                              }
                            }}
                            disabled={savingField === "Triggered Metrics"}
                            className={`flex-1 ${IMPLICIT_FIELD_COMPACT_CLASS.replace("w-full ", "")}`}
                          >
                            {WINDOW_OPTIONS.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                          {localTriggeredMetrics.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = localTriggeredMetrics.filter((_, i) => i !== index);
                                setLocalTriggeredMetrics(updated);
                                const json = buildTriggeredMetricsJSON(updated);
                                handleSaveField("Triggered Metrics", {
                                  triggered_metrics: json,
                                });
                              }}
                              className="px-2 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md text-sm font-medium"
                              title="Remove metric"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {localTriggeredMetrics.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No triggered metrics added.
                  </p>
                )}
              </div>
            </div>

            {/* Baseline Metrics */}
            <div className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-900">
                  Baseline Metrics
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newMetric: BaselineMetricItem = {
                      id: crypto.randomUUID(),
                      metricName: "",
                      value: "",
                      isCustom: false,
                    };
                    setLocalBaselineMetrics([...localBaselineMetrics, newMetric]);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add Metric
                </button>
              </div>
              <div className="space-y-3">
                {localBaselineMetrics.map((metric, index) => (
                  <div
                    key={metric.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-200"
                  >
                    <div className="flex-1 grid grid-cols-1 gap-3">
                      {/* Metric Name */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Metric Name
                        </label>
                        {metric.isCustom ? (
                          <input
                            type="text"
                            value={metric.metricName}
                            onChange={(e) => {
                              const updated = [...localBaselineMetrics];
                              updated[index] = { ...updated[index], metricName: e.target.value };
                              setLocalBaselineMetrics(updated);
                            }}
                            onBlur={() => {
                              const json = buildBaselineMetricsJSON(localBaselineMetrics);
                              if (JSON.stringify(json) !== JSON.stringify(optimization?.baseline_metrics)) {
                                handleSaveField("Baseline Metrics", {
                                  baseline_metrics: json,
                                });
                              }
                            }}
                            disabled={savingField === "Baseline Metrics"}
                            placeholder="Custom metric"
                            className={IMPLICIT_FIELD_COMPACT_CLASS}
                          />
                        ) : (
                          <select
                            value={metric.metricName || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const updated = [...localBaselineMetrics];
                              if (value === "__custom__") {
                                updated[index] = { ...updated[index], isCustom: true, metricName: "" };
                              } else if (value !== "") {
                                updated[index] = { ...updated[index], isCustom: false, metricName: value };
                              } else {
                                updated[index] = { ...updated[index], metricName: "" };
                              }
                              setLocalBaselineMetrics(updated);
                            }}
                            onBlur={() => {
                              const json = buildBaselineMetricsJSON(localBaselineMetrics);
                              if (JSON.stringify(json) !== JSON.stringify(optimization?.baseline_metrics)) {
                                handleSaveField("Baseline Metrics", {
                                  baseline_metrics: json,
                                });
                              }
                            }}
                            disabled={savingField === "Baseline Metrics"}
                            className={IMPLICIT_FIELD_COMPACT_CLASS}
                          >
                            <option value="">Select metric</option>
                            {PRESET_METRICS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                            <option value="__custom__">+ Custom</option>
                          </select>
                        )}
                      </div>

                      {/* Value */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Value
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={metric.value === "" ? "" : metric.value}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const updated = [...localBaselineMetrics];
                              if (inputValue === "" || inputValue === "-") {
                                updated[index] = { ...updated[index], value: "" };
                              } else {
                                const numValue = parseFloat(inputValue);
                                if (!isNaN(numValue)) {
                                  updated[index] = { ...updated[index], value: numValue };
                                }
                              }
                              setLocalBaselineMetrics(updated);
                            }}
                            onBlur={() => {
                              const json = buildBaselineMetricsJSON(localBaselineMetrics);
                              if (JSON.stringify(json) !== JSON.stringify(optimization?.baseline_metrics)) {
                                handleSaveField("Baseline Metrics", {
                                  baseline_metrics: json,
                                });
                              }
                            }}
                            disabled={savingField === "Baseline Metrics"}
                            placeholder="12.3"
                            className={`flex-1 ${IMPLICIT_FIELD_COMPACT_CLASS.replace("w-full ", "")}`}
                          />
                          {localBaselineMetrics.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = localBaselineMetrics.filter((_, i) => i !== index);
                                setLocalBaselineMetrics(updated);
                                const json = buildBaselineMetricsJSON(updated);
                                handleSaveField("Baseline Metrics", {
                                  baseline_metrics: json,
                                });
                              }}
                              className="px-2 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md text-sm font-medium"
                              title="Remove metric"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {localBaselineMetrics.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No baseline metrics added.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Action Type */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action Type
              </label>
              <select
                value={localActionType}
                onChange={(e) => {
                  setLocalActionType(
                    e.target.value as "pause" | "scale" | "duplicate" | "edit"
                  );
                }}
                onBlur={() => {
                  if (localActionType !== optimization?.action_type) {
                    handleSaveField("Action Type", { action_type: localActionType });
                  }
                }}
                disabled={savingField === "Action Type"}
                className={IMPLICIT_FIELD_CLASS}
              >
                <option value="pause">Pause</option>
                <option value="scale">Scale</option>
                <option value="duplicate">Duplicate</option>
                <option value="edit">Edit</option>
              </select>
            </div>

            {/* Planned Action */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Planned Action
              </label>
              <AutoResizeTextarea
                value={localPlannedAction}
                onChange={(e) => setLocalPlannedAction(e.target.value)}
                onBlur={() => {
                  if (localPlannedAction !== optimization?.planned_action) {
                    handleSaveField("Planned Action", {
                      planned_action: localPlannedAction || undefined,
                    });
                  }
                }}
                disabled={savingField === "Planned Action"}
                rows={3}
                className={IMPLICIT_FIELD_CLASS}
                placeholder="Describe what action will be taken..."
              />
            </div>

            {/* Execution Status */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Execution Status
              </label>
              <select
                value={localExecutionStatus}
                onChange={(e) => {
                  setLocalExecutionStatus(
                    e.target.value as
                      | "detected"
                      | "planned"
                      | "executed"
                      | "monitoring"
                      | "completed"
                      | "cancelled"
                  );
                }}
                onBlur={() => {
                  if (localExecutionStatus !== optimization?.execution_status) {
                    handleSaveField("Execution Status", {
                      execution_status: localExecutionStatus,
                    });
                  }
                }}
                disabled={savingField === "Execution Status"}
                className={IMPLICIT_FIELD_CLASS}
              >
                <option value="detected">Detected</option>
                <option value="planned">Planned</option>
                <option value="executed">Executed</option>
                <option value="monitoring">Monitoring</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Executed At */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Executed At
              </label>
              <input
                type="datetime-local"
                value={
                  localExecutedAt
                    ? new Date(localExecutedAt).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) => {
                  const value = e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null;
                  setLocalExecutedAt(value);
                }}
                onBlur={() => {
                  if (localExecutedAt !== optimization?.executed_at) {
                    handleSaveField("Executed At", {
                      executed_at: localExecutedAt,
                    });
                  }
                }}
                disabled={savingField === "Executed At"}
                className={IMPLICIT_FIELD_CLASS}
              />
            </div>

            {/* Monitored At */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Monitored At
              </label>
              <input
                type="datetime-local"
                value={
                  localMonitoredAt
                    ? new Date(localMonitoredAt).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) => {
                  const value = e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null;
                  setLocalMonitoredAt(value);
                }}
                onBlur={() => {
                  if (localMonitoredAt !== optimization?.monitored_at) {
                    handleSaveField("Monitored At", {
                      monitored_at: localMonitoredAt,
                    });
                  }
                }}
                disabled={savingField === "Monitored At"}
                className={IMPLICIT_FIELD_CLASS}
              />
            </div>

            {/* Outcome Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outcome Notes
              </label>
              <AutoResizeTextarea
                value={localOutcomeNotes}
                onChange={(e) => setLocalOutcomeNotes(e.target.value)}
                onBlur={() => {
                  if (localOutcomeNotes !== optimization?.outcome_notes) {
                    handleSaveField("Outcome Notes", {
                      outcome_notes: localOutcomeNotes || undefined,
                    });
                  }
                }}
                disabled={savingField === "Outcome Notes"}
                rows={3}
                className={IMPLICIT_FIELD_CLASS}
                placeholder="Notes about outcome and performance changes..."
              />
            </div>

            {/* Observed Metrics (for monitoring/completed status) */}
            {(localExecutionStatus === "monitoring" ||
              localExecutionStatus === "completed") && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Observed Metrics (JSON)
                </label>
                <AutoResizeTextarea
                  value={formatJSONField(localObservedMetrics)}
                  onChange={(e) => {
                    const parsed = parseJSONField(e.target.value);
                    setLocalObservedMetrics(parsed);
                  }}
                  onBlur={() => {
                    if (
                      JSON.stringify(localObservedMetrics) !==
                      JSON.stringify(optimization?.observed_metrics)
                    ) {
                      handleSaveField("Observed Metrics", {
                        observed_metrics: localObservedMetrics,
                      });
                    }
                  }}
                  disabled={savingField === "Observed Metrics"}
                  rows={4}
                  className={IMPLICIT_FIELD_MONO_CLASS}
                  placeholder='{"CPA": 10.5, "CTR": 1.2}'
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
