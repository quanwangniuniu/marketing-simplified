'use client';

import { DollarSign, BarChart3, TrendingUp, Target, RefreshCw } from 'lucide-react';
import KPICard from './KPICard';
import type { KPIData } from '@/lib/mock/dashboardMock';

interface KPICardRowProps {
  data: KPIData;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function KPICardRow({ data }: KPICardRowProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      <KPICard
        title="Total Cost"
        value={formatCurrency(data.totalCost.value)}
        icon={DollarSign}
        change={data.totalCost.change}
        status={data.totalCost.change > 20 ? 'warning' : 'neutral'}
        subtitle={data.totalCost.period}
      />
      <KPICard
        title="Active Ads"
        value={data.activeAds.value.toString()}
        icon={BarChart3}
        change={data.activeAds.change}
        status="healthy"
        subtitle={data.activeAds.breakdown}
      />
      <KPICard
        title="Budget Pacing"
        value={`${data.budgetPacing.value}%`}
        icon={TrendingUp}
        status={data.budgetPacing.status === 'on_track' ? 'healthy' : data.budgetPacing.status === 'over' ? 'critical' : 'warning'}
        progressValue={data.budgetPacing.value}
        progressMax={data.budgetPacing.target}
      />
      <KPICard
        title="Avg ROAS"
        value={`${data.avgRoas.value}x`}
        icon={Target}
        change={Number((data.avgRoas.change / data.avgRoas.value * 100).toFixed(1))}
        status={data.avgRoas.status}
        subtitle="Return on ad spend"
      />
      <KPICard
        title="Data Freshness"
        value={formatTimeAgo(data.dataFreshness.lastSync)}
        icon={RefreshCw}
        status={data.dataFreshness.status === 'synced' ? 'healthy' : data.dataFreshness.status === 'stale' ? 'warning' : 'critical'}
        subtitle="All platforms"
      />
    </div>
  );
}
