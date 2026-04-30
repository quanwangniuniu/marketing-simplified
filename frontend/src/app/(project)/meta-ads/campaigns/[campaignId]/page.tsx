'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronRight, ExternalLink, Target } from 'lucide-react';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';
import AdStockChart, {
  STOCK_METRIC_LABEL,
  type StockMetric,
} from '@/components/meta-ads/AdStockChart';
import {
  facebookApi,
  type MetaCampaignDetail,
  type MetaCampaignTimeseries,
  type MetaAdInsightPoint,
} from '@/lib/api/facebookApi';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
} from '@/components/meta-ads/metaAdsUtils';

const DAY_OPTIONS = [1, 2, 3, 7, 14, 28, 30] as const;

const CHART_METRIC_TABS: StockMetric[] = [
  'spend',
  'revenue',
  'leads',
  'purchases',
  'impressions',
  'clicks',
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-[#A6E661]/20 text-[#3d6b00]';
    case 'PAUSED':
      return 'bg-gray-100 text-gray-600';
    case 'ARCHIVED':
    case 'DELETED':
      return 'bg-gray-50 text-gray-400';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function roasBandClass(roasStr: string, idealRoas = 2.0): string {
  const roas = Number(roasStr);
  if (!Number.isFinite(roas) || roas <= 0) return 'bg-gray-100 text-gray-500';
  if (roas >= idealRoas) return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
  if (roas >= idealRoas * 0.75) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export default function CampaignDetailPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const campaignId = Number(params.campaignId);
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6">
          {Number.isFinite(campaignId) ? (
            <CampaignDetailContent campaignId={campaignId} />
          ) : (
            <div className="text-sm text-gray-500">Invalid campaign id.</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CampaignDetailContent({ campaignId }: { campaignId: number }) {
  const router = useRouter();
  const [days, setDays] = useState<number>(28);
  const [detail, setDetail] = useState<MetaCampaignDetail | null>(null);
  const [series, setSeries] = useState<MetaCampaignTimeseries | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [metric, setMetric] = useState<StockMetric>('spend');

  useEffect(() => {
    let active = true;
    setLoadingDetail(true);
    facebookApi
      .getMetaCampaignDetail(campaignId, days)
      .then((d) => active && setDetail(d))
      .catch(() => active && toast.error('Failed to load campaign detail.'))
      .finally(() => active && setLoadingDetail(false));
    return () => {
      active = false;
    };
  }, [campaignId, days]);

  useEffect(() => {
    let active = true;
    setLoadingSeries(true);
    facebookApi
      .getMetaCampaignTimeseries(campaignId, days)
      .then((d) => active && setSeries(d))
      .catch(() => active && toast.error('Failed to load campaign timeseries.'))
      .finally(() => active && setLoadingSeries(false));
    return () => {
      active = false;
    };
  }, [campaignId, days]);

  const currency = detail?.currency || 'USD';

  const chartPoints = useMemo<MetaAdInsightPoint[]>(
    () =>
      (series?.points ?? []).map((p) => ({
        date: p.date,
        spend: p.spend,
        impressions: p.impressions,
        clicks: p.clicks,
        leads: p.leads,
        purchases: p.purchases,
        revenue: p.revenue,
        video_p25: 0,
        video_p75: 0,
        video_p100: 0,
        hook_rate: '0',
        hold_rate: '0',
      })),
    [series]
  );

  if (loadingDetail && !detail) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-gray-500">
        Campaign not found or inaccessible.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/meta-ads" className="hover:text-[#1a9ba3]">
          Meta Ads
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
        <span className="truncate text-gray-700">
          {detail.name || detail.meta_campaign_id}
        </span>
      </nav>

      <header className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1a9ba3]">
            Campaign
          </div>
          <h1 className="mt-0.5 truncate text-lg font-semibold text-gray-900">
            {detail.name || detail.meta_campaign_id}
          </h1>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
            <span
              className={`rounded-full px-1.5 py-0.5 font-medium ${statusBadgeClass(detail.effective_status)}`}
            >
              {detail.effective_status}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {detail.meta_campaign_id}
            </span>
            {detail.objective && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5">
                <Target className="mr-0.5 inline h-2.5 w-2.5 -mt-px" />
                {detail.objective.replace('OUTCOME_', '')}
              </span>
            )}
            <span className="rounded bg-gray-100 px-1.5 py-0.5">
              {detail.linked_adsets_count} ad sets
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                days === d
                  ? 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d} day{d > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Performance trend
              </h3>
              <div className="flex flex-wrap gap-1">
                {CHART_METRIC_TABS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      metric === m
                        ? 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {STOCK_METRIC_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
            {loadingSeries && !series ? (
              <Skeleton className="h-64 w-full" />
            ) : chartPoints.length > 0 ? (
              <AdStockChart
                points={chartPoints}
                metric={metric}
                currency={currency}
                height={260}
              />
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                No time-series data yet.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Ad sets · {detail.linked_adsets_count}
              </h3>
              <p className="text-[11px] text-gray-500">
                Click a row to open ad set detail
              </p>
            </div>
            {detail.linked_adsets.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                No ad sets under this campaign yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ad set</th>
                      <th className="px-4 py-2 font-medium text-right">Spend</th>
                      <th className="px-4 py-2 font-medium text-right">Impr.</th>
                      <th className="px-4 py-2 font-medium text-right">Leads</th>
                      <th className="px-4 py-2 font-medium text-right">Purch.</th>
                      <th className="px-4 py-2 font-medium text-right">Revenue</th>
                      <th className="px-4 py-2 font-medium text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.linked_adsets.map((a) => (
                      <tr
                        key={a.id}
                        className="align-top hover:bg-gray-50/60"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={`/meta-ads/adsets/${a.id}`}
                            className="block max-w-[420px] truncate text-xs font-medium text-gray-900 hover:text-[#1a9ba3]"
                          >
                            {a.name || a.meta_adset_id}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                            <span
                              className={`rounded-full px-1.5 py-0.5 font-medium ${statusBadgeClass(a.effective_status)}`}
                            >
                              {a.effective_status}
                            </span>
                            {a.optimization_goal && (
                              <span>goal · {a.optimization_goal}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {formatCurrency(a.spend, currency)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                          {formatNumber(a.impressions)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {formatNumber(a.leads)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {formatNumber(a.purchases)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {Number(a.revenue) > 0
                            ? formatCurrency(a.revenue, currency)
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-mono font-medium ${roasBandClass(a.roas)}`}
                          >
                            {Number(a.roas) > 0
                              ? `${formatRatio(a.roas)}x`
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <KpiCardsBlock
            aggregates={detail.aggregates}
            currency={currency}
            days={days}
            windowRange={detail.window}
          />

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-[11px] text-gray-500">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Meta info
            </div>
            <dl className="space-y-1">
              <div className="flex justify-between gap-2">
                <dt>Campaign ID</dt>
                <dd className="font-mono text-gray-700">
                  {detail.meta_campaign_id}
                </dd>
              </div>
              {detail.objective && (
                <div className="flex justify-between gap-2">
                  <dt>Objective</dt>
                  <dd className="font-mono text-gray-700">
                    {detail.objective}
                  </dd>
                </div>
              )}
              {detail.daily_budget_cents !== null && (
                <div className="flex justify-between gap-2">
                  <dt>Daily budget</dt>
                  <dd className="font-mono text-gray-700">
                    {formatCurrency(
                      detail.daily_budget_cents / 100,
                      currency
                    )}
                  </dd>
                </div>
              )}
              {detail.lifetime_budget_cents !== null && (
                <div className="flex justify-between gap-2">
                  <dt>Lifetime budget</dt>
                  <dd className="font-mono text-gray-700">
                    {formatCurrency(
                      detail.lifetime_budget_cents / 100,
                      currency
                    )}
                  </dd>
                </div>
              )}
              {detail.start_time && (
                <div className="flex justify-between gap-2">
                  <dt>Start time</dt>
                  <dd className="font-mono text-gray-700">
                    {new Date(detail.start_time).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {detail.stop_time && (
                <div className="flex justify-between gap-2">
                  <dt>Stop time</dt>
                  <dd className="font-mono text-gray-700">
                    {new Date(detail.stop_time).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt>First seen</dt>
                <dd className="font-mono text-gray-700">
                  {new Date(detail.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Last sync</dt>
                <dd className="font-mono text-gray-700">
                  {new Date(detail.updated_at).toLocaleString()}
                </dd>
              </div>
            </dl>
            <a
              href="https://business.facebook.com/adsmanager/manage/campaigns"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
            >
              Open in Ads Manager <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function KpiCardsBlock({
  aggregates,
  currency,
  days,
  windowRange,
}: {
  aggregates: MetaCampaignDetail['aggregates'];
  currency: string;
  days: number;
  windowRange: { since: string; until: string };
}) {
  const tiles = [
    { label: 'Spend', value: formatCurrency(aggregates.spend, currency) },
    {
      label: 'Revenue',
      value:
        Number(aggregates.revenue) > 0
          ? formatCurrency(aggregates.revenue, currency)
          : '—',
    },
    {
      label: 'ROAS',
      value:
        Number(aggregates.roas) > 0 ? `${formatRatio(aggregates.roas)}x` : '—',
    },
    { label: 'Leads', value: formatNumber(aggregates.leads) },
    { label: 'Purchases', value: formatNumber(aggregates.purchases) },
    {
      label: 'CPL',
      value:
        aggregates.leads > 0 ? formatCurrency(aggregates.cpl, currency) : '—',
    },
    {
      label: 'CPA',
      value:
        aggregates.purchases > 0
          ? formatCurrency(aggregates.cpa, currency)
          : '—',
    },
    { label: 'CTR', value: formatPercent(aggregates.ctr) },
  ];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          KPIs · {days} days
        </h3>
        <span className="text-[10px] text-gray-400">
          {windowRange.since} → {windowRange.until}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              {t.label}
            </div>
            <div className="mt-0.5 font-mono text-xs font-semibold text-gray-900">
              {t.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
