'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Facebook,
  Loader2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';
import AccountPicker from '@/components/meta-ads/AccountPicker';
import AdsDrilldownPanel from '@/components/meta-ads/AdsDrilldownPanel';
import CampaignHierarchyTable from '@/components/meta-ads/CampaignHierarchyTable';
import CreativesPanel from '@/components/meta-ads/CreativesPanel';
import CreativeRankPanel from '@/components/meta-ads/CreativeRankPanel';
import RankingPanel from '@/components/meta-ads/RankingPanel';
import {
  facebookApi,
  type FacebookAdAccount,
  type MetaCampaignPerformance,
  type MetaCampaignPerformanceRow,
  type MetaSummary,
  type MetaSyncRun,
} from '@/lib/api/facebookApi';

const DAY_OPTIONS = [1, 2, 3, 7, 14, 28, 30] as const;

const METRIC_TABS = [
  { key: 'spend', label: 'Spend' },
  { key: 'leads', label: 'Leads' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'revenue', label: 'Revenue' },
] as const;

type MetricKey = (typeof METRIC_TABS)[number]['key'];

const VIEW_TABS = [
  { key: 'overview', label: 'Overview', hint: 'KPI + campaigns' },
  { key: 'creatives', label: 'Creatives', hint: 'Hook / hold rate' },
  { key: 'drilldown', label: 'Ad drill-down', hint: 'Per-ad time series' },
  { key: 'ranking', label: 'Ranking', hint: 'Composite-score ad rank' },
  { key: 'creative-rank', label: 'Creative Rank', hint: '1:1 creative leaderboard' },
] as const;

type ViewKey = (typeof VIEW_TABS)[number]['key'];

function formatCurrency(value: string | number, currency: string) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

