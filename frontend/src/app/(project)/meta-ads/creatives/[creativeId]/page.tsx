'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Play,
  Video,
} from 'lucide-react';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';
import AdStockChart, {
  STOCK_METRIC_LABEL,
  type StockMetric,
} from '@/components/meta-ads/AdStockChart';
import RetentionWaterfall from '@/components/meta-ads/RetentionWaterfall';
import VideoModal from '@/components/meta-ads/VideoModal';
import {
  facebookApi,
  type MetaCreativeDetail,
  type MetaCreativeTimeseries,
} from '@/lib/api/facebookApi';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
  hookRateBandClass,
  holdRateBandClass,
  thumbnailOrFallback,
} from '@/components/meta-ads/metaAdsUtils';

const DAY_OPTIONS = [1, 2, 3, 7, 14, 28] as const;

const CHART_METRIC_TABS: StockMetric[] = [
  'spend',
  'revenue',
  'leads',
  'purchases',
  'impressions',
  'clicks',
  'hook_rate',
  'hold_rate',
];

export default function CreativeDetailPage({
  params,
}: {
  params: { creativeId: string };
}) {
  const creativeId = Number(params.creativeId);
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6">
          {Number.isFinite(creativeId) ? (
            <CreativeDetailContent creativeId={creativeId} />
          ) : (
            <div className="text-sm text-gray-500">Invalid creative id.</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CreativeDetailContent({ creativeId }: { creativeId: number }) {
  const [days, setDays] = useState<number>(28);
  const [detail, setDetail] = useState<MetaCreativeDetail | null>(null);
  const [series, setSeries] = useState<MetaCreativeTimeseries | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [metric, setMetric] = useState<StockMetric>('spend');

  useEffect(() => {
    let active = true;
    setLoadingDetail(true);
    facebookApi
      .getMetaCreativeDetail(creativeId, days)
      .then((d) => active && setDetail(d))
      .catch(() => active && toast.error('Failed to load creative detail.'))
      .finally(() => active && setLoadingDetail(false));
    return () => {
      active = false;
    };
  }, [creativeId, days]);

  useEffect(() => {
    let active = true;
    setLoadingSeries(true);
    facebookApi
      .getMetaCreativeTimeseries(creativeId, days)
      .then((d) => active && setSeries(d))
      .catch(() => active && toast.error('Failed to load creative timeseries.'))
      .finally(() => active && setLoadingSeries(false));
    return () => {
      active = false;
    };
  }, [creativeId, days]);

  const currency = detail?.currency || 'USD';
  const thumb = thumbnailOrFallback(detail?.thumbnail_url);
  const isVideo = detail?.object_type === 'VIDEO' || !!detail?.video_id;

  const assetBodies = useMemo(() => {
    const spec = detail?.asset_feed_spec as
      | { bodies?: { text?: string }[]; titles?: { text?: string }[] }
      | undefined;
    return spec?.bodies?.map((b) => b.text || '').filter(Boolean) ?? [];
  }, [detail]);

  const assetTitles = useMemo(() => {
    const spec = detail?.asset_feed_spec as
      | { titles?: { text?: string }[] }
      | undefined;
    return spec?.titles?.map((t) => t.text || '').filter(Boolean) ?? [];
  }, [detail]);

  if (loadingDetail && !detail) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-gray-500">
        Creative not found or inaccessible.
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
        <Link
          href="/meta-ads?tab=creatives"
          className="hover:text-[#1a9ba3]"
        >
          Creatives
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
        <span className="truncate text-gray-700">
          {detail.title || detail.name || detail.meta_creative_id}
        </span>
      </nav>

      <header className="flex flex-wrap items-start gap-4">
        <Link
          href="/meta-ads"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
          aria-label="Back to Meta Ads"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1a9ba3]">
            Creative
          </div>
          <h1 className="mt-0.5 truncate text-lg font-semibold text-gray-900">
            {detail.title || detail.name || detail.meta_creative_id}
          </h1>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {detail.meta_creative_id}
            </span>
            {detail.object_type && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5">
                {detail.object_type}
              </span>
            )}
            {detail.call_to_action_type && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5">
                CTA · {detail.call_to_action_type}
              </span>
            )}
            <span className="rounded bg-gray-100 px-1.5 py-0.5">
              {detail.linked_ads_count} linked ads
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
            <div className="flex flex-wrap items-start gap-4">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group relative h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-shadow hover:border-[#3CCED7]/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/50"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#1a9ba3] shadow-xl transition-transform group-hover:scale-110">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </div>
                {isVideo && (
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Video className="mr-0.5 inline h-2.5 w-2.5 -mt-px" /> Video
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Primary body
                </div>
                <p className="mt-1 text-sm text-gray-800">
                  {detail.body || assetBodies[0] || (
                    <em className="text-gray-400">(no body text)</em>
                  )}
                </p>
                {assetTitles.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Dynamic titles ({assetTitles.length})
                    </div>
                    <ul className="mt-1 space-y-0.5 text-[12px] text-gray-700">
                      {assetTitles.map((t, i) => (
                        <li key={i} className="truncate">
                          · {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {assetBodies.length > 1 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Alternative bodies ({assetBodies.length})
                    </div>
                    <ul className="mt-1 space-y-1 text-[11px] text-gray-600">
                      {assetBodies.slice(1, 4).map((t, i) => (
                        <li
                          key={i}
                          className="line-clamp-2 rounded bg-gray-50 px-2 py-1"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

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
            ) : series && series.points.length > 0 ? (
              <AdStockChart
                points={series.points}
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
                Linked ads · {detail.linked_ads_count}
              </h3>
              <p className="text-[11px] text-gray-500">
                Ads that reference this creative in synced data
              </p>
            </div>
            {detail.linked_ads.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                No ads are linked to this creative in the current sync.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ad</th>
                      <th className="px-4 py-2 font-medium text-right">Spend</th>
                      <th className="px-4 py-2 font-medium text-right">Impr.</th>
                      <th className="px-4 py-2 font-medium text-right">Leads</th>
                      <th className="px-4 py-2 font-medium text-right">Purch.</th>
                      <th className="px-4 py-2 font-medium text-right">Revenue</th>
                      <th className="px-4 py-2 font-medium text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.linked_ads.map((ad) => (
                      <tr key={ad.id} className="align-top hover:bg-gray-50/60">
                        <td className="px-4 py-2">
                          <div className="max-w-[420px] truncate text-xs font-medium text-gray-900">
                            {ad.name || ad.meta_ad_id}
                          </div>
                          <div className="truncate text-[10px] text-gray-400">
                            {ad.campaign_name} · {ad.adset_name}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {formatCurrency(ad.spend, currency)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                          {formatNumber(ad.impressions)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {formatNumber(ad.leads)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {formatNumber(ad.purchases)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {Number(ad.revenue) > 0
                            ? formatCurrency(ad.revenue, currency)
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-800">
                          {Number(ad.roas) > 0
                            ? `${formatRatio(ad.roas)}x`
                            : '—'}
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

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Video retention waterfall
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500">
                How many viewers stayed at each milestone across {days} days.
              </p>
            </div>
            <RetentionWaterfall
              impressions={detail.aggregates.impressions}
              p25={detail.aggregates.video_p25}
              p50={detail.aggregates.video_p50}
              p75={detail.aggregates.video_p75}
              p100={detail.aggregates.video_p100}
            />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-[11px]">
              <RatioTile
                label="Hook rate"
                value={detail.aggregates.hook_rate}
                band={hookRateBandClass(detail.aggregates.hook_rate)}
              />
              <RatioTile
                label="Hold rate"
                value={detail.aggregates.hold_rate}
                band={holdRateBandClass(detail.aggregates.hold_rate)}
              />
              <RatioTile
                label="Completion"
                value={detail.aggregates.completion_rate}
                band={holdRateBandClass(detail.aggregates.completion_rate)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-[11px] text-gray-500">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Meta info
            </div>
            <dl className="space-y-1">
              <div className="flex justify-between gap-2">
                <dt>Creative ID</dt>
                <dd className="font-mono text-gray-700">
                  {detail.meta_creative_id}
                </dd>
              </div>
              {detail.video_id && (
                <div className="flex justify-between gap-2">
                  <dt>Video ID</dt>
                  <dd className="font-mono text-gray-700">{detail.video_id}</dd>
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
              href={`https://business.facebook.com/adsmanager/manage/ads`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
            >
              Open in Ads Manager <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </aside>
      </div>

      <VideoModal
        creativeId={creativeId}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={detail.title || detail.name || detail.meta_creative_id}
      />
    </div>
  );
}

function KpiCardsBlock({
  aggregates,
  currency,
  days,
  windowRange,
}: {
  aggregates: MetaCreativeDetail['aggregates'];
  currency: string;
  days: number;
  windowRange: { since: string; until: string };
}) {
  const tiles = [
    {
      label: 'Spend',
      value: formatCurrency(aggregates.spend, currency),
    },
    {
      label: 'Revenue',
      value: Number(aggregates.revenue) > 0
        ? formatCurrency(aggregates.revenue, currency)
        : '—',
    },
    {
      label: 'ROAS',
      value: Number(aggregates.roas) > 0
        ? `${formatRatio(aggregates.roas)}x`
        : '—',
    },
    {
      label: 'Leads',
      value: formatNumber(aggregates.leads),
    },
    {
      label: 'Purchases',
      value: formatNumber(aggregates.purchases),
    },
    {
      label: 'CPL',
      value: aggregates.leads > 0
        ? formatCurrency(aggregates.cpl, currency)
        : '—',
    },
    {
      label: 'CPA',
      value: aggregates.purchases > 0
        ? formatCurrency(aggregates.cpa, currency)
        : '—',
    },
    {
      label: 'CTR',
      value: formatPercent(aggregates.ctr),
    },
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

function RatioTile({
  label,
  value,
  band,
}: {
  label: string;
  value: string;
  band: string;
}) {
  const n = Number(value);
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 inline-flex rounded px-1.5 py-0.5 font-mono ${band}`}>
        {Number.isFinite(n) && n > 0 ? formatPercent(value) : '—'}
      </div>
    </div>
  );
}
