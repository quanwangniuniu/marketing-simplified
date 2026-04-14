export type HealthStatus = 'critical' | 'warning' | 'healthy';

export interface MockProject {
  id: number;
  name: string;
  description: string;
  member_count: number;
  updated_at: string;
  is_active: boolean;
  status: 'active' | 'completed' | 'paused';
  total_monthly_budget: number;
  advertising_platforms: string[];
  health: HealthStatus;
  healthReason?: string;
  miniKpis?: { roas: number; pacingPercent: number };
}

export const mockProjects: MockProject[] = [
  {
    id: 1,
    name: 'Q2 Product Launch',
    description: 'Cross-platform campaign for new product line targeting US market with Meta, Google, and TikTok ads.',
    member_count: 8,
    updated_at: '2026-04-14T10:30:00Z',
    is_active: true,
    status: 'active',
    total_monthly_budget: 45000,
    advertising_platforms: ['meta', 'google', 'tiktok'],
    health: 'critical',
    healthReason: '3 campaigns with ROAS below 0.5',
    miniKpis: { roas: 0.87, pacingPercent: 68 },
  },
  {
    id: 2,
    name: 'Brand Awareness - APAC',
    description: 'Regional brand awareness campaign focused on Southeast Asian markets with localized creative.',
    member_count: 5,
    updated_at: '2026-04-13T16:45:00Z',
    is_active: true,
    status: 'active',
    total_monthly_budget: 28000,
    advertising_platforms: ['meta', 'tiktok'],
    health: 'healthy',
    miniKpis: { roas: 3.45, pacingPercent: 92 },
  },
  {
    id: 3,
    name: 'Holiday Season Retargeting',
    description: 'Retargeting campaign for holiday season shoppers with dynamic product ads and special offers.',
    member_count: 4,
    updated_at: '2026-04-10T09:15:00Z',
    is_active: true,
    status: 'active',
    total_monthly_budget: 62000,
    advertising_platforms: ['meta', 'google'],
    health: 'warning',
    healthReason: 'Budget underspending by 18%',
    miniKpis: { roas: 2.10, pacingPercent: 52 },
  },
  {
    id: 4,
    name: 'Influencer Collab - Spring',
    description: 'Influencer partnership campaign for spring collection. Completed with 3.2x ROAS.',
    member_count: 3,
    updated_at: '2026-03-28T14:00:00Z',
    is_active: false,
    status: 'completed',
    total_monthly_budget: 15000,
    advertising_platforms: ['meta', 'tiktok'],
    health: 'healthy',
    miniKpis: { roas: 3.20, pacingPercent: 100 },
  },
  {
    id: 5,
    name: 'Performance Max Testing',
    description: 'A/B testing Google Performance Max campaigns against manual campaigns. Currently paused for review.',
    member_count: 2,
    updated_at: '2026-04-08T11:20:00Z',
    is_active: false,
    status: 'paused',
    total_monthly_budget: 20000,
    advertising_platforms: ['google'],
    health: 'warning',
    healthReason: 'Manual campaigns outperforming PMax by 40%',
    miniKpis: { roas: 1.85, pacingPercent: 45 },
  },
];
