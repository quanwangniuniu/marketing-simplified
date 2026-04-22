"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { OriginMeetingBlock } from "@/components/meetings/OriginMeetingBlock";
import SignalsPanel from "@/components/decisions/SignalsPanel";
import DecisionReviewPanel from "@/components/decisions/DecisionReviewPanel";
import TaskPanel from "@/components/decisions/TaskPanel";
import type {
  DecisionCommittedResponse,
  DecisionOptionDraft,
} from "@/types/decision";

const statusColor = (status: string) => {
  switch (status) {
    case "AWAITING_APPROVAL":
      return "bg-[#3CCED7]/15 text-[#1a9ba3]";
    case "COMMITTED":
      return "bg-emerald-100 text-emerald-800";
    case "REVIEWED":
      return "bg-purple-100 text-purple-800";
    case "ARCHIVED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

interface DecisionDetailViewProps {
  decision: DecisionCommittedResponse;
  projectId?: number | null;
  onApprove?: () => void;
  onApproveRequest?: () => void;
  approving?: boolean;
}

const DecisionDetailView = ({
  decision,
  projectId,
  onApprove,
  onApproveRequest,
  approving = false,
}: DecisionDetailViewProps) => {
  const router = useRouter();
  const options = (decision.options || []) as DecisionOptionDraft[];
  const selectedOption = options.find((option) => option.isSelected);
  const decisionLink = projectId
    ? `/decisions/${decision.id}?project_id=${projectId}`
    : `/decisions/${decision.id}`;

  /** Navigate to the Agent page and open the existing session that created this decision. */
  const handleOpenAgentSession = () => {
    if (decision.agentSessionId) {
      sessionStorage.setItem("agent-session-id", decision.agentSessionId);
    }
    router.push("/agent");
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {decision.status === "AWAITING_APPROVAL" ? (
        <div className="border-b border-[#3CCED7]/20 bg-[#3CCED7]/10 px-6 py-3 text-sm text-[#1a9ba3]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold">Pending approval.</span> This
              decision was submitted and is waiting for approval.
            </div>
            {onApprove ? (
              <button
                type="button"
                onClick={onApproveRequest || onApprove}
                disabled={approving}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  approving
                    ? "cursor-not-allowed bg-[#3CCED7]/15 text-[#3CCED7]"
                    : "bg-[#3CCED7] text-white hover:bg-[#2AB5BD]"
                }`}
              >
                {approving ? "Approving..." : "Approve"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-1 min-h-0">
        <div className="h-full w-[24%] min-w-[240px] max-w-[340px]">
          <SignalsPanel
            decisionId={decision.id}
            projectId={projectId}
            mode="readOnly"
          />
        </div>
        <div className="h-full flex-1 min-w-0 bg-gray-50">
          <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(
                      decision.status,
                    )}`}
                  >
                    {decision.status}
                  </span>
                  {decision.createdByAgent ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      Created by Agent
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {decision.createdByAgent && decision.agentSessionId ? (
                    <button
                      type="button"
                      onClick={handleOpenAgentSession}
                      className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                    >
                      Open Agent Session
                    </button>
                  ) : null}
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {decision.title || "Untitled decision"}
              </h2>
            </section>

            <div data-testid="decision-origin-meeting">
              <OriginMeetingBlock origin={decision.origin_meeting ?? null} />
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Context Summary
              </h3>
              <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                {decision.contextSummary || "—"}
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
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            isSelected ? "bg-emerald-500" : "bg-gray-300"
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
                {decision.reasoning || "—"}
              </p>
            </section>

            <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Risk Level
                </h3>
                <p className="text-sm text-gray-700">
                  {decision.riskLevel || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Confidence
                </h3>
                <p className="text-sm text-gray-700">
                  {decision.confidenceScore ?? "—"}
                </p>
              </div>
            </section>
          </div>
        </div>
        {["AWAITING_APPROVAL", "COMMITTED", "REVIEWED", "ARCHIVED"].includes(
          decision.status,
        ) ? (
          <div className="h-full w-[24%] min-w-[220px] max-w-[320px]">
            <TaskPanel
              decisionId={decision.id}
              decisionTitle={decision.title || "Untitled decision"}
              decisionSummary={decision.contextSummary || null}
              decisionSeq={decision.projectSeq ?? null}
              selectedOptionText={selectedOption?.text || null}
              decisionLink={decisionLink}
              canCreate={decision.status === "COMMITTED"}
              projectId={projectId}
              decisionRiskLevel={decision.riskLevel ?? null}
              decisionApprovedBy={decision.approvedBy ?? null}
            />
          </div>
        ) : null}
        {decision.status === "REVIEWED" ? (
          <div className="h-full w-[24%] min-w-[260px] max-w-[360px]">
            <DecisionReviewPanel
              decisionId={decision.id}
              projectId={projectId}
              status={decision.status}
              mode="readOnly"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DecisionDetailView;
