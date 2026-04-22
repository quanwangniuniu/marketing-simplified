"use client";

import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../ui/accordion";
import {
  RetrospectiveTaskData,
  RetrospectiveAPI,
  UpdateRetrospectiveData,
} from "@/lib/api/retrospectiveApi";

interface RetrospectiveDetailProps {
  retrospective?: RetrospectiveTaskData;
  loading?: boolean;
  compact?: boolean; // If true, show only essential metadata (for TaskCard)
  onRefresh?: () => void; // Callback to refresh retrospective data after actions
  onSave?: (payload: UpdateRetrospectiveData) => Promise<void>;
}

interface PreOutcomeDraft {
  decision: string;
  confidence_level: 1 | 2 | 3 | 4 | 5 | null;
  primary_assumption: string;
  key_risk_ignore: string;
}

interface PostOutcomeDraft {
  outcome_compared_to_expectation: "better" | "worse" | "as_expected" | "";
  biggest_wrong_assumption: string;
  would_make_same_decision_again: "yes" | "no" | "";
}

const createPreOutcomeDraft = (
  retrospective?: RetrospectiveTaskData,
): PreOutcomeDraft => ({
  decision: retrospective?.decision || "",
  confidence_level: retrospective?.confidence_level ?? null,
  primary_assumption: retrospective?.primary_assumption || "",
  key_risk_ignore: retrospective?.key_risk_ignore || "",
});

const createPostOutcomeDraft = (
  retrospective?: RetrospectiveTaskData,
): PostOutcomeDraft => ({
  outcome_compared_to_expectation:
    retrospective?.outcome_compared_to_expectation || "",
  biggest_wrong_assumption: retrospective?.biggest_wrong_assumption || "",
  would_make_same_decision_again:
    retrospective?.would_make_same_decision_again || "",
});

