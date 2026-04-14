'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DecisionWorkbenchHeader from '@/components/decisions/DecisionWorkbenchHeader';
import SignalsPanel from '@/components/decisions/SignalsPanel';
import DecisionWorkspaceEditor from '@/components/decisions/DecisionWorkspaceEditor';
import DecisionDetailView from '@/components/decisions/DecisionDetailView';
import DecisionCommitConfirmationModal from '@/components/decisions/DecisionCommitConfirmationModal';
import DecisionApproveConfirmationModal from '@/components/decisions/DecisionApproveConfirmationModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { OriginMeetingBlock } from '@/components/meetings/OriginMeetingBlock';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { ProjectAPI } from '@/lib/api/projectApi';
import { scrollToFirstError, validateDecisionDraft } from '@/components/decisions/decisionValidation';
import type { OriginMeetingPayload } from '@/types/meeting';
import type {
  DecisionDraftResponse,
  DecisionOptionDraft,
  DecisionRiskLevel,
  DecisionSignal,
  DecisionStatus,
  DecisionValidationErrorResponse,
} from '@/types/decision';

const ensureOptions = (options?: DecisionOptionDraft[]) => {
  const base = options && options.length > 0 ? options : [];
  const normalized = base.map((option, index) => ({
    ...option,
    text: option.text || '',
    isSelected: Boolean(option.isSelected),
    order: Number.isFinite(option.order) ? option.order : index,
  }));

  while (normalized.length < 2) {
    normalized.push({
      text: '',
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

const DecisionPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const decisionId = Number(params?.decisionId);
  const projectId = searchParams.get('project_id');
  const projectIdValue = projectId ? Number(projectId) : null;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DecisionStatus | null>(null);
  const [title, setTitle] = useState('');
  const [contextSummary, setContextSummary] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [riskLevel, setRiskLevel] = useState<DecisionRiskLevel | ''>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(3);
  const [options, setOptions] = useState<DecisionOptionDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveConfirmations, setApproveConfirmations] = useState<Record<string, boolean>>({
    reviewed: false,
    ready: false,
    accountable: false,
  });
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [commitConfirmations, setCommitConfirmations] = useState<Record<string, boolean>>({
    alternatives: false,
    risk: false,
    review: false,
  });
  const [commitSignals, setCommitSignals] = useState<DecisionSignal[]>([]);
  const [loadingCommitDetails, setLoadingCommitDetails] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusMode, setFocusMode] = useState(false);
  const [committedSnapshot, setCommittedSnapshot] = useState<any>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectSeq, setProjectSeq] = useState<number | null>(null);
  const [originMeeting, setOriginMeeting] = useState<OriginMeetingPayload | null>(null);

  const isDraft = status === 'DRAFT';
  const incompleteToastId = 'decision-draft-incomplete';

  const projectLabel = useMemo(() => {
    if (projectName) return projectName;
    if (projectIdValue) return `Project ${projectIdValue}`;
    return 'Project';
  }, [projectIdValue, projectName]);

  const syncDraftState = useCallback((draft: DecisionDraftResponse) => {
    setTitle(draft.title || '');
    setContextSummary(draft.contextSummary || '');
    setReasoning(draft.reasoning || '');
    setRiskLevel(draft.riskLevel || '');
    setConfidenceScore(
      typeof draft.confidenceScore === 'number' ? draft.confidenceScore : 3
    );
    setProjectSeq(typeof draft.projectSeq === 'number' ? draft.projectSeq : null);
    setOptions(ensureOptions(draft.options));
    setLastSavedAt(draft.lastEditedAt || draft.createdAt || null);
    setOriginMeeting(draft.origin_meeting ?? null);
    setDirty(false);
  }, []);

  const fetchDecision = useCallback(async () => {
    if (!decisionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      try {
        const committed = await DecisionAPI.getDecision(decisionId, projectIdValue);
        setStatus(committed.status);
        setCommittedSnapshot(committed);
        setProjectSeq(typeof committed.projectSeq === 'number' ? committed.projectSeq : null);
        setOriginMeeting(null);
        setLoading(false);
        return;
      } catch (error: any) {
        const response = error?.response;
        if (response?.status === 409) {
          const currentStatus = response?.data?.details?.currentStatus as DecisionStatus;
          if (currentStatus) {
            setStatus(currentStatus);
            if (currentStatus === 'AWAITING_APPROVAL') {
              const draft = await DecisionAPI.getDraft(decisionId, projectIdValue);
              setCommittedSnapshot({
                id: decisionId,
                status: currentStatus,
                title: draft.title || '',
                contextSummary: draft.contextSummary || '',
                reasoning: draft.reasoning || '',
                riskLevel: draft.riskLevel || null,
                confidenceScore: draft.confidenceScore ?? null,
                options: draft.options || [],
                signals: draft.signals || [],
                projectSeq: draft.projectSeq ?? null,
                origin_meeting: draft.origin_meeting ?? null,
              });
              setProjectSeq(
                typeof draft.projectSeq === 'number' ? draft.projectSeq : null
              );
              setOriginMeeting(draft.origin_meeting ?? null);
              setLoading(false);
              return;
            }
          }
        } else {
          throw error;
        }
      }

      const draft = await DecisionAPI.getDraft(decisionId, projectIdValue);
      setStatus((prev) => prev || 'DRAFT');
      syncDraftState(draft);
    } catch (error: any) {
      console.error('Failed to load decision:', error);
      toast.error('Failed to load decision.');
    } finally {
      setLoading(false);
    }
  }, [decisionId, projectIdValue, syncDraftState]);

  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  useEffect(() => {
    let mounted = true;
    const loadProjectName = async () => {
      if (!projectIdValue) return;
      try {
        const project = await ProjectAPI.getProject(projectIdValue);
        if (mounted) {
          setProjectName(project?.name || null);
        }
      } catch (error) {
        console.warn('Failed to load project name:', error);
      }
    };
    loadProjectName();
    return () => {
      mounted = false;
    };
  }, [projectIdValue]);

  const updateField = (field: string, value: any) => {
    setDirty(true);
    if (field === 'contextSummary') setContextSummary(value);
    if (field === 'reasoning') setReasoning(value);
    if (field === 'riskLevel') setRiskLevel(value);
    if (field === 'confidenceScore') setConfidenceScore(value);
  };

  const handleOptionsChange = (nextOptions: DecisionOptionDraft[]) => {
    setOptions(nextOptions);
    setDirty(true);
  };

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    setDirty(true);
  };

  const buildDraftPayload = useCallback(
    () => ({
      title: title || null,
      contextSummary: contextSummary || null,
      reasoning: reasoning || null,
      riskLevel: riskLevel || null,
      confidenceScore: confidenceScore,
      options: options.map((option, index) => ({
        ...option,
        order: index,
      })),
    }),
    [title, contextSummary, reasoning, riskLevel, confidenceScore, options]
  );

  const validateLocal = useCallback(
    (signalCount: number) => validateDecisionDraft(
      { title, contextSummary, reasoning, riskLevel: riskLevel || null, confidenceScore, options },
      signalCount,
    ),
    [confidenceScore, contextSummary, options, reasoning, riskLevel, title]
  );

  const validateBeforeCommit = useCallback(async () => {
    if (!decisionId) return false;
    try {
      setErrors({});
      setFocusMode(false);

      // Pull signals first so we can validate them before opening the confirm modal.
      const signalsResponse = await DecisionAPI.listSignals(decisionId, projectIdValue);
      const nextCommitSignals = signalsResponse.items || [];
      setCommitSignals(nextCommitSignals);

      const localErrors = validateLocal(nextCommitSignals.length);
      if (Object.keys(localErrors).length > 0) {
        setErrors(localErrors);
        setFocusMode(true);
        scrollToFirstError(localErrors);
        toast.error('Draft is incomplete. Please address the highlighted fields.', {
          id: incompleteToastId,
        });
        return false;
      }

      // Sync latest edits (best-effort) so the confirm modal reflects what will be committed.
      setSaving(true);
      const syncedDraft = await DecisionAPI.patchDraft(decisionId, buildDraftPayload(), projectIdValue);
      syncDraftState(syncedDraft);
      return true;
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 400 && response?.data?.error) {
        const mapped = mapFieldErrors(response.data as DecisionValidationErrorResponse);
        setErrors(mapped);
        setFocusMode(true);
        scrollToFirstError(mapped);
        toast.error('Draft is incomplete. Please address the highlighted fields.', { id: incompleteToastId });
      } else if (response?.status === 403) {
        toast.error('You do not have permission to commit this decision.', { id: incompleteToastId });
      } else {
        console.error('Failed to validate draft before commit:', error);
        toast.error('Failed to validate draft before commit.', { id: incompleteToastId });
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [buildDraftPayload, decisionId, incompleteToastId, projectIdValue, syncDraftState, validateLocal]);

  const handleSaveDraft = async () => {
    if (!decisionId) return;
    setSaving(true);
    setErrors({});
    setFocusMode(false);
    try {
      const draft = await DecisionAPI.patchDraft(decisionId, buildDraftPayload(), projectIdValue);
      syncDraftState(draft);
      toast.success('Draft saved.');
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      toast.error('Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleTitleSave = async (nextTitle: string) => {
    if (!decisionId) return;
    setSaving(true);
    try {
      const draft = await DecisionAPI.patchDraft(
        decisionId,
        { title: nextTitle || null },
        projectIdValue
      );
      setTitle(draft.title || '');
      setLastSavedAt(draft.lastEditedAt || draft.createdAt || null);
      setOriginMeeting(draft.origin_meeting ?? null);
      setDirty((prev) => prev || false);
    } catch (error) {
      console.error('Failed to save title:', error);
      toast.error('Failed to save title.');
    } finally {
      setSaving(false);
    }
  };

  const handleCommit = async () => {
    if (!decisionId) return false;
    setCommitting(true);
    setErrors({});
    setFocusMode(false);
    try {
      if (dirty) {
        setSaving(true);
        try {
          const syncedDraft = await DecisionAPI.patchDraft(
            decisionId,
            buildDraftPayload(),
            projectIdValue
          );
          syncDraftState(syncedDraft);
        } catch (syncError) {
          console.error('Failed to sync latest draft before commit:', syncError);
          toast.error('Failed to sync latest changes before commit.');
          return false;
        } finally {
          setSaving(false);
        }
      }

      const response = await DecisionAPI.commit(decisionId, projectIdValue);
      setStatus(response.status);
      setCommittedSnapshot(response.decision);
      setOriginMeeting(null);
      setDirty(false);
      toast.success(response.detail || 'Decision committed.');
      return true;
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 400 && response?.data?.error) {
        const mapped = mapFieldErrors(response.data as DecisionValidationErrorResponse);
        setErrors(mapped);
        setCommitModalOpen(false);
        setFocusMode(true);
        scrollToFirstError(mapped);
        toast.error('Draft is incomplete. Please address the highlighted fields.', {
          id: incompleteToastId,
        });
      } else if (response?.status === 403) {
        toast.error('You do not have permission to commit this decision.', { id: incompleteToastId });
      } else {
        console.error('Commit failed:', error);
        toast.error('Commit failed.', { id: incompleteToastId });
      }
      return false;
    } finally {
      setCommitting(false);
    }
  };

  const handleOpenCommitModal = async () => {
    if (!decisionId) return;
    const ok = await validateBeforeCommit();
    if (!ok) return;
    setCommitModalOpen(true);
    setCommitConfirmations({ alternatives: false, risk: false, review: false });
    // commitSignals already populated during validateBeforeCommit.
    setLoadingCommitDetails(false);
  };

  const handleConfirmCommit = async () => {
    const committed = await handleCommit();
    if (committed) {
      setCommitModalOpen(false);
    }
  };

  const handleApprove = async () => {
    if (!decisionId) return;
    setApproving(true);
    try {
      const response = await DecisionAPI.approve(decisionId, projectIdValue);
      setStatus(response.status);
      setCommittedSnapshot(response.decision);
      setOriginMeeting(null);
      toast.success(response.detail || 'Decision approved.');
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 403) {
        toast.error('You do not have permission to approve this decision.');
      } else if (response?.status === 409) {
        toast.error('Decision is not awaiting approval.');
      } else {
        console.error('Approve failed:', error);
        toast.error('Approve failed.');
      }
    } finally {
      setApproving(false);
    }
  };

  const handleOpenApproveModal = () => {
    setApproveConfirmations({ reviewed: false, ready: false, accountable: false });
    setApproveModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    await handleApprove();
    setApproveModalOpen(false);
  };

  const handleDelete = () => {
    if (!decisionId) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!decisionId || projectIdValue == null) return;
    setDeleting(true);
    try {
      await DecisionAPI.deleteDecision(decisionId, projectIdValue);
      toast.success('Decision deleted.');
      setDeleteConfirmOpen(false);
      router.push('/decisions');
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 401) {
        toast.error('Authentication required. Please log in again.');
      } else if (response?.status === 403) {
        toast.error('You do not have permission to delete this decision.');
      } else if (response?.status === 404) {
        toast.error('Decision not found.');
      } else {
        console.error('Delete failed:', error);
        toast.error('Failed to delete decision.');
      }
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <Layout>
        <ProtectedRoute>
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-gray-500">Loading decision...</div>
          </div>
        </ProtectedRoute>
      </Layout>
    );
  }

  if (!status || !isDraft) {
    return (
      <Layout>
        <ProtectedRoute>
          <div className="flex h-full flex-col bg-gray-50">
          <DecisionWorkbenchHeader
            projectLabel={projectLabel}
            status={status || '—'}
            title={committedSnapshot?.title || 'Untitled decision'}
            dirty={false}
            lastSavedAt={committedSnapshot?.committedAt || null}
            saving={false}
            committing={false}
            deleting={deleting}
            onTitleChange={() => null}
            onSave={() => null}
            onCommit={() => null}
            onDelete={handleDelete}
            mode="readOnly"
            onBack={() => router.push('/decisions')}
          />
            {committedSnapshot ? (
              <>
                <DecisionDetailView
                  decision={committedSnapshot}
                  projectId={projectIdValue}
                  onApprove={handleApprove}
                  onApproveRequest={handleOpenApproveModal}
                  approving={approving}
                />
                <DecisionApproveConfirmationModal
                  isOpen={approveModalOpen}
                  onClose={() => setApproveModalOpen(false)}
                  onConfirm={handleConfirmApprove}
                  decision={committedSnapshot}
                  confirmations={approveConfirmations}
                  onToggleConfirmation={(key) =>
                    setApproveConfirmations((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  confirming={approving}
                />
                <ConfirmModal
                  isOpen={deleteConfirmOpen}
                  onClose={() => setDeleteConfirmOpen(false)}
                  onConfirm={confirmDelete}
                  title="Delete decision"
                  message={`Are you sure you want to delete decision "${title || committedSnapshot?.title || 'Untitled'}"? This action cannot be undone.`}
                  confirmText="Delete"
                  cancelText="Cancel"
                  type="danger"
                  loading={deleting}
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-sm text-gray-500">Decision not available.</div>
              </div>
            )}
          </div>
        </ProtectedRoute>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProtectedRoute>
        <div className="flex h-full flex-col bg-gray-50 relative">
          <DecisionWorkbenchHeader
            projectLabel={projectLabel}
            status={status}
            title={title}
            dirty={dirty}
            lastSavedAt={lastSavedAt}
            saving={saving}
            committing={committing}
            deleting={deleting}
            onTitleChange={handleTitleChange}
            onTitleSave={handleTitleSave}
            onSave={handleSaveDraft}
            onCommit={handleOpenCommitModal}
            onDelete={handleDelete}
            onBack={() => router.push('/decisions')}
            titleError={errors.title}
            focusMode={focusMode}
          />
          <div className="relative flex min-h-0 flex-1">
            {focusMode && (
              <div
                className="pointer-events-none absolute inset-0 z-[10] bg-black/50"
                aria-hidden="true"
              />
            )}
            <div className="relative z-[11] flex min-h-0 flex-1">
            <div
              id="decision-field-signals"
              className={`h-full w-[24%] min-w-[240px] max-w-[340px] transition-all ${
                focusMode && errors.signals
                  ? 'relative z-[20] rounded-lg bg-white ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
                  : ''
              }`}
            >
              <SignalsPanel decisionId={decisionId} projectId={projectIdValue} mode="edit" />
            </div>
            <div className={`h-full flex-1 min-w-0 bg-gray-50 ${focusMode ? 'relative z-[20]' : ''}`}>
              <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto px-6 py-6">
                <div data-testid="decision-draft-origin-meeting">
                  <OriginMeetingBlock origin={originMeeting} />
                </div>
                <div className="min-h-0 flex-1">
                  <DecisionWorkspaceEditor
                    contextSummary={contextSummary}
                    reasoning={reasoning}
                    riskLevel={riskLevel as any}
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
            </div>
          </div>
        </div>
        <DecisionCommitConfirmationModal
          isOpen={commitModalOpen}
          onClose={() => setCommitModalOpen(false)}
          onConfirm={handleConfirmCommit}
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
        <DecisionApproveConfirmationModal
          isOpen={approveModalOpen}
          onClose={() => setApproveModalOpen(false)}
          onConfirm={handleConfirmApprove}
          decision={committedSnapshot}
          confirmations={approveConfirmations}
          onToggleConfirmation={(key) =>
            setApproveConfirmations((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          confirming={approving}
        />
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={confirmDelete}
          title="Delete decision"
          message={`Are you sure you want to delete decision "${title || committedSnapshot?.title || 'Untitled'}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          loading={deleting}
        />
      </ProtectedRoute>
    </Layout>
  );
};

export default DecisionPage;
