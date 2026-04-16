// --- KPI Data ---

export interface KPIData {
  totalCost: { value: number; change: number; period: string };
  activeAds: { value: number; change: number; breakdown: string };
  budgetPacing: { value: number; target: number; status: 'on_track' | 'over' | 'under' };
  avgRoas: { value: number; change: number; status: 'healthy' | 'warning' | 'critical' };
  dataFreshness: { lastSync: string; status: 'synced' | 'stale' | 'error' };
}

export const mockKPIs: KPIData = {
  totalCost: { value: 65593.47, change: 12.3, period: 'vs last month' },
  activeAds: { value: 351, change: 8, breakdown: '4 campaigns' },
  budgetPacing: { value: 68, target: 100, status: 'on_track' },
  avgRoas: { value: 4.21, change: 0.35, status: 'healthy' },
  dataFreshness: { lastSync: '2026-04-15T00:28:00Z', status: 'synced' },
};

// --- KPI Attribution Data ---

export interface KPIAttribution {
  factors: { label: string; impact: string; direction: 'up' | 'down' | 'neutral' }[];
  topContributor: { name: string; detail: string };
  comparedTo: string;
}

export const mockAttributions: Record<string, KPIAttribution> = {
  totalCost: {
    factors: [
      { label: 'Meta CPC increased 18% across all ad sets', impact: '+$4,200', direction: 'up' },
      { label: 'Google PMax auto-scaled budget by 12%', impact: '+$2,800', direction: 'up' },
      { label: 'TikTok paused 2 underperforming campaigns', impact: '-$1,100', direction: 'down' },
    ],
    topContributor: { name: 'META | FES | ADV+ | Soul Sucking', detail: 'Spent $2,327 with 0.07x ROAS — highest waste' },
    comparedTo: 'Mar 1–15 vs Apr 1–15',
  },
  activeAds: {
    factors: [
      { label: '12 new ad variants launched for Q2', impact: '+12 ads', direction: 'up' },
      { label: '4 ads paused due to policy violations', impact: '-4 ads', direction: 'down' },
    ],
    topContributor: { name: 'Google | PMax | Q2 Launch', detail: 'Auto-generated 8 responsive variants' },
    comparedTo: 'Last week (343 active)',
  },
  budgetPacing: {
    factors: [
      { label: 'Meta delivery constrained by narrow audience', impact: '-15% pace', direction: 'down' },
      { label: 'Google spending on track at 95% daily target', impact: 'On pace', direction: 'neutral' },
    ],
    topContributor: { name: 'META | FES | LAL 1%', detail: 'Only spending 45% of daily budget — audience too small' },
    comparedTo: 'Ideal pace: $1,500/day — Actual: $1,280/day',
  },
  avgRoas: {
    factors: [
      { label: 'Google Brand search ROAS steady at 6.8x', impact: 'Anchor', direction: 'up' },
      { label: '5 Meta campaigns below 0.5x dragging average', impact: '-1.2x avg', direction: 'down' },
    ],
    topContributor: { name: 'Google | Search | Brand Terms', detail: '6.82x ROAS — best performer, 23% of spend' },
    comparedTo: 'Last month avg: 3.86x → Current: 4.21x',
  },
  dataFreshness: {
    factors: [
      { label: 'Meta & Google syncing every 15 min', impact: 'Normal', direction: 'neutral' },
      { label: 'TikTok API delayed — last sync 1h ago', impact: 'Stale', direction: 'down' },
    ],
    topContributor: { name: 'TikTok Ads API', detail: 'Rate limit hit — next sync scheduled in 12 min' },
    comparedTo: 'Target: < 30 min freshness',
  },
};

// --- Budget Pacing Chart Data (30 days) ---

export interface PacingDataPoint {
  date: string;
  actual: number;
  ideal: number;
  projected?: number;
}

function generatePacingData(): PacingDataPoint[] {
  const data: PacingDataPoint[] = [];
  const dailyBudget = 45000 / 30;
  let cumActual = 0;

  for (let day = 1; day <= 30; day++) {
    const cumIdeal = dailyBudget * day;
    const variance = day <= 15
      ? (Math.random() - 0.3) * dailyBudget * 0.4
      : (Math.random() - 0.45) * dailyBudget * 0.5;
    cumActual += dailyBudget + variance;

    const point: PacingDataPoint = {
      date: `Apr ${day}`,
      actual: day <= 15 ? Math.round(cumActual) : 0,
      ideal: Math.round(cumIdeal),
    };

    if (day > 15) {
      point.projected = Math.round(cumActual + (cumActual / 15) * (day - 15));
    } else {
      point.actual = Math.round(cumActual);
    }

    data.push(point);
  }
  return data;
}