function formatNumber(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

function formatRatio(value: string, digits = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatPercent(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

function roasBandClass(roasStr: string, idealRoas = 2.0): string {
  const roas = Number(roasStr);
  if (!Number.isFinite(roas) || roas <= 0) return 'bg-gray-100 text-gray-500';
  if (roas >= idealRoas) return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
  if (roas >= idealRoas * 0.75) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

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

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const SYNC_KIND_LABEL: Record<string, string> = {
  manual: 'Manual trigger',
  hourly: 'Scheduled hourly',
  '15min': 'Recent window (15 min)',
};

const LEVEL_LABEL: Record<string, string> = {
  campaigns: 'Campaigns synced',
  adsets: 'Ad sets synced',
  ads: 'Ads synced',
  creatives: 'Creatives synced',
  insights_rows: 'Insight rows synced',
};

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

const SELECTED_ACCOUNT_STORAGE_KEY = 'meta-ads:selected-ad-account';

export default function MetaAdsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6">
          <MetaAdsContent />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function MetaAdsContent() {
  const searchParams = useSearchParams();
  const initialTab = useMemo<ViewKey>(() => {
    const raw = searchParams.get('tab');
    return VIEW_TABS.some((t) => t.key === raw) ? (raw as ViewKey) : 'overview';
  }, [searchParams]);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connected, setConnected] = useState(false);
  const [adAccounts, setAdAccounts] = useState<FacebookAdAccount[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [days, setDays] = useState<number>(28);
  const [summary, setSummary] = useState<MetaSummary | null>(null);
  const [perf, setPerf] = useState<MetaCampaignPerformance | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [metricTab, setMetricTab] = useState<MetricKey>('spend');
  const [syncing, setSyncing] = useState(false);
  const [latestRun, setLatestRun] = useState<MetaSyncRun | null>(null);
  const [viewTab, setViewTab] = useState<ViewKey>(initialTab);

  useEffect(() => {
    let active = true;
    setLoadingStatus(true);
    facebookApi
      .getStatus()
      .then((status) => {
        if (!active) return;
        setConnected(status.connected);
        const accounts = status.ad_accounts ?? [];
        setAdAccounts(accounts);
        if (accounts.length > 0) {
          const stored =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY)
              : null;
          const storedId = stored ? Number(stored) : NaN;
          const storedMatch = accounts.find((a) => a.id === storedId);
          const owned = accounts.find((a) => a.is_owned);
          setSelectedId((storedMatch ?? owned ?? accounts[0]).id);
        }
      })
      .catch(() => setConnected(false))
      .finally(() => setLoadingStatus(false));
    return () => {
      active = false;
    };
  }, []);

  const handleSelectAccount = (id: number) => {
    setSelectedId(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, String(id));
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoadingData(true);
    Promise.all([
      facebookApi.getMetaSummary(selectedId, days),
      facebookApi.getMetaCampaignPerformance(selectedId, days),
    ])
      .then(([s, p]) => {
        if (!active) return;
        setSummary(s);
        setPerf(p);
      })
      .catch(() => {
        if (!active) return;
        toast.error('Failed to load Meta data.');
      })
      .finally(() => setLoadingData(false));
    return () => {
      active = false;
    };
  }, [selectedId, days]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    facebookApi
      .getSyncRuns(selectedId)
      .then((runs) => active && setLatestRun(runs[0] ?? null))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleSync = async () => {
    if (!selectedId) return;
    setSyncing(true);
    try {
      await facebookApi.triggerAdAccountSync(selectedId);
      toast.success('Sync started. Data will refresh when it finishes.');
      pollSync(selectedId);
    } catch {
      toast.error('Failed to start sync.');
      setSyncing(false);
    }
  };

  const pollSync = (adAccountId: number) => {
    let stopped = false;
    let attempts = 0;
    const tick = async () => {
      if (stopped || attempts > 60) {
        setSyncing(false);
        return;
      }
      attempts += 1;
      try {
        const runs = await facebookApi.getSyncRuns(adAccountId);
        const run = runs[0];
        if (run) setLatestRun(run);
        if (run && (run.status === 'ok' || run.status === 'error')) {
          setSyncing(false);
          if (run.status === 'ok') {
            toast.success(
              `Synced ${run.level_counts?.campaigns ?? 0} campaigns, ${run.level_counts?.ads ?? 0} ads, ${run.level_counts?.insights_rows ?? 0} insight rows.`
            );
            const [s, p] = await Promise.all([
              facebookApi.getMetaSummary(adAccountId, days),
              facebookApi.getMetaCampaignPerformance(adAccountId, days),
            ]);
            setSummary(s);
            setPerf(p);
          } else {
            toast.error(`Sync failed: ${run.error_message.slice(0, 80)}`);
          }
          return;
        }
      } catch {
        // keep polling
      }
      setTimeout(tick, 5000);
    };
    tick();
    return () => {
      stopped = true;
    };
  };

  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.timeseries.map((p) => ({
      date: p.date,
      spend: Number(p.spend),
      leads: p.leads,
      purchases: p.purchases,
      revenue: Number(p.revenue),
    }));
  }, [summary]);

  const currency = summary?.currency || perf?.currency || 'USD';
  const campaigns = perf?.campaigns ?? [];

  if (loadingStatus) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#1877F2]/10">
          <Facebook className="h-8 w-8 text-[#1877F2]" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">Meta is not connected</h1>
        <p className="mb-6 text-sm text-gray-600">
          Connect your Meta business account on the Integrations page to pull real campaign, ad,
          and insight data into MediaJira.
        </p>
        <Link
          href="/integrations"
          className="inline-flex rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95"
        >
          Go to Integrations
        </Link>
      </div>
    );
  }

  if (adAccounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-gray-600">
          No ad accounts are accessible from this Meta connection yet. Try refreshing the connection on the Integrations page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-[#1877F2]" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Meta Ads</h1>
            <p className="text-xs text-gray-500">
              Live performance data from Facebook Business
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AccountPicker
            accounts={adAccounts}
            selectedId={selectedId}
            onSelect={handleSelectAccount}
          />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {syncing ? 'Syncing...' : 'Refresh data'}
          </button>
        </div>
      </header>

      {latestRun && <SyncStatusCard run={latestRun} />}

      <div className="flex flex-wrap items-center gap-2">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              days === d
                ? 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {d} day{d > 1 ? 's' : ''}
          </button>
        ))}
        {summary && (
          <span className="ml-2 text-xs text-gray-500">
            {summary.window.since} → {summary.window.until}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-gray-100">
        {VIEW_TABS.map((tab) => {
          const active = viewTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setViewTab(tab.key)}
              className={`-mb-px flex items-baseline gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-[#3CCED7] text-[#1a9ba3]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              <span className="text-[11px] font-normal text-gray-400">
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>

      {viewTab === 'overview' && (
        <>
          {loadingData && !summary ? (
            <div className="grid grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : summary ? (
            <KpiRow summary={summary} currency={currency} />
          ) : null}

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Trend over time</h2>
              <div className="flex items-center gap-1">
                {METRIC_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMetricTab(tab.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      metricTab === tab.key
                        ? 'bg-[#3CCED7]/15 text-[#1a9ba3]'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-60 w-full">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  No data for this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: unknown) => {
                        if (typeof value !== 'number' && typeof value !== 'string') return '—';
                        if (metricTab === 'spend' || metricTab === 'revenue') {
                          return formatCurrency(value, currency);
                        }
                        return formatNumber(value);
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metricTab}
                      stroke="#3CCED7"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {selectedId && (
            <CampaignHierarchyTable
              campaigns={campaigns}
              currency={currency}
              adAccountId={selectedId}
              days={days}
            />
          )}
        </>
      )}

      {viewTab === 'creatives' && selectedId && (
        <CreativesPanel adAccountId={selectedId} days={days} currency={currency} />
      )}

      {viewTab === 'drilldown' && selectedId && (
        <AdsDrilldownPanel adAccountId={selectedId} days={days} currency={currency} />
      )}

      {viewTab === 'ranking' && selectedId && (
        <RankingPanel adAccountId={selectedId} currency={currency} />
      )}

      {viewTab === 'creative-rank' && selectedId && (
        <CreativeRankPanel adAccountId={selectedId} currency={currency} />
      )}
    </div>
  );
}

function KpiRow({ summary, currency }: { summary: MetaSummary; currency: string }) {
  const a = summary.aggregates;
  const cards = [
    {
      label: 'Spend',
      value: formatCurrency(a.spend, currency),
      hint: null,
    },
    {
      label: 'ROAS',
      value: `${formatRatio(a.roas)}x`,
      hint: Number(a.roas) >= 2 ? 'above target' : 'below target',
      trendUp: Number(a.roas) >= 2,
    },
    {
      label: 'Leads',
      value: formatNumber(a.leads),
      hint: `CPL ${formatCurrency(a.cpl, currency)}`,
    },
    {
      label: 'Purchases',
      value: formatNumber(a.purchases),
      hint: `CPA ${formatCurrency(a.cpl, currency)}`,
    },
    {
      label: 'CTR',
      value: formatPercent(a.ctr),
      hint: `CPC ${formatCurrency(a.cpc, currency)}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {c.label}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <div className="text-xl font-semibold text-gray-900">{c.value}</div>
            {c.trendUp !== undefined &&
              (c.trendUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-[#1a9ba3]" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              ))}
          </div>
          {c.hint && (
            <div className="mt-0.5 text-[11px] text-gray-500">{c.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function CampaignRow({
  c,
  currency,
}: {
  c: MetaCampaignPerformanceRow;
  currency: string;
}) {
  return (
    <tr className="hover:bg-gray-50/60">
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(c.effective_status)}`}
        >
          {c.effective_status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="max-w-[420px] truncate text-xs font-medium text-gray-900">
          {c.name || c.meta_campaign_id}
        </div>
        <div className="mt-0.5 text-[10px] text-gray-400">
          {c.objective.replace('OUTCOME_', '')}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-800">
        {formatCurrency(c.spend, currency)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
        {formatPercent(c.ctr)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
        {formatCurrency(c.cpc, currency)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-800">
        {formatNumber(c.leads)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
        {c.leads > 0 ? formatCurrency(c.cpl, currency) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-800">
        {formatNumber(c.purchases)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-800">
        {Number(c.revenue) > 0 ? formatCurrency(c.revenue, currency) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-mono font-medium ${roasBandClass(c.roas)}`}
        >
          {Number(c.roas) > 0 ? `${formatRatio(c.roas)}x` : '—'}
        </span>
      </td>
    </tr>
  );
}

function SyncStatusCard({ run }: { run: MetaSyncRun }) {
  const [expanded, setExpanded] = useState(false);
  const tone =
    run.status === 'ok'
      ? 'ok'
      : run.status === 'error'
        ? 'error'
        : run.status === 'running'
          ? 'running'
          : 'partial';
  const toneStyles: Record<string, { icon: JSX.Element; chip: string; border: string; bg: string }> = {
    ok: {
      icon: <CheckCircle2 className="h-4 w-4 text-[#1a9ba3]" />,
      chip: 'bg-[#3CCED7]/15 text-[#1a9ba3]',
      border: 'border-[#3CCED7]/40',
      bg: 'bg-[#3CCED7]/5',
    },
    error: {
      icon: <AlertCircle className="h-4 w-4 text-red-600" />,
      chip: 'bg-red-100 text-red-700',
      border: 'border-red-200',
      bg: 'bg-red-50/60',
    },
    running: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-amber-600" />,
      chip: 'bg-amber-100 text-amber-700',
      border: 'border-amber-200',
      bg: 'bg-amber-50/60',
    },
    partial: {
      icon: <Clock3 className="h-4 w-4 text-amber-600" />,
      chip: 'bg-amber-100 text-amber-700',
      border: 'border-amber-200',
      bg: 'bg-amber-50/60',
    },
  };
  const s = toneStyles[tone];
  const kindLabel = SYNC_KIND_LABEL[run.kind] || run.kind || 'Sync';
  const counts = run.level_counts || {};
  const totalRowCount = Object.keys(counts).length;
  const startedFull = new Date(run.started_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
  const finishedFull = run.finished_at
    ? new Date(run.finished_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })
    : null;

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} transition-colors`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          {s.icon}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">
                Last sync · {timeAgo(run.started_at)}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${s.chip}`}>
                {run.status}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-gray-500">
              {kindLabel}
              {totalRowCount > 0 && (
                <>
                  {' · '}
                  {counts.campaigns ?? 0} campaigns
                  {' · '}
                  {counts.ads ?? 0} ads
                  {' · '}
                  {counts.insights_rows ?? 0} insight rows
                </>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-gray-100/80 px-4 py-3 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {Object.entries(LEVEL_LABEL).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between border-b border-dashed border-gray-200/60 py-1">
                <span className="text-gray-500">{label}</span>
                <span className="font-mono text-gray-900">
                  {counts[k] !== undefined ? formatNumber(counts[k] as number) : '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Started at</span>
              <span className="font-mono text-gray-700">{startedFull}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-500">Finished at</span>
              <span className="font-mono text-gray-700">
                {finishedFull ?? <em className="not-italic text-gray-400">still running</em>}
              </span>
            </div>
          </div>
          {run.error_message && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5">
              <div className="text-[11px] font-semibold text-red-700">Error detail</div>
              <div className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-red-700">
                {run.error_message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaginationBar({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  total,
  onPageChange,
}: {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const [pageInput, setPageInput] = useState<string>(String(currentPage));
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const goToPage = (n: number) => {
    const clamped = Math.max(1, Math.min(totalPages, Math.floor(n)));
    onPageChange(clamped);
    setPageInput(String(clamped));
  };

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, currentPage * pageSize);

  const btnBase =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <label htmlFor="page-size" className="text-gray-500">
          Rows per page
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="ml-2 text-gray-400">
          {rangeStart}–{rangeEnd} of {total}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btnBase}
          aria-label="First page"
          disabled={currentPage <= 1}
          onClick={() => goToPage(1)}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={btnBase}
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1 px-1 text-gray-500">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => {
              const n = Number(pageInput);
              if (Number.isFinite(n)) goToPage(n);
              else setPageInput(String(currentPage));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(n)) goToPage(n);
              }
            }}
            className="h-7 w-14 rounded-md border border-gray-200 bg-white px-1.5 text-center font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
          />
          <span>of {totalPages}</span>
        </div>
        <button
          type="button"
          className={btnBase}
          aria-label="Next page"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={btnBase}
          aria-label="Last page"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(totalPages)}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