export default function RetrospectiveDetail({
  retrospective,
  loading,
  compact = false,
  onRefresh,
  onSave,
}: RetrospectiveDetailProps) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [approvingReport, setApprovingReport] = useState(false);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPostOutcomeEditing, setIsPostOutcomeEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPostOutcomeSaving, setIsPostOutcomeSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [postOutcomeSaveError, setPostOutcomeSaveError] = useState("");
  const [preOutcomeDraft, setPreOutcomeDraft] = useState<PreOutcomeDraft>(() =>
    createPreOutcomeDraft(retrospective),
  );
  const [postOutcomeDraft, setPostOutcomeDraft] = useState<PostOutcomeDraft>(
    () => createPostOutcomeDraft(retrospective),
  );

  useEffect(() => {
    if (isEditing) return;
    setPreOutcomeDraft(createPreOutcomeDraft(retrospective));
  }, [retrospective, isEditing]);

  useEffect(() => {
    if (isPostOutcomeSaving || isPostOutcomeEditing) return;
    setPostOutcomeDraft(createPostOutcomeDraft(retrospective));
  }, [retrospective, isPostOutcomeSaving, isPostOutcomeEditing]);

  // Helper function to get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "reported":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-[#3CCED7]/15 text-[#1a9ba3]";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format date for display
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Not set";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Format status for display
  const formatStatus = (status?: string) => {
    if (!status) return "Unknown";
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Handle generate report
  const handleGenerateReport = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!retrospective || !retrospective.id) return;

    try {
      setGeneratingReport(true);

      // Call API to generate report (this starts an async Celery task)
      const response = await RetrospectiveAPI.generateReport(
        retrospective.id,
        "pdf",
      );

      // Check if API returned an error
      if (response.data.error) {
        setGeneratingReport(false);
        alert(`Failed to start report generation: ${response.data.error}`);
        return;
      }

      // Check if report was generated synchronously (should not happen with current backend)
      if (response.data.report_url) {
        setGeneratingReport(false);
        if (onRefresh) {
          await onRefresh();
        }
        alert("Report generated successfully!");
        return;
      }

      // Poll for report completion (check every 3 seconds, up to 30 seconds)
      const maxAttempts = 10;
      const pollInterval = 3000;
      let attempts = 0;
      let reportGenerated = false;

      const pollForReport = async () => {
        while (attempts < maxAttempts && !reportGenerated) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          attempts++;

          try {
            // Fetch latest data to check if report was generated
            const latestResponse = await RetrospectiveAPI.getRetrospective(
              retrospective.id,
            );

            if (latestResponse.data.report_url) {
              reportGenerated = true;

              // Update parent component state (this will trigger re-render with new prop)
              if (onRefresh) {
                await onRefresh();
              }

              setGeneratingReport(false);

              // Wait a moment for state to update
              await new Promise((resolve) => setTimeout(resolve, 500));

              alert(
                "Report generated successfully! The page has been updated.",
              );
              break;
            }
          } catch (error) {
            // Continue polling even if one request fails
          }
        }

        if (!reportGenerated) {
          setGeneratingReport(false);

          // Try one final refresh before giving up
          if (onRefresh) {
            await onRefresh();
          }

          alert(
            "Report generation timed out. This usually means:\n\n" +
              "1. Celery worker is not running\n" +
              "2. Redis broker is not accessible\n\n" +
              "Please check:\n" +
              "- Start Celery worker: celery -A backend worker --loglevel=info\n" +
              "- Ensure Redis is running: redis-cli ping\n" +
              "- Check backend logs for Celery task errors\n\n" +
              "Refresh the page manually to check if the report was generated.",
          );
        }
      };

      // Start polling in background
      pollForReport();

      // Don't wait for polling to complete, show immediate feedback
      alert(
        "Report generation started. The page will update automatically when the report is ready.",
      );
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to generate report";
      alert(`Failed to generate report: ${errorMessage}`);
      setGeneratingReport(false);
    }
  };

  // Handle start analysis
  const handleStartAnalysis = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!retrospective || !retrospective.id) return;

    try {
      setStartingAnalysis(true);

      // Call API to start analysis (this starts an async Celery task)
      await RetrospectiveAPI.startAnalysis(retrospective.id);

      // Poll for status updates until retrospective is completed
      // Start polling immediately (don't wait for first interval)
      const maxAttempts = 20; // Check for up to 20 times (60 seconds total)
      const pollInterval = 1000; // Check every 1 second (faster polling since it's quick)
      let attempts = 0;
      let analysisCompleted = false;

      const pollForCompletion = async () => {
        // First check immediately
        while (attempts < maxAttempts && !analysisCompleted) {
          // Wait before checking (except first time)
          if (attempts > 0) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }
          attempts++;
          try {
            const latestResponse = await RetrospectiveAPI.getRetrospective(
              retrospective.id,
            );

            if (
              latestResponse.data.status === "completed" ||
              latestResponse.data.status === "reported"
            ) {
              analysisCompleted = true;
              if (onRefresh) {
                await onRefresh();
              }
              setStartingAnalysis(false);
              await new Promise((resolve) => setTimeout(resolve, 500));
              alert(
                "Analysis completed successfully! The page has been updated.",
              );
              break;
            }
          } catch (error) {
            // Continue polling even if one request fails
          }
        }

        if (!analysisCompleted) {
          setStartingAnalysis(false);
          if (onRefresh) {
            await onRefresh();
          }
          alert(
            "Analysis is taking longer than expected. This usually means:\n\n" +
              "1. Celery worker is processing the task\n" +
              "2. The task encountered an error (check backend logs)\n" +
              "3. Duplicate KPI data exists (this can cause task failure)\n\n" +
              "Please refresh the page manually to check the current status.",
          );
        }
      };

      // Start polling immediately (no alert, polling will handle completion)
      pollForCompletion();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to start analysis";
      alert(`Failed to start analysis: ${errorMessage}`);
      setStartingAnalysis(false);
    }
  };

  // Handle approve report
  const handleApproveReport = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!retrospective || !retrospective.id) return;

    try {
      setApprovingReport(true);

      // Call API to approve report
      await RetrospectiveAPI.approveReport(retrospective.id, {
        approved: true,
        comments: "Approved via frontend",
      });

      // Refresh retrospective data to get updated approval state
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to approve report";
      alert(`Failed to approve report: ${errorMessage}`);
    } finally {
      setApprovingReport(false);
    }
  };

  // Compact mode for TaskCard - show only essential metadata
  if (compact) {
    if (loading) {
      return (
        <div className="mt-3 pt-3 border-t border-gray-100" data-action>
          <div className="text-xs text-gray-500">
            Loading retrospective metadata...
          </div>
        </div>
      );
    }

    if (!retrospective) {
      return null; // Don't show anything in compact mode if no data
    }
    return (
      <div className="mt-3 pt-3 border-t border-gray-100" data-action>
        <div className="flex flex-col text-xs mb-2 space-y-1">
          {/* Retrospective Status */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">
              Retrospective Status:
            </span>
            <span
              className={`px-2 py-0.5 rounded-full ${
                getStatusColor(retrospective.status) ||
                "bg-gray-100 text-gray-800"
              }`}
            >
              {retrospective.status_display ||
                formatStatus(retrospective.status) ||
                "Unknown"}
            </span>
          </div>

          {/* Report Availability */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">
              Report Available:
            </span>
            <span
              className={
                retrospective.report_url ? "text-green-600" : "text-gray-500"
              }
            >
              {retrospective.report_url ? "Yes" : "No"}
            </span>
          </div>

          {/* Approval State */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Approval State:</span>
            {retrospective.reviewed_by ? (
              <span className="text-green-600">
                Approved by {retrospective.reviewed_by}
                {retrospective.reviewed_at && (
                  <span className="text-gray-500 ml-1">
                    ({new Date(retrospective.reviewed_at).toLocaleDateString()})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-500">Pending</span>
            )}
          </div>

          {/* Start Analysis Button (if scheduled) */}
          {retrospective.status === "scheduled" && (
            <div className="mt-2">
              <button
                onClick={handleStartAnalysis}
                disabled={startingAnalysis}
                className="w-full px-2 py-1 bg-[#3CCED7] text-white text-xs rounded hover:bg-[#2AB5BD] disabled:bg-[#3CCED7] disabled:cursor-not-allowed"
                data-action
              >
                {startingAnalysis ? "Starting..." : "Start Analysis"}
              </button>
            </div>
          )}

          {/* Generate Report Button (if completed but no report) */}
          {retrospective.status === "completed" &&
            !retrospective.report_url && (
              <div className="mt-2">
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="w-full px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                  data-action
                >
                  {generatingReport ? "Generating..." : "Generate Report"}
                </button>
              </div>
            )}

          {/* View Report Link (if report available) */}
          {retrospective.report_url && (
            <div className="mt-2">
              <a
                href={
                  retrospective.report_url.startsWith("http")
                    ? retrospective.report_url
                    : `http://localhost:8000${retrospective.report_url}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                View Report
              </a>
            </div>
          )}

          {/* Approve Report Button (if report available but not approved) */}
          {retrospective.report_url && !retrospective.reviewed_by && (
            <div className="mt-2">
              <button
                onClick={handleApproveReport}
                disabled={approvingReport}
                className="w-full px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                data-action
              >
                {approvingReport ? "Approving..." : "Approve Report"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mode for detail page
  if (loading) {
    return (
      <section>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">
            Loading retrospective details...
          </p>
        </div>
      </section>
    );
  }

  if (!retrospective) {
    return (
      <section>
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">
            No retrospective data available
          </p>
        </div>
      </section>
    );
  }

  const updatePreOutcomeDraft = <K extends keyof PreOutcomeDraft>(
    key: K,
    value: PreOutcomeDraft[K],
  ) => {
    if (saveError) {
      setSaveError("");
    }
    setPreOutcomeDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updatePostOutcomeDraft = <K extends keyof PostOutcomeDraft>(
    key: K,
    value: PostOutcomeDraft[K],
  ) => {
    if (postOutcomeSaveError) {
      setPostOutcomeSaveError("");
    }
    setPostOutcomeDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartEdit = () => {
    setPreOutcomeDraft(createPreOutcomeDraft(retrospective));
    setSaveError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setPreOutcomeDraft(createPreOutcomeDraft(retrospective));
    setSaveError("");
    setIsEditing(false);
  };

  const handleCancelPostOutcome = () => {
    setPostOutcomeDraft(createPostOutcomeDraft(retrospective));
    setPostOutcomeSaveError("");
    setIsPostOutcomeEditing(false);
  };

  const handleStartPostOutcomeEdit = () => {
    setPostOutcomeDraft(createPostOutcomeDraft(retrospective));
    setPostOutcomeSaveError("");
    setIsPostOutcomeEditing(true);
  };

  const handleSaveChanges = async () => {
    const trimmedDecision = preOutcomeDraft.decision.trim();
    const trimmedPrimaryAssumption = preOutcomeDraft.primary_assumption.trim();

    if (!trimmedDecision) {
      setSaveError("Decision is required.");
      return;
    }
    if (
      !preOutcomeDraft.confidence_level ||
      ![1, 2, 3, 4, 5].includes(preOutcomeDraft.confidence_level)
    ) {
      setSaveError("Confidence level must be between 1 and 5.");
      return;
    }
    if (!trimmedPrimaryAssumption) {
      setSaveError("Primary assumption is required.");
      return;
    }

    const payload: UpdateRetrospectiveData = {
      decision: trimmedDecision,
      confidence_level: preOutcomeDraft.confidence_level,
      primary_assumption: trimmedPrimaryAssumption,
      key_risk_ignore: preOutcomeDraft.key_risk_ignore.trim() || null,
    };

    try {
      setIsSaving(true);
      setSaveError("");
      if (onSave) {
        await onSave(payload);
      } else {
        await RetrospectiveAPI.updateRetrospective(retrospective.id, payload);
        if (onRefresh) {
          await onRefresh();
        }
      }
      setIsEditing(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to save retrospective details.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePostOutcome = async () => {
    const payload: UpdateRetrospectiveData = {
      outcome_compared_to_expectation:
        postOutcomeDraft.outcome_compared_to_expectation || null,
      biggest_wrong_assumption:
        postOutcomeDraft.biggest_wrong_assumption.trim() || null,
      would_make_same_decision_again:
        postOutcomeDraft.would_make_same_decision_again || null,
    };

    try {
      setIsPostOutcomeSaving(true);
      setPostOutcomeSaveError("");
      if (onSave) {
        await onSave(payload);
      } else {
        await RetrospectiveAPI.updateRetrospective(retrospective.id, payload);
        if (onRefresh) {
          await onRefresh();
        }
      }
      setIsPostOutcomeEditing(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to save post-outcome evaluation.";
      setPostOutcomeSaveError(message);
    } finally {
      setIsPostOutcomeSaving(false);
    }
  };

  return (
    <section>
      <Accordion type="multiple" defaultValue={["item-1"]}>
        <AccordionItem value="item-1" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">
              Retrospective Details
            </h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-8">
              {/* Status */}
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">
                  Status:
                </label>
                <span
                  className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(
                    retrospective.status,
                  )}`}
                >
                  {retrospective.status_display ||
                    formatStatus(retrospective.status) ||
                    "Unknown"}
                </span>
              </div>

              {/* Start Analysis Button */}
              {retrospective.status === "scheduled" && (
                <div className="flex flex-row items-center gap-3">
                  <button
                    onClick={handleStartAnalysis}
                    disabled={startingAnalysis}
                    className="px-4 py-2 bg-[#3CCED7] text-white text-sm rounded-md hover:bg-[#2AB5BD] disabled:bg-[#3CCED7] disabled:cursor-not-allowed"
                    data-action
                  >
                    {startingAnalysis
                      ? "Starting Analysis..."
                      : "Start Analysis"}
                  </button>
                  <span className="text-xs text-gray-500">
                    Start the retrospective analysis process
                  </span>
                </div>
              )}

              {/* Campaign (Project) */}
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">
                  Campaign (Project):
                </label>
                <span className="text-sm text-gray-900">
                  {retrospective.campaign_name ||
                    retrospective.campaign ||
                    "Unknown"}
                </span>
              </div>

              {/* Scheduled At */}
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">
                  Scheduled At:
                </label>
                <span className="text-sm text-gray-900">
                  {formatDate(retrospective.scheduled_at)}
                </span>
              </div>

              <div className="space-y-5 rounded-md border border-gray-200 bg-gray-50/40 p-4 relative">
                <h3 className="text-xl font-semibold text-gray-900">
                  Pre-outcome evaluation
                </h3>

                <div className="absolute top-2 right-2 flex flex-wrap items-center gap-2">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-md bg-indigo-600 text-sm text-white hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </>
                  )}
                </div>
                {saveError && (
                  <p className="text-sm text-red-600">{saveError}</p>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Decision *
                  </label>
                  {isEditing ? (
                    <textarea
                      value={preOutcomeDraft.decision}
                      onChange={(e) =>
                        updatePreOutcomeDraft("decision", e.target.value)
                      }
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {retrospective.decision || "Not set"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Confidence Level *
                  </label>
                  {isEditing ? (
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() =>
                            updatePreOutcomeDraft(
                              "confidence_level",
                              level as 1 | 2 | 3 | 4 | 5,
                            )
                          }
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            preOutcomeDraft.confidence_level === level
                              ? "bg-indigo-100 border-indigo-500 text-indigo-700"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {retrospective.confidence_level ?? "Not set"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Primary Assumption *
                  </label>
                  {isEditing ? (
                    <textarea
                      value={preOutcomeDraft.primary_assumption}
                      onChange={(e) =>
                        updatePreOutcomeDraft(
                          "primary_assumption",
                          e.target.value,
                        )
                      }
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {retrospective.primary_assumption || "Not set"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Key Risk Ignored (Optional)
                  </label>
                  {isEditing ? (
                    <textarea
                      value={preOutcomeDraft.key_risk_ignore}
                      onChange={(e) =>
                        updatePreOutcomeDraft("key_risk_ignore", e.target.value)
                      }
                      rows={2}
                      className="w-full px-3 py-2 border rounded-md border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {retrospective.key_risk_ignore || "Not set"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-5 rounded-md border border-gray-200 bg-gray-50/40 p-4 relative">
                <h3 className="text-xl font-semibold text-gray-900">
                  Post-outcome evaluation
                </h3>
                <div className="absolute top-2 right-2 flex flex-wrap items-center gap-2">
                  {!isPostOutcomeEditing ? (
                    <button
                      type="button"
                      onClick={handleStartPostOutcomeEdit}
                      className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelPostOutcome}
                        disabled={isPostOutcomeSaving}
                        className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePostOutcome}
                        disabled={isPostOutcomeSaving}
                        className="px-4 py-2 rounded-md bg-indigo-600 text-sm text-white hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                      >
                        {isPostOutcomeSaving ? "Saving..." : "Save"}
                      </button>
                    </>
                  )}
                </div>

                {postOutcomeSaveError && (
                  <p className="text-sm text-red-600">{postOutcomeSaveError}</p>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Outcome Compared To Expectation
                  </label>
                  {isPostOutcomeEditing ? (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Better", value: "better" as const },
                        { label: "Worse", value: "worse" as const },
                        { label: "As expected", value: "as_expected" as const },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updatePostOutcomeDraft(
                              "outcome_compared_to_expectation",
                              postOutcomeDraft[
                                "outcome_compared_to_expectation"
                              ] === option.value
                                ? ""
                                : option.value,
                            )
                          }
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            postOutcomeDraft.outcome_compared_to_expectation ===
                            option.value
                              ? "bg-indigo-100 border-indigo-500 text-indigo-700"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {retrospective.outcome_compared_to_expectation
                        ? formatStatus(
                            retrospective.outcome_compared_to_expectation,
                          )
                        : "Not set"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Biggest Wrong Assumption
                  </label>
                  {isPostOutcomeEditing ? (
                    <textarea
                      value={postOutcomeDraft.biggest_wrong_assumption}
                      onChange={(e) =>
                        updatePostOutcomeDraft(
                          "biggest_wrong_assumption",
                          e.target.value,
                        )
                      }
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Capture the biggest mistaken assumption"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {retrospective.biggest_wrong_assumption || "Not set"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Would Make Same Decision Again
                  </label>
                  {isPostOutcomeEditing ? (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Yes", value: "yes" as const },
                        { label: "No", value: "no" as const },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updatePostOutcomeDraft(
                              "would_make_same_decision_again",
                              postOutcomeDraft[
                                "would_make_same_decision_again"
                              ] === option.value
                                ? ""
                                : option.value,
                            )
                          }
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            postOutcomeDraft.would_make_same_decision_again ===
                            option.value
                              ? "bg-indigo-100 border-indigo-500 text-indigo-700"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {retrospective.would_make_same_decision_again
                        ? formatStatus(
                            retrospective.would_make_same_decision_again,
                          )
                        : "Not set"}
                    </p>
                  )}
                </div>
              </div>

              {/* Generate Report Button */}
              {retrospective.status === "completed" &&
                !retrospective.report_url && (
                  <div className="flex flex-row items-center gap-3">
                    <button
                      onClick={handleGenerateReport}
                      disabled={generatingReport}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                      data-action
                    >
                      {generatingReport
                        ? "Generating Report..."
                        : "Generate Report"}
                    </button>
                  </div>
                )}

              {/* Report actions (workflow actions, not create fields) */}
              {retrospective.report_url && (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={
                      retrospective.report_url.startsWith("http")
                        ? retrospective.report_url
                        : `http://localhost:8000${retrospective.report_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-md bg-indigo-600 text-sm text-white hover:bg-indigo-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Report
                  </a>
                  {!retrospective.reviewed_by && (
                    <button
                      onClick={handleApproveReport}
                      disabled={approvingReport}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                      data-action
                    >
                      {approvingReport ? "Approving..." : "Approve Report"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