export const mockPacingData = generatePacingData();

// --- Campaign Performance Data ---

export interface CampaignData {
  id: number;
  name: string;
  platform: 'meta' | 'google' | 'tiktok';
  spend: number;
  conversions: number;
  roas: number;
  change: number;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export const mockCampaigns: CampaignData[] = [
  { id: 1, name: 'META | FES | ADV+ | Soul Sucking | Dubai Broll', platform: 'meta', spend: 2327.76, conversions: 12, roas: 0.07, change: -85, isAnomaly: true, anomalyReason: 'ROAS dropped 85% in 7 days' },
  { id: 2, name: 'META | FES-B | ABO | Soul Sucking C1', platform: 'meta', spend: 789.02, conversions: 8, roas: 0.50, change: -42, isAnomaly: true, anomalyReason: 'Below profitability threshold' },
  { id: 3, name: 'Google | Search | Brand Terms', platform: 'google', spend: 4521.30, conversions: 156, roas: 6.82, change: 15, isAnomaly: false },
  { id: 4, name: 'META | FES | LAL 1% | POV$3k', platform: 'meta', spend: 878.19, conversions: 5, roas: 0.45, change: -67, isAnomaly: true, anomalyReason: 'Cost per conversion 3x above target' },
  { id: 5, name: 'Google | PMax | Q2 Launch', platform: 'google', spend: 8934.50, conversions: 234, roas: 5.21, change: 22, isAnomaly: false },
  { id: 6, name: 'TikTok | Spark | Influencer UGC', platform: 'tiktok', spend: 3456.80, conversions: 89, roas: 3.45, change: -8, isAnomaly: false },
  { id: 7, name: 'META | FES | ADV+ | NORM JOB C3', platform: 'meta', spend: 765.23, conversions: 2, roas: 0.15, change: -91, isAnomaly: true, anomalyReason: 'Near-zero return on ad spend' },
  { id: 8, name: 'Google | Display | Retargeting', platform: 'google', spend: 2145.60, conversions: 67, roas: 4.12, change: 5, isAnomaly: false },
  { id: 9, name: 'TikTok | In-Feed | Product Demo', platform: 'tiktok', spend: 1890.40, conversions: 45, roas: 2.89, change: -12, isAnomaly: false },
  { id: 10, name: 'META | FES | ABO | ADV+ | Jade', platform: 'meta', spend: 1247.10, conversions: 3, roas: 0.09, change: -78, isAnomaly: true, anomalyReason: 'Creative fatigue detected' },
];

// --- Alert Data ---

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'open' | 'accepted' | 'deferred' | 'dismissed';
export type AlertType = 'spend_spike' | 'performance_drop' | 'budget_pacing' | 'delivery_issue' | 'policy_violation';

export interface AlertData {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  scope: string;
  why: string;
  suggestion: string;
  status: AlertStatus;
  createdAt: string;
}

export const mockAlerts: AlertData[] = [
  {
    id: 1,
    type: 'spend_spike',
    severity: 'critical',
    title: 'Spend Spike Detected',
    scope: 'META | FES | ADV+ | Soul Sucking | Dubai Broll C2',
    why: 'CPC increased 45% in last 48h due to audience saturation in 25-34 demographic. Competitor bidding intensity up 30% in this segment.',
    suggestion: 'Broaden targeting to include 35-44 age group, or reduce daily budget by 40% until CPC stabilizes.',
    status: 'open',
    createdAt: '2026-04-15T00:15:00Z',
  },
  {
    id: 2,
    type: 'performance_drop',
    severity: 'critical',
    title: 'ROAS Below Threshold',
    scope: 'META | FES-B | ABO | Soul Sucking C1 - Copy',
    why: 'Creative has been running for 21 days without refresh. CTR dropped from 2.1% to 0.8%, indicating creative fatigue.',
    suggestion: 'Pause this ad set and launch refreshed creative variants. Consider testing video format.',
    status: 'open',
    createdAt: '2026-04-14T22:30:00Z',
  },
  {
    id: 3,
    type: 'budget_pacing',
    severity: 'warning',
    title: 'Budget Underspend Risk',
    scope: 'Q2 Product Launch - Overall',
    why: 'Current daily spend rate ($1,280/day) is 15% below target ($1,500/day). At this pace, $6,600 will remain unspent by month end.',
    suggestion: 'Increase bids by 10-15% on top-performing ad sets, or reallocate to Google PMax which has capacity.',
    status: 'open',
    createdAt: '2026-04-14T18:00:00Z',
  },
  {
    id: 4,
    type: 'delivery_issue',
    severity: 'warning',
    title: 'Low Delivery Volume',
    scope: 'META | FES | LAL 1% | POV$3k - C3',
    why: 'Audience size too narrow (est. 45K). Meta cannot deliver impressions efficiently, resulting in high CPMs ($28 vs $12 benchmark).',
    suggestion: 'Expand lookalike to 2-3% or add interest-based targeting layer.',
    status: 'open',
    createdAt: '2026-04-14T15:45:00Z',
  },
  {
    id: 5,
    type: 'performance_drop',
    severity: 'info',
    title: 'TikTok CPA Rising',
    scope: 'TikTok | In-Feed | Product Demo',
    why: 'CPA increased 12% week-over-week. This is within normal weekly variance but worth monitoring.',
    suggestion: 'No action needed yet. Flag for review if CPA rises above $18 threshold.',
    status: 'open',
    createdAt: '2026-04-14T12:00:00Z',
  },
  {
    id: 6,
    type: 'policy_violation',
    severity: 'critical',
    title: 'Ad Rejected - Policy Issue',
    scope: 'Google | Display | Retargeting - Banner Set C',
    why: 'Google flagged misleading claims in ad copy. The phrase "guaranteed results" violates advertising standards policy.',
    suggestion: 'Update ad copy to remove absolute claims. Use "proven strategies" or "data-driven approach" instead.',
    status: 'open',
    createdAt: '2026-04-14T09:20:00Z',
  },
];

// --- Data Source Status ---

export interface DataSourceStatus {
  name: string;
  platform: string;
  status: 'connected' | 'warning' | 'disconnected';
  lastSync: string;
}

export const mockDataSources: DataSourceStatus[] = [
  { name: 'Meta Ads', platform: 'meta', status: 'connected', lastSync: '2026-04-15T00:28:00Z' },
  { name: 'Google Ads', platform: 'google', status: 'connected', lastSync: '2026-04-15T00:25:00Z' },
  { name: 'TikTok Ads', platform: 'tiktok', status: 'warning', lastSync: '2026-04-14T23:10:00Z' },
  { name: 'Slack', platform: 'slack', status: 'connected', lastSync: '2026-04-15T00:30:00Z' },
];

// --- Recent Activity ---

export interface ActivityItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  time: string;
}

