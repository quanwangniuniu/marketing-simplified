import type { DashboardSummary } from './dashboard';
import type { DecisionListItem, DecisionRiskLevel } from './decision';
import type { MeetingListItem, MeetingActionItem } from './meeting';

export interface PendingDecisionDisplay extends DecisionListItem {
  riskLevel?: DecisionRiskLevel | null;
  authorName?: string;
  summary?: string;
}

export interface ActionItemDisplay extends MeetingActionItem {
  meeting_title?: string;
  due_date?: string | null;
}

export interface PendingAssetReviewItem {
  id: number;
  name: string;
  ownerName: string;
  submittedAt: string;
  assetType: string;
}

export interface ActiveCampaignSummary {
  status: string;
  count: number;
}

export interface ProjectInvitationSummary {
  id: number;
  projectName: string;
  invitedBy: string;
  createdAt: string;
}

export interface OverviewMock {
  taskSummary: DashboardSummary;
  pendingDecisions: PendingDecisionDisplay[];
  myDrafts: PendingDecisionDisplay[];
  upcomingMeetings: MeetingListItem[];
  actionItems: ActionItemDisplay[];
  pendingAssetReviews: PendingAssetReviewItem[];
  activeCampaigns: ActiveCampaignSummary[];
  pendingInvitations: ProjectInvitationSummary[];
}
