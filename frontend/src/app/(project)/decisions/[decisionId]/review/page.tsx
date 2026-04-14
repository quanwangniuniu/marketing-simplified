'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DecisionWorkbenchHeader from '@/components/decisions/DecisionWorkbenchHeader';
import SignalsPanel from '@/components/decisions/SignalsPanel';
import DecisionExecutionSummaryPanel from '@/components/decisions/DecisionExecutionSummaryPanel';
import DecisionReviewPanel from '@/components/decisions/DecisionReviewPanel';
import { OriginMeetingBlock } from '@/components/meetings/OriginMeetingBlock';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { ProjectAPI } from '@/lib/api/projectApi';
import type { DecisionCommittedResponse, DecisionOptionDraft, DecisionStatus } from '@/types/decision';

const statusColor = (status: string) => {
  switch (status) {
    case 'AWAITING_APPROVAL':
      return 'bg-blue-100 text-blue-800';
    case 'COMMITTED':
      return 'bg-emerald-100 text-emerald-800';
    case 'REVIEWED':
      return 'bg-purple-100 text-purple-800';
    case 'ARCHIVED':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const DecisionReviewPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const decisionId = Number(params?.decisionId);
  const projectId = searchParams.get('project_id');
  const projectIdValue = projectId ? Number(projectId) : null;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DecisionStatus | null>(null);
  const [decision, setDecision] = useState<DecisionCommittedResponse | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const projectLabel = useMemo(() => {
    if (projectName) return projectName;
    if (projectIdValue) return `Project ${projectIdValue}`;
    return 'Project';
  }, [projectIdValue, projectName]);

  const fetchDecision = useCallback(async () => {
    if (!decisionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const committed = await DecisionAPI.getDecision(decisionId, projectIdValue);
      setDecision(committed);
      setStatus(committed.status);
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 409) {
        toast.error('Decision is not committed yet.');
      } else {
        toast.error('Failed to load decision.');
      }
      console.error('Failed to load decision:', error);
    } finally {
      setLoading(false);
    }
  }, [decisionId, projectIdValue]);

  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  useEffect(() => {
    const loadProjectName = async () => {
      if (!projectIdValue) return;
      try {
        const project = await ProjectAPI.getProject(projectIdValue);
        setProjectName(project?.name || null);
      } catch (error) {
        console.warn('Failed to load project name:', error);
      }
    };
    loadProjectName();
  }, [projectIdValue]);

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

  if (!decision) {
    return (
      <Layout>
        <ProtectedRoute>
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-gray-500">Decision not available.</div>
          </div>
        </ProtectedRoute>
      </Layout>
    );
  }

  const options = (decision.options || []) as DecisionOptionDraft[];
  const selectedOption = options.find((option) => option.isSelected);

  return (
    <Layout>
      <ProtectedRoute>
        <div className="flex h-full flex-col bg-gray-50">
          <DecisionWorkbenchHeader
            projectLabel={projectLabel}
            status={status || '—'}
            title={decision.title || 'Untitled decision'}
            dirty={false}
            lastSavedAt={decision.committedAt || null}
            saving={false}
            committing={false}
            onTitleChange={() => null}
            onSave={() => null}
            onCommit={() => null}
            mode="readOnly"
            onBack={() => router.push('/decisions')}
          />
          <div className="flex flex-1 min-h-0">
            <div className="h-full w-[22%] min-w-[220px] max-w-[320px]">
              <SignalsPanel decisionId={decision.id} projectId={projectIdValue} mode="readOnly" />
            </div>
            <div className="h-full flex-1 min-w-0 bg-gray-50">
              <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6">
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(
                        decision.status
                      )}`}
                    >
                      {decision.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {decision.title || 'Untitled decision'}
                  </h2>
                </section>

                <div data-testid="decision-origin-meeting">
                  <OriginMeetingBlock origin={decision.origin_meeting ?? null} />
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Context Summary</h3>
                  <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                    {decision.contextSummary || '—'}
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Options</h3>
                  <div className="space-y-2">
                    {options.length > 0 ? (
                      options.map((option, index) => {
                        const isSelected = option.isSelected;
                        return (
                          <div
                            key={`opt-${index}`}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                              isSelected
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div
                              className={`h-2 w-2 rounded-full ${
                                isSelected ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                            />
                            <span className="text-gray-800">
                              {option.text || `Option ${index + 1}`}
                            </span>
                            {isSelected ? (
                              <span className="ml-auto text-xs font-semibold text-emerald-600">
                                Selected
                              </span>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-sm text-gray-500">
                        No options recorded.
                      </div>
                    )}
                  </div>
                  {selectedOption ? null : (
                    <p className="text-xs text-gray-400">No selected option.</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Reasoning</h3>
                  <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                    {decision.reasoning || '—'}
                  </p>
                </section>

                <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">Risk Level</h3>
                    <p className="text-sm text-gray-700">{decision.riskLevel || '—'}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">Confidence</h3>
                    <p className="text-sm text-gray-700">
                      {decision.confidenceScore ?? '—'}
                    </p>
                  </div>
                </section>
              </div>
            </div>
            <div className="h-full w-[22%] min-w-[220px] max-w-[300px]">
              <DecisionExecutionSummaryPanel
                decisionId={decision.id}
                projectId={projectIdValue}
              />
            </div>
            <div className="h-full w-[24%] min-w-[260px] max-w-[360px]">
              <DecisionReviewPanel
                decisionId={decision.id}
                projectId={projectIdValue}
                status={status}
                mode={status === 'REVIEWED' ? 'readOnly' : 'edit'}
                onReviewed={(nextStatus) => setStatus(nextStatus)}
              />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    </Layout>
  );
};

export default DecisionReviewPage;