export const mockActivities: ActivityItem[] = [
  { id: 1, type: 'success', message: 'Google PMax auto-scaled budget +12%', time: '2026-04-15T00:30:00Z' },
  { id: 2, type: 'error', message: 'META | Soul Sucking CPC spiked 45% — alert created', time: '2026-04-15T00:15:00Z' },
  { id: 3, type: 'warning', message: 'TikTok API rate limit — sync delayed 1h', time: '2026-04-14T23:10:00Z' },
  { id: 4, type: 'info', message: 'Weekly report generated for Q2 Product Launch', time: '2026-04-14T20:00:00Z' },
  { id: 5, type: 'success', message: '2 new ad variants approved by Ray', time: '2026-04-14T16:30:00Z' },
  { id: 6, type: 'info', message: 'Budget pacing recalculated — on track at 68%', time: '2026-04-14T12:00:00Z' },
];

// --- Account Health ---

export interface AccountHealth {
  overallScore: number;
  metrics: { label: string; value: number; status: 'healthy' | 'warning' | 'critical' }[];
}

export const mockAccountHealth: AccountHealth = {
  overallScore: 72,
  metrics: [
    { label: 'Budget Utilization', value: 68, status: 'healthy' },
    { label: 'Creative Freshness', value: 45, status: 'warning' },
    { label: 'Anomaly Rate', value: 50, status: 'critical' },
    { label: 'Data Completeness', value: 92, status: 'healthy' },
  ],
};
