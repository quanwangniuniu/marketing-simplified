"use client";

import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../ui/accordion";
import {
  ExperimentAPI,
  Experiment,
  ExperimentProgressUpdate,
  ExperimentUpdateRequest,
} from "@/lib/api/experimentApi";
import toast from "react-hot-toast";
import Icon from "@/components/ui/Icon";
import AutoResizeTextarea from "@/components/ui/AutoResizeTextarea";

// Platform configuration
const PLATFORMS = [
  { code: "fb", name: "Facebook", icon: "facebook" as const },
  { code: "tt", name: "TikTok", icon: "tiktok" as const },
  { code: "ig", name: "Instagram", icon: "instagram" as const },
  { code: "ga", name: "Google Ads", icon: "google-ads" as const },
] as const;

const IMPLICIT_FIELD_CLASS =
  "w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-gray-900 shadow-none transition-colors hover:border-slate-200 hover:bg-white/60 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-0";
const IMPLICIT_FIELD_MONO_CLASS = `${IMPLICIT_FIELD_CLASS} font-mono`;

interface ExperimentDetailProps {
  experiment: Experiment | null;
  loading: boolean;
  onRefresh?: () => void;
}

export default function ExperimentDetail({
  experiment,
  loading,
  onRefresh,
}: ExperimentDetailProps) {
  const [creatingUpdate, setCreatingUpdate] = useState(false);
  const [newUpdateNotes, setNewUpdateNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingOutcome, setUpdatingOutcome] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  
  // Local state for all editable fields
  const [localHypothesis, setLocalHypothesis] = useState(experiment?.hypothesis || "");
  const [localExpectedOutcome, setLocalExpectedOutcome] = useState(
    experiment?.expected_outcome || ""
  );
  const [localDescription, setLocalDescription] = useState(
    experiment?.description || ""
  );
  const [localSuccessMetric, setLocalSuccessMetric] = useState(
    experiment?.success_metric || ""
  );
  const [localConstraints, setLocalConstraints] = useState(
    experiment?.constraints || ""
  );
  const [localControlGroup, setLocalControlGroup] = useState(
    experiment?.control_group || { campaigns: [], ad_set_ids: [], ad_ids: [] }
  );
  const [localVariantGroup, setLocalVariantGroup] = useState(
    experiment?.variant_group || { campaigns: [], ad_set_ids: [], ad_ids: [] }
  );
  const [localStatus, setLocalStatus] = useState(experiment?.status || "draft");
  const [localOutcome, setLocalOutcome] = useState(
    experiment?.experiment_outcome || ""
  );
  const [localOutcomeNotes, setLocalOutcomeNotes] = useState(
    experiment?.outcome_notes || ""
  );

  useEffect(() => {
    if (experiment) {
      setLocalHypothesis(experiment.hypothesis || "");
      setLocalExpectedOutcome(experiment.expected_outcome || "");
      setLocalDescription(experiment.description || "");
      setLocalSuccessMetric(experiment.success_metric || "");
      setLocalConstraints(experiment.constraints || "");
      setLocalControlGroup(
        experiment.control_group || { campaigns: [], ad_set_ids: [], ad_ids: [] }
      );
      setLocalVariantGroup(
        experiment.variant_group || { campaigns: [], ad_set_ids: [], ad_ids: [] }
      );
      setLocalStatus(experiment.status);
      setLocalOutcome(experiment.experiment_outcome || "");
      setLocalOutcomeNotes(experiment.outcome_notes || "");
    }
  }, [experiment]);

  const progressUpdates: ExperimentProgressUpdate[] =
    experiment?.progress_updates || [];

  // Helper functions for ID lists
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

  // Helper function to compare groups
  const groupsEqual = (
    group1: { campaigns?: string[]; ad_set_ids?: string[]; ad_ids?: string[] } | null | undefined,
    group2: { campaigns?: string[]; ad_set_ids?: string[]; ad_ids?: string[] } | null | undefined
  ): boolean => {
    if (!group1 && !group2) return true;
    if (!group1 || !group2) return false;
    
    const arr1 = [
      ...(group1.campaigns || []),
      ...(group1.ad_set_ids || []),
      ...(group1.ad_ids || []),
    ];
    const arr2 = [
      ...(group2.campaigns || []),
      ...(group2.ad_set_ids || []),
      ...(group2.ad_ids || []),
    ];
    
    if (arr1.length !== arr2.length) return false;
    
    return JSON.stringify(group1) === JSON.stringify(group2);
  };

  // Generic save function for any field
  const handleSaveField = async (
    fieldName: string,
    updateData: Partial<ExperimentUpdateRequest>
  ) => {
    if (!experiment || savingField) return;

    try {
      setSavingField(fieldName);
      await ExperimentAPI.updateExperiment(experiment.id, updateData);
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

  const handleCreateProgressUpdate = async () => {
    if (creatingUpdate || !newUpdateNotes.trim() || !experiment) return;

    try {
      setCreatingUpdate(true);
      await ExperimentAPI.createProgressUpdate(experiment.id, {
        notes: newUpdateNotes.trim(),
      });
      toast.success("Progress update added successfully");
      setNewUpdateNotes("");
      onRefresh && onRefresh();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Failed to create progress update"
      );
    } finally {
      setCreatingUpdate(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Experiment["status"]) => {
    if (updatingStatus || newStatus === localStatus || !experiment) return;

    try {
      setUpdatingStatus(true);
      await ExperimentAPI.updateExperiment(experiment.id, {
        status: newStatus,
      });
      setLocalStatus(newStatus);
      toast.success(`Experiment status updated to ${newStatus}`);
      onRefresh && onRefresh();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail?.status ||
          error.response?.data?.detail ||
          "Failed to update status"
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSetOutcome = async () => {
    if (updatingOutcome || localStatus !== "completed" || !experiment) return;

    try {
      setUpdatingOutcome(true);
      await ExperimentAPI.updateExperiment(experiment.id, {
        experiment_outcome: localOutcome as "win" | "lose" | "inconclusive" | null,
        outcome_notes: localOutcomeNotes || null,
      });
      toast.success("Experiment outcome saved");
      onRefresh && onRefresh();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          "Failed to set experiment outcome"
      );
    } finally {
      setUpdatingOutcome(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "Not set";
    return new Date(value).toLocaleString();
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Not set";
    return new Date(value).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600">Loading experiment...</span>
        </div>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="border-t border-slate-200 pt-5">
        <div className="text-center py-8">
          <p className="text-gray-500">No experiment found for this task.</p>
          <p className="text-gray-400 text-sm mt-2">
            The experiment may not have been created yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Experiment Overview */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 mr-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Experiment Details
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Task title is managed from the task summary.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                localStatus === "running"
                  ? "bg-green-50 text-green-800"
                  : localStatus === "completed"
                  ? "bg-[#3CCED7]/10 text-[#1a9ba3]"
                  : localStatus === "paused"
                  ? "bg-yellow-50 text-yellow-800"
                  : localStatus === "cancelled"
                  ? "bg-red-50 text-red-800"
                  : "bg-gray-50 text-gray-800"
              }`}
            >
              {localStatus}
            </span>
            {localStatus === "completed" && experiment.experiment_outcome && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  experiment.experiment_outcome === "win"
                    ? "bg-green-100 text-green-800"
                    : experiment.experiment_outcome === "lose"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {experiment.experiment_outcome}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hypothesis
              </label>
              <AutoResizeTextarea
                value={localHypothesis}
                onChange={(e) => setLocalHypothesis(e.target.value)}
                onBlur={() => {
                  if (localHypothesis !== experiment?.hypothesis) {
                    handleSaveField("Hypothesis", { hypothesis: localHypothesis });
                  }
                }}
                disabled={savingField === "Hypothesis"}
                rows={3}
                className={IMPLICIT_FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Expected Outcome
              </label>
              <AutoResizeTextarea
                value={localExpectedOutcome}
                onChange={(e) => setLocalExpectedOutcome(e.target.value)}
                onBlur={() => {
                  if (localExpectedOutcome !== experiment?.expected_outcome) {
                    handleSaveField("Expected Outcome", {
                      expected_outcome: localExpectedOutcome || null,
                    });
                  }
                }}
                disabled={savingField === "Expected Outcome"}
                rows={2}
                className={IMPLICIT_FIELD_CLASS}
                placeholder="e.g., 10% increase in CTR"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </label>
              <AutoResizeTextarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={() => {
                  if (localDescription !== experiment?.description) {
                    handleSaveField("Description", {
                      description: localDescription || null,
                    });
                  }
                }}
                disabled={savingField === "Description"}
                rows={3}
                className={IMPLICIT_FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Success Metric
              </label>
              <input
                type="text"
                value={localSuccessMetric}
                onChange={(e) => setLocalSuccessMetric(e.target.value)}
                onBlur={() => {
                  if (localSuccessMetric !== experiment?.success_metric) {
                    handleSaveField("Success Metric", {
                      success_metric: localSuccessMetric || null,
                    });
                  }
                }}
                disabled={savingField === "Success Metric"}
                className={IMPLICIT_FIELD_CLASS}
                placeholder="e.g., CTR, CPA, ROAS"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Constraints
              </label>
              <AutoResizeTextarea
                value={localConstraints}
                onChange={(e) => setLocalConstraints(e.target.value)}
                onBlur={() => {
                  if (localConstraints !== experiment?.constraints) {
                    handleSaveField("Constraints", {
                      constraints: localConstraints || null,
                    });
                  }
                }}
                disabled={savingField === "Constraints"}
                rows={3}
                className={IMPLICIT_FIELD_CLASS}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start Date
                </label>
                <p className="mt-1 text-sm leading-6 text-slate-900">
                  {formatDate(experiment.start_date)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  (Set from Task start date)
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  End Date
                </label>
                <p className="mt-1 text-sm leading-6 text-slate-900">
                  {formatDate(experiment.end_date)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  (Set from Task due date)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Started At
              </label>
              <p className="mt-1 text-sm leading-6 text-slate-900">
                {formatDateTime(experiment.started_at)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                (Set automatically when experiment starts)
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                value={localStatus}
                onChange={(e) =>
                  handleUpdateStatus(
                    e.target.value as Experiment["status"]
                  )
                }
                disabled={updatingStatus}
                className={IMPLICIT_FIELD_CLASS}
              >
                <option value="draft">Draft</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Control & Variant Groups */}
      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Control & Variant Groups
        </h3>
        {/* Platform Icons */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500 mr-2">Available platforms:</span>
          {PLATFORMS.map((platform) => (
            <div
              key={platform.code}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs"
            >
              <Icon name={platform.icon} size="sm" className="text-gray-600" />
              <span className="text-gray-700 font-medium">{platform.code}</span>
              <span className="text-gray-500">-</span>
              <span className="text-gray-600">{platform.name}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Control Group */}
          <div className="border border-gray-200 rounded-md p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Control Group
            </h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Campaigns (format: platform:id, one per line)
                </label>
                <AutoResizeTextarea
                  value={formatIdList(localControlGroup?.campaigns)}
                  onChange={(e) => {
                    const updated = {
                      ...localControlGroup,
                      campaigns: parseIdList(e.target.value),
                    };
                    setLocalControlGroup(updated);
                  }}
                  onBlur={() => {
                    if (!groupsEqual(localControlGroup, experiment?.control_group)) {
                      handleSaveField("Control Group", {
                        control_group: localControlGroup,
                      });
                    }
                  }}
                  disabled={savingField === "Control Group"}
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
                  value={formatIdList(localControlGroup?.ad_set_ids)}
                  onChange={(e) => {
                    const updated = {
                      ...localControlGroup,
                      ad_set_ids: parseIdList(e.target.value),
                    };
                    setLocalControlGroup(updated);
                  }}
                  onBlur={() => {
                    if (!groupsEqual(localControlGroup, experiment?.control_group)) {
                      handleSaveField("Control Group", {
                        control_group: localControlGroup,
                      });
                    }
                  }}
                  disabled={savingField === "Control Group"}
                  rows={2}
                  className={IMPLICIT_FIELD_MONO_CLASS}
                  placeholder="fb:789"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ad IDs (format: platform:id, one per line)
                </label>
                <AutoResizeTextarea
                  value={formatIdList(localControlGroup?.ad_ids)}
                  onChange={(e) => {
                    const updated = {
                      ...localControlGroup,
                      ad_ids: parseIdList(e.target.value),
                    };
                    setLocalControlGroup(updated);
                  }}
                  onBlur={() => {
                    if (!groupsEqual(localControlGroup, experiment?.control_group)) {
                      handleSaveField("Control Group", {
                        control_group: localControlGroup,
                      });
                    }
                  }}
                  disabled={savingField === "Control Group"}
                  rows={2}
                  className={IMPLICIT_FIELD_MONO_CLASS}
                  placeholder="fb:101"
                />
              </div>
            </div>
          </div>

          {/* Variant Group */}
          <div className="border border-gray-200 rounded-md p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Variant Group
            </h4>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Campaigns (format: platform:id, one per line)
                </label>
                <AutoResizeTextarea
                  value={formatIdList(localVariantGroup?.campaigns)}
                  onChange={(e) => {
                    const updated = {
                      ...localVariantGroup,
                      campaigns: parseIdList(e.target.value),
                    };
                    setLocalVariantGroup(updated);
                  }}
                  onBlur={() => {
                    if (!groupsEqual(localVariantGroup, experiment?.variant_group)) {
                      handleSaveField("Variant Group", {
                        variant_group: localVariantGroup,
                      });
                    }
                  }}
                  disabled={savingField === "Variant Group"}
                  rows={3}
                  className={IMPLICIT_FIELD_MONO_CLASS}
                  placeholder="fb:654321"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ad Set IDs (format: platform:id, one per line)
                </label>
                <AutoResizeTextarea
                  value={formatIdList(localVariantGroup?.ad_set_ids)}
                  onChange={(e) => {
                    const updated = {
                      ...localVariantGroup,
                      ad_set_ids: parseIdList(e.target.value),
                    };
                    setLocalVariantGroup(updated);
                  }}
                  onBlur={() => {
                    if (!groupsEqual(localVariantGroup, experiment?.variant_group)) {
                      handleSaveField("Variant Group", {
                        variant_group: localVariantGroup,
                      });
                    }
                  }}
                  disabled={savingField === "Variant Group"}
                  rows={2}
                  className={IMPLICIT_FIELD_MONO_CLASS}
                  placeholder="fb:789"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ad IDs (format: platform:id, one per line)
                </label>
                <AutoResizeTextarea
                  value={formatIdList(localVariantGroup?.ad_ids)}
                  onChange={(e) => {
                    const updated = {
                      ...localVariantGroup,
                      ad_ids: parseIdList(e.target.value),
                    };
                    setLocalVariantGroup(updated);
                  }}
                  onBlur={() => {
                    if (!groupsEqual(localVariantGroup, experiment?.variant_group)) {
                      handleSaveField("Variant Group", {
                        variant_group: localVariantGroup,
                      });
                    }
                  }}
                  disabled={savingField === "Variant Group"}
                  rows={2}
                  className={IMPLICIT_FIELD_MONO_CLASS}
                  placeholder="fb:101"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Updates */}
      <div className="border-t border-slate-200 pt-5">
        <Accordion type="multiple" defaultValue={["updates"]}>
          <AccordionItem value="updates" className="border-none">
            <AccordionTrigger className="py-3">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-lg font-semibold text-gray-900">
                  Progress Updates
                </h3>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                  {progressUpdates.length} updates
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              {progressUpdates.length === 0 ? (
                <p className="text-gray-500 text-sm mb-4">
                  No progress updates yet.
                </p>
              ) : (
                <div className="space-y-3 mb-6">
                  {progressUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="border border-gray-200 rounded-md p-3 text-sm text-gray-900"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">
                          {formatDateTime(update.update_date)}
                        </div>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{update.notes}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new progress update */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Add Progress Update
                </h4>
                <div className="space-y-2">
                  <AutoResizeTextarea
                    value={newUpdateNotes}
                    onChange={(e) => setNewUpdateNotes(e.target.value)}
                    rows={3}
                    className={IMPLICIT_FIELD_CLASS}
                    placeholder="Enter progress update notes..."
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateProgressUpdate}
                      disabled={creatingUpdate || !newUpdateNotes.trim()}
                      className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                        creatingUpdate || !newUpdateNotes.trim()
                          ? "bg-indigo-300 cursor-not-allowed"
                          : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {creatingUpdate ? "Adding..." : "Add Update"}
                    </button>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Outcome Section (only when completed) */}
      {localStatus === "completed" && (
        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Experiment Outcome
          </h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outcome
              </label>
              <select
                value={localOutcome}
                onChange={(e) => setLocalOutcome(e.target.value)}
                className={IMPLICIT_FIELD_CLASS}
              >
                <option value="">Not set</option>
                <option value="win">Win</option>
                <option value="lose">Lose</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outcome Notes
              </label>
              <AutoResizeTextarea
                value={localOutcomeNotes}
                onChange={(e) => setLocalOutcomeNotes(e.target.value)}
                rows={4}
                className={IMPLICIT_FIELD_CLASS}
                placeholder="Summarize learnings and conclusions from the experiment..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSetOutcome}
                disabled={updatingOutcome || !localOutcome}
                className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                  updatingOutcome || !localOutcome
                    ? "bg-indigo-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {updatingOutcome ? "Saving..." : "Save Outcome"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
