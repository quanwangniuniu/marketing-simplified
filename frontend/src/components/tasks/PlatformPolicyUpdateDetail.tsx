'use client';

import { useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion";
import { PlatformPolicyUpdateData, PolicyAPI } from "@/lib/api/policyApi";

interface PlatformPolicyUpdateDetailProps {
  policyUpdate?: PlatformPolicyUpdateData;
  loading?: boolean;
  compact?: boolean;
  onRefresh?: () => void;
}

export default function PlatformPolicyUpdateDetail({
  policyUpdate,
  loading,
  compact = false,
  onRefresh,
}: PlatformPolicyUpdateDetailProps) {
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  const getMitigationStatusColor = (status?: string) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-800';
      case 'planning':
        return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'reviewed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'Unknown';
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderArrayAsBadges = (items?: string[]) => {
    if (!items || items.length === 0) return <span className="text-sm text-gray-500">None</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, idx) => (
          <span key={idx} className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
            {item}
          </span>
        ))}
      </div>
    );
  };

  const handleMarkMitigationCompleted = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!policyUpdate?.id) return;
    try {
      setMarkingCompleted(true);
      await PolicyAPI.markMitigationCompleted(policyUpdate.id);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to mark mitigation completed';
      alert(msg);
    } finally {
      setMarkingCompleted(false);
    }
  };

  const handleMarkReviewed = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!policyUpdate?.id) return;
    try {
      setMarkingReviewed(true);
      await PolicyAPI.markReviewed(policyUpdate.id);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to mark as reviewed';
      alert(msg);
    } finally {
      setMarkingReviewed(false);
    }
  };

  // Compact mode for TaskCard preview
  if (compact) {
    if (loading) {
      return (
        <div className="mt-3 pt-3 border-t border-gray-100" data-action>
          <div className="text-xs text-gray-500">Loading policy update metadata...</div>
        </div>
      );
    }
    if (!policyUpdate) return null;
    return (
      <div className="mt-3 pt-3 border-t border-gray-100" data-action>
        <div className="flex flex-col text-xs mb-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Platform:</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              {formatStatus(policyUpdate.platform)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Change Type:</span>
            <span className="px-2 py-0.5 rounded-full bg-[#3CCED7]/15 text-[#1a9ba3]">
              {formatStatus(policyUpdate.policy_change_type)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Mitigation:</span>
            <span className={`px-2 py-0.5 rounded-full ${getMitigationStatusColor(policyUpdate.mitigation_status)}`}>
              {formatStatus(policyUpdate.mitigation_status)}
            </span>
          </div>
          {policyUpdate.effective_date && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600">Effective:</span>
              <span className="text-gray-900">{policyUpdate.effective_date}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mode - loading state
  if (loading) {
    return (
      <section>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading details...</p>
        </div>
      </section>
    );
  }

  // Full mode - empty state
  if (!policyUpdate) {
    return (
      <section>
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">No platform policy update details found.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Accordion type="multiple" defaultValue={["policy-info", "mitigation"]}>
        {/* 1. Policy Information */}
        <AccordionItem value="policy-info" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Policy Information</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Platform</label>
                <span className="inline-block px-2 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                  {formatStatus(policyUpdate.platform)}
                </span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Change Type</label>
                <span className="inline-block px-2 py-1 text-sm font-medium rounded-full bg-[#3CCED7]/15 text-[#1a9ba3]">
                  {formatStatus(policyUpdate.policy_change_type)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Policy Description</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.policy_description}</p>
              </div>
              {policyUpdate.policy_reference_url && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Reference URL</label>
                  <a
                    href={policyUpdate.policy_reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline break-all"
                  >
                    {policyUpdate.policy_reference_url}
                  </a>
                </div>
              )}
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Effective Date</label>
                <span className="text-sm text-gray-900">{policyUpdate.effective_date || 'Not set'}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Affected Scope */}
        <AccordionItem value="affected-scope" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Affected Scope</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Affected Campaigns</label>
                {renderArrayAsBadges(policyUpdate.affected_campaigns)}
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Affected Ad Sets</label>
                {renderArrayAsBadges(policyUpdate.affected_ad_sets)}
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Affected Assets</label>
                {renderArrayAsBadges(policyUpdate.affected_assets)}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Impact Assessment */}
        <AccordionItem value="impact" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Impact Assessment</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Performance Impact</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.performance_impact || 'Not specified'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Budget Impact</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.budget_impact || 'Not specified'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Compliance Risk</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.compliance_risk || 'Not specified'}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Immediate Actions */}
        <AccordionItem value="actions" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Immediate Actions</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Immediate Actions Required</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.immediate_actions_required}</p>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Action Deadline</label>
                <span className="text-sm text-gray-900">{policyUpdate.action_deadline || 'Not set'}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Mitigation Tracking */}
        <AccordionItem value="mitigation" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Mitigation Tracking</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Mitigation Status</label>
                <span className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${getMitigationStatusColor(policyUpdate.mitigation_status)}`}>
                  {formatStatus(policyUpdate.mitigation_status)}
                </span>
              </div>

              {policyUpdate.mitigation_plan && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Mitigation Plan</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.mitigation_plan}</p>
                </div>
              )}

              {policyUpdate.mitigation_steps && Array.isArray(policyUpdate.mitigation_steps) && policyUpdate.mitigation_steps.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Mitigation Steps</label>
                  <div className="space-y-2">
                    {policyUpdate.mitigation_steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 flex-shrink-0 ${step.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                          {step.status === 'completed' ? '\u2713' : '\u25CB'}
                        </span>
                        <div>
                          <span className="text-gray-900">{step.step}</span>
                          <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                            step.status === 'completed' ? 'bg-green-100 text-green-700' :
                            step.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {step.status}
                          </span>
                          {step.completed_at && (
                            <span className="ml-2 text-xs text-gray-500">{formatDate(step.completed_at)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {policyUpdate.mitigation_execution_notes && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Execution Notes</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.mitigation_execution_notes}</p>
                </div>
              )}

              {policyUpdate.mitigation_completed_at && (
                <div className="flex flex-row items-center gap-3">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Mitigation Completed At</label>
                  <span className="text-sm text-gray-900">{formatDate(policyUpdate.mitigation_completed_at)}</span>
                </div>
              )}

              {policyUpdate.mitigation_results && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Mitigation Results</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.mitigation_results}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleMarkMitigationCompleted}
                  disabled={markingCompleted || policyUpdate.mitigation_status === 'completed' || policyUpdate.mitigation_status === 'reviewed'}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
                >
                  {markingCompleted ? 'Marking...' : 'Mark Mitigation Completed'}
                </button>
                <button
                  onClick={handleMarkReviewed}
                  disabled={markingReviewed || policyUpdate.mitigation_status !== 'completed'}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
                >
                  {markingReviewed ? 'Marking...' : 'Mark Reviewed'}
                </button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Post-Mitigation Review */}
        <AccordionItem value="review" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Post-Mitigation Review</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Reviewed By</label>
                <span className="text-sm text-gray-900">{policyUpdate.reviewed_by?.username || 'Not reviewed'}</span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Review Completed At</label>
                <span className="text-sm text-gray-900">{formatDate(policyUpdate.review_completed_at)}</span>
              </div>
              {policyUpdate.post_mitigation_review && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Post-Mitigation Review Notes</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.post_mitigation_review}</p>
                </div>
              )}
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">All Impacts Addressed</label>
                <span className="text-sm text-gray-900">{policyUpdate.all_impacts_addressed ? 'Yes' : 'No'}</span>
              </div>
              {policyUpdate.lessons_learned && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Lessons Learned</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.lessons_learned}</p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 7. Metadata */}
        <AccordionItem value="metadata" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Metadata</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Created By</label>
                <span className="text-sm text-gray-900">{policyUpdate.created_by?.username || 'Unknown'}</span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Assigned To</label>
                <span className="text-sm text-gray-900">{policyUpdate.assigned_to?.username || 'Unassigned'}</span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Created At</label>
                <span className="text-sm text-gray-900">{formatDate(policyUpdate.created_at)}</span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Last Updated</label>
                <span className="text-sm text-gray-900">{formatDate(policyUpdate.updated_at)}</span>
              </div>
              {policyUpdate.notes && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Notes</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{policyUpdate.notes}</p>
                </div>
              )}
              {policyUpdate.related_references && policyUpdate.related_references.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Related References</label>
                  {renderArrayAsBadges(policyUpdate.related_references)}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
