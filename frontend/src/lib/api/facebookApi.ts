import api from "../api";

export interface FacebookAdAccount {
  id: number;
  meta_account_id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number | null;
  business_id: string;
  is_owned: boolean;
  project_id: number | null;
}

export interface FacebookStatus {
  connected: boolean;
  fb_user_name?: string;
  fb_email?: string | null;
  business_id?: string;
  business_name?: string;
  token_expires_at?: string | null;
  last_synced_at?: string | null;
  ad_accounts?: FacebookAdAccount[];
}

export interface FacebookConnectPayload {
  authorize_url: string;
  state: string;
}

export interface MetaSummaryAggregates {
  spend: string;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  calls: number;
  purchases: number;
  revenue: string;
  ctr: string;
  cpc: string;
  cpm: string;
  cpl: string;
  cpcall: string;
  roas: string;
}

export interface MetaTimeseriesPoint {
  date: string;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  calls: number;
  purchases: number;
  revenue: string;
}

export interface MetaSummary {
  ad_account_id: number;
  currency: string;
  days: number;
  window: { since: string; until: string };
  aggregates: MetaSummaryAggregates;
  timeseries: MetaTimeseriesPoint[];
}

export interface MetaCampaignPerformanceRow {
  id: number;
  meta_campaign_id: string;
  name: string;
  objective: string;
  effective_status: string;
  daily_budget_cents: number | null;
  lifetime_budget_cents: number | null;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: string;
  ctr: string;
  cpc: string;
  cpm: string;
  cpl: string;
  cpa: string;
  roas: string;
}

export interface MetaCampaignPerformance {
  ad_account_id: number;
  currency: string;
  days: number;
  window: { since: string; until: string };
  campaigns: MetaCampaignPerformanceRow[];
}

export interface MetaSyncRun {
  id: number;
  ad_account: number;
  kind: string;
  status: "running" | "ok" | "partial" | "error";
  level_counts: Record<string, number>;
  error_message: string;
  started_at: string;
  finished_at: string | null;
}

export interface MetaCreativePerformanceRow {
  id: number;
  meta_creative_id: string;
  name: string;
  title: string;
  body: string;
  thumbnail_url: string;
  image_url: string;
  video_id: string;
  object_type: string;
  call_to_action_type: string;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: string;
  ctr: string;
  cpc: string;
  cpl: string;
  cpa: string;
  roas: string;
  video_p25: number;
  video_p75: number;
  video_p100: number;
  hook_rate: string;
  hold_rate: string;
  completion_rate: string;
}

export interface MetaCreativePerformance {
  ad_account_id: number;
  currency: string;
  days: number;
  window: { since: string; until: string };
  creatives: MetaCreativePerformanceRow[];
}

export interface MetaAdPerformanceRow {
  id: number;
  meta_ad_id: string;
  name: string;
  effective_status: string;
  adset_id: number;
  adset_name: string;
  campaign_id: number | null;
  campaign_name: string;
  creative:
    | {
        id: number;
        meta_creative_id: string;
        title: string;
        thumbnail_url: string;
        video_id: string;
        object_type: string;
      }
    | null;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: string;
  ctr: string;
  cpc: string;
  cpl: string;
  cpa: string;
  roas: string;
  hook_rate: string;
  hold_rate: string;
}

export interface MetaAdPerformance {
  ad_account_id: number;
  currency: string;
  days: number;
  window: { since: string; until: string };
  ads: MetaAdPerformanceRow[];
}

export interface MetaAdInsightPoint {
  date: string;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: string;
  video_p25: number;
  video_p75: number;
  video_p100: number;
  hook_rate: string;
  hold_rate: string;
}

export interface MetaAdInsightTimeseries {
  ad_account_id: number;
  ad_id: number;
  meta_ad_id: string;
  ad_name: string;
  currency: string;
  days: number;
  window: { since: string; until: string };
  points: MetaAdInsightPoint[];
}

export const facebookApi = {
  getStatus: async (): Promise<FacebookStatus> => {
    const response = await api.get("/api/facebook_integration/status/");
    return response.data;
  },

  connect: async (projectId?: number): Promise<FacebookConnectPayload> => {
    const response = await api.get("/api/facebook_integration/connect/", {
      params: projectId ? { project_id: projectId } : undefined,
    });
    return response.data;
  },

  disconnect: async (): Promise<{ connected: boolean }> => {
    const response = await api.post("/api/facebook_integration/disconnect/");
    return response.data;
  },

  sync: async (): Promise<FacebookStatus> => {
    const response = await api.post("/api/facebook_integration/sync/");
    return response.data;
  },

  linkAdAccountToProject: async (
    adAccountId: number,
    projectId: number | null
  ): Promise<FacebookAdAccount> => {
    const response = await api.post(
      `/api/facebook_integration/ad_accounts/${adAccountId}/link_project/`,
      { project_id: projectId }
    );
    return response.data;
  },

  getMetaSummary: async (
    adAccountId: number,
    days: number
  ): Promise<MetaSummary> => {
    const response = await api.get("/api/meta_ads/summary/", {
      params: { ad_account: adAccountId, days },
    });
    return response.data;
  },

  getMetaCampaignPerformance: async (
    adAccountId: number,
    days: number
  ): Promise<MetaCampaignPerformance> => {
    const response = await api.get(
      `/api/meta_ads/ad_accounts/${adAccountId}/campaign_performance/`,
      { params: { days } }
    );
    return response.data;
  },

  triggerAdAccountSync: async (
    adAccountId: number
  ): Promise<{ status: string; task_id: string; ad_account_id: number }> => {
    const response = await api.post(
      `/api/meta_ads/ad_accounts/${adAccountId}/sync/`
    );
    return response.data;
  },

  getSyncRuns: async (adAccountId: number): Promise<MetaSyncRun[]> => {
    const response = await api.get(
      `/api/meta_ads/ad_accounts/${adAccountId}/sync_runs/`
    );
    return response.data;
  },

  getMetaCreativePerformance: async (
    adAccountId: number,
    days: number
  ): Promise<MetaCreativePerformance> => {
    const response = await api.get(
      `/api/meta_ads/ad_accounts/${adAccountId}/creative_performance/`,
      { params: { days } }
    );
    return response.data;
  },

  getMetaAdPerformance: async (
    adAccountId: number,
    days: number
  ): Promise<MetaAdPerformance> => {
    const response = await api.get(
      `/api/meta_ads/ad_accounts/${adAccountId}/ad_performance/`,
      { params: { days } }
    );
    return response.data;
  },

  getMetaAdInsightTimeseries: async (
    adAccountId: number,
    adId: number,
    days: number
  ): Promise<MetaAdInsightTimeseries> => {
    const response = await api.get(
      `/api/meta_ads/ad_accounts/${adAccountId}/ads/${adId}/insights_timeseries/`,
      { params: { days } }
    );
    return response.data;
  },
};
