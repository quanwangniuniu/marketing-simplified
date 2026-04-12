"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { scrollToFirstError, validateDecisionDraft } from "@/components/decisions/decisionValidation";
import Modal from "@/components/ui/Modal";
import SignalsPanel from "@/components/decisions/SignalsPanel";
import DecisionWorkspaceEditor from "@/components/decisions/DecisionWorkspaceEditor";
import DecisionCommitConfirmationModal from "@/components/decisions/DecisionCommitConfirmationModal";
import { DecisionAPI } from "@/lib/api/decisionApi";
import type {
  DecisionDraftResponse,
  DecisionOptionDraft,
  DecisionRiskLevel,
  DecisionSignal,
  DecisionValidationErrorResponse,
} from "@/types/decision";

interface DecisionEditModalProps {
  decisionId: number | null;
  projectId?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const ensureOptions = (options?: DecisionOptionDraft[]) => {
  const base = options && options.length > 0 ? options : [];
  const normalized = base.map((option, index) => ({
    ...option,
    text: option.text || "",
    isSelected: Boolean(option.isSelected),
    order: Number.isFinite(option.order) ? option.order : index,
  }));

  while (normalized.length < 2) {
    normalized.push({
      text: "",
      isSelected: normalized.length === 0,
      order: normalized.length,
    });
  }

  if (!normalized.some((option) => option.isSelected)) {
    normalized[0].isSelected = true;
  }

  return normalized.map((option, index) => ({ ...option, order: index }));
};

const mapFieldErrors = (errorResponse: DecisionValidationErrorResponse) => {
  const fieldErrors = errorResponse?.error?.details?.fieldErrors || [];
  return fieldErrors.reduce<Record<string, string>>((acc, item) => {
    if (item.field) acc[item.field] = item.message;
    return acc;
  }, {});
};

const DecisionEditModal = ({
  decisionId,
  projectId,
  isOpen,
  onClose,
  onSaved,
}: DecisionEditModalProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [commitConfirmations, setCommitConfirmations] = useState<
    Record<string, boolean>
  >({
    alternatives: false,
    risk: false,
    review: false,
  });
  const [commitSignals, setCommitSignals] = useState<DecisionSignal[]>([]);
  const [loadingCommitDetails, setLoadingCommitDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const [title, setTitle] = useState("");
  const [contextSummary, setContextSummary] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [riskLevel, setRiskLevel] = useState<DecisionRiskLevel | "">("");
  const [confidenceScore, setConfidenceScore] = useState<number>(3);
  const [options, setOptions] = useState<DecisionOptionDraft[]>([]);

  const canEdit = useMemo(() => Boolean(decisionId), [decisionId]);

  const syncDraftState = useCallback((draft: DecisionDraftResponse) => {
    setTitle(draft.title || "");
    setContextSummary(draft.contextSummary || "");
    setReasoning(draft.reasoning || "");
    setRiskLevel((draft.riskLevel as DecisionRiskLevel) || "");
    setConfidenceScore(
      typeof draft.confidenceScore === "number" ? draft.confidenceScore : 3,
    );
    setOptions(ensureOptions(draft.options));
    setErrors({});
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !decisionId) return;
    let mounted = true;
    setLoading(true);
    setErrorMessage(null);
    DecisionAPI.getDraft(decisionId, projectId)
      .then((draft) => {
        if (!mounted) return;
        syncDraftState(draft);
      })
      .catch((error) => {
        console.error("Failed to load draft:", error);
        if (mounted) setErrorMessage("Failed to load draft.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, decisionId, projectId, syncDraftState]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setErrors({});
      setCommitModalOpen(false);
      setCommitSignals([]);
      setFocusMode(false);
      setCommitConfirmations({
        alternatives: false,
        risk: false,
        review: false,
      });
    }
  }, [isOpen]);

  const updateField = (field: string, value: any) => {
    setDirty(true);
    if (field === "contextSummary") setContextSummary(value);
    if (field === "reasoning") setReasoning(value);
    if (field === "riskLevel") setRiskLevel(value);
    if (field === "confidenceScore") setConfidenceScore(value);
  };

  const handleOptionsChange = (nextOptions: DecisionOptionDraft[]) => {
    setDirty(true);
    setOptions(nextOptions);
  };

  const buildDraftPayload = useCallback(
    () => ({
      title: title || null,
      contextSummary: contextSummary || null,
      reasoning: reasoning || null,
      riskLevel: riskLevel || null,
      confidenceScore,
      options: options.map((option, index) => ({ ...option, order: index })),
    }),
    [title, contextSummary, reasoning, riskLevel, confidenceScore, options],
  );

  const validateLocal = useCallback(
    (signalCount: number) => validateDecisionDraft(
      { title, contextSummary, reasoning, riskLevel: riskLevel || null, confidenceScore, options },
      signalCount,
    ),
    [confidenceScore, contextSummary, options, reasoning, riskLevel, title],
  );

  const handleSave = async () => {
    if (!decisionId) return;
    setSaving(true);
    setErrorMessage(null);
    setErrors({});
    setFocusMode(false);
    try {
      const draft = await DecisionAPI.patchDraft(
        decisionId,
        buildDraftPayload(),
        projectId,
      );
      syncDraftState(draft);
      onClose();
      onSaved?.();
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 400 && response?.data?.error) {
        const mapped = mapFieldErrors(
          response.data as DecisionValidationErrorResponse,
        );
        setErrors(mapped);
        setErrorMessage(
          "Draft is incomplete. Please address the highlighted fields.",
        );
      } else if (response?.status === 403) {
        setErrorMessage("You do not have permission to edit this draft.");
      } else {
        console.error("Failed to save draft:", error);
        setErrorMessage("Failed to save draft.");
      }
    } finally {
      setSaving(false);
    }
  };

  const validateBeforeCommit = useCallback(async () => {
    if (!decisionId) return { ok: false as const };
    setErrorMessage(null);
    setErrors({});
    setFocusMode(false);
    try {
      // Pull signals first so we can validate them before opening the confirm modal.
      const signalsResponse = await DecisionAPI.listSignals(decisionId, projectId);
      const nextCommitSignals = signalsResponse.items || [];
      setCommitSignals(nextCommitSignals);

      const localErrors = validateLocal(nextCommitSignals.length);
      if (Object.keys(localErrors).length > 0) {
        setErrors(localErrors);
        setErrorMessage("Draft is incomplete. Please address the highlighted fields.");
        setFocusMode(true);
        scrollToFirstError(localErrors);
        return { ok: false as const };
      }

      setSaving(true);
      const syncedDraft = await DecisionAPI.patchDraft(
        decisionId,
        buildDraftPayload(),
        projectId,
      );
      syncDraftState(syncedDraft);
      return { ok: true as const };
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 400 && response?.data?.error) {
        const mapped = mapFieldErrors(
          response.data as DecisionValidationErrorResponse,
        );
        setErrors(mapped);
        setErrorMessage("Draft is incomplete. Please address the highlighted fields.");
        setFocusMode(true);
        scrollToFirstError(mapped);
      } else if (response?.status === 403) {
        setErrorMessage("You do not have permission to commit this decision.");
      } else {
        console.error("Failed to validate draft before commit:", error);
        setErrorMessage("Failed to validate draft before commit.");
      }
      return { ok: false as const };
    } finally {
      setSaving(false);
    }
  }, [buildDraftPayload, decisionId, projectId, syncDraftState, validateLocal]);

  const handleOpenCommitModal = async () => {
    if (!decisionId) return;
    const validation = await validateBeforeCommit();
    if (!validation.ok) return;
    setCommitModalOpen(true);
    setCommitConfirmations({ alternatives: false, risk: false, review: false });
    setLoadingCommitDetails(true);
    try {
      const response = await DecisionAPI.listSignals(decisionId, projectId);
      setCommitSignals(response.items || []);
    } catch (error) {
      console.warn("Failed to load signals for commit modal:", error);
      setCommitSignals([]);
    } finally {
      setLoadingCommitDetails(false);
    }
  };

  const handleCommit = async () => {
    if (!decisionId) return;
    setCommitting(true);
    setErrorMessage(null);
    setErrors({});
    setFocusMode(false);
    try {
      if (dirty) {
        setSaving(true);
        try {
          const syncedDraft = await DecisionAPI.patchDraft(
            decisionId,
            buildDraftPayload(),
            projectId,
          );
          syncDraftState(syncedDraft);
        } catch (syncError: any) {
          const response = syncError?.response;
          if (response?.status === 400 && response?.data?.error) {
            const mapped = mapFieldErrors(
              response.data as DecisionValidationErrorResponse,
            );
            setErrors(mapped);
            setErrorMessage(
              "Draft is incomplete. Please address the highlighted fields.",
            );
            setCommitModalOpen(false);
            setFocusMode(true);
            scrollToFirstError(mapped);
          } else if (response?.status === 403) {
            setErrorMessage("You do not have permission to edit this draft.");
          } else {
            console.error(
              "Failed to sync latest draft before commit:",
              syncError,
            );
            setErrorMessage("Failed to sync latest changes before commit.");
          }
          return null;
        } finally {
          setSaving(false);
        }
      }
      const response = await DecisionAPI.commit(decisionId, projectId);
      setCommitModalOpen(false);
      onClose();
      onSaved?.();
      return response;
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 400 && response?.data?.error) {
        const mapped = mapFieldErrors(
          response.data as DecisionValidationErrorResponse,
        );
        setErrors(mapped);
        setErrorMessage(
          "Draft is incomplete. Please address the highlighted fields.",
        );
        setCommitModalOpen(false);
        setFocusMode(true);
        scrollToFirstError(mapped);
      } else if (response?.status === 403) {
        setErrorMessage("You do not have permission to commit this decision.");
      } else {
        console.error("Commit failed:", error);
        setErrorMessage("Commit failed.");
      }
    } finally {
      setCommitting(false);
    }
    return null;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          {focusMode && (
            <div className="absolute inset-0 bg-black/50 z-[10] pointer-events-none rounded-2xl" aria-hidden="true" />
          )}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Edit Draft
              </div>
              <div className="text-xs text-gray-500">
                Update decision details in place
                {dirty ? " (unsaved changes)" : "."}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto">
            {errorMessage ? (
              <div className="border-b border-amber-100 bg-amber-50 px-6 py-3 text-xs text-amber-700">
                {errorMessage}
              </div>
            ) : null}

            <div
              id="decision-field-title"
              className={`px-6 pt-5 transition-all ${
                focusMode && errors.title
                  ? 'relative z-[20] rounded-lg bg-white p-3 ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700">
                  Title
                </label>
                {errors.title ? (
                  <span className="text-xs font-medium text-red-500">{errors.title}</span>
                ) : null}
              </div>
              <input
                type="text"
                value={title}
                onChange={(event) => {
                  setDirty(true);
                  setTitle(event.target.value);
                }}
                placeholder="Draft title"
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex min-h-[520px] flex-col gap-4 px-4 pb-6 lg:flex-row">
              <div className="h-full w-full max-w-full lg:w-[32%] lg:min-w-[240px] lg:max-w-[320px]">
                <div
                  id="decision-field-signals"
                  className={`transition-all ${
                    focusMode && errors.signals
                      ? 'relative z-[20] rounded-lg bg-white ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
                      : ''
                  }`}
                >
                  {decisionId ? (
                    <SignalsPanel
                      decisionId={decisionId}
                      projectId={projectId}
                      mode="edit"
                    />
                  ) : null}
                </div>
              </div>
              <div className={`h-full w-full flex-1 min-w-0 bg-gray-50 ${focusMode ? 'relative z-[20]' : ''}`}>
                <DecisionWorkspaceEditor
                  contextSummary={contextSummary}
                  reasoning={reasoning}
                  riskLevel={riskLevel}
                  confidenceScore={confidenceScore}
                  options={options}
                  errors={errors}
                  onChange={updateField}
                  onOptionsChange={handleOptionsChange}
                  focusMode={focusMode}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <div className="text-xs text-gray-400">
              {loading
                ? "Loading draft…"
                : canEdit
                ? "Draft ready"
                : "No draft selected"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenCommitModal}
                disabled={!canEdit || loading || saving || committing}
                className={`rounded-md px-4 py-2 text-xs font-semibold ${
                  !canEdit || loading || saving || committing
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                Commit
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || loading || saving}
                className={`rounded-md px-4 py-2 text-xs font-semibold text-white ${
                  !canEdit || loading || saving
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <DecisionCommitConfirmationModal
        isOpen={commitModalOpen}
        onClose={() => setCommitModalOpen(false)}
        onConfirm={handleCommit}
        loading={loadingCommitDetails}
        signals={commitSignals}
        contextSummary={contextSummary}
        reasoning={reasoning}
        options={options}
        riskLevel={riskLevel}
        confidenceScore={confidenceScore}
        confirmations={commitConfirmations}
        onToggleConfirmation={(key) =>
          setCommitConfirmations((prev) => ({ ...prev, [key]: !prev[key] }))
        }
        confirming={committing}
      />
    </>
  );
};

export default DecisionEditModal;
