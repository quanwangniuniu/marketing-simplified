'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Play, Search, Video } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  facebookApi,
  type MetaAdInsightTimeseries,
  type MetaAdPerformanceRow,
} from '@/lib/api/facebookApi';
import AdStockChart, { STOCK_METRIC_LABEL, type StockMetric } from './AdStockChart';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
  hookRateBandClass,
  thumbnailOrFallback,
} from './metaAdsUtils';

const STOCK_METRIC_TABS: StockMetric[] = [
  'spend',
  'revenue',
  'leads',
  'purchases',
  'impressions',
  'clicks',
  'hook_rate',
  'hold_rate',
];

export default function AdsDrilldownPanel({
  adAccountId,
  days,
  currency,
}: {
  adAccountId: number;
  days: number;
  currency: string;
}) {
  const [rows, setRows] = useState<MetaAdPerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedAdId, setSelectedAdId] = useState<number | null>(null);
  const [series, setSeries] = useState<MetaAdInsightTimeseries | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [metric, setMetric] = useState<StockMetric>('spend');
  const [compareMetric, setCompareMetric] = useState<StockMetric | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    facebookApi
      .getMetaAdPerformance(adAccountId, days)
      .then((d) => {
        if (!active) return;
        setRows(d.ads);
        // auto-select first ad with spend on first load or when data changes
        const firstWithSpend = d.ads.find((a) => Number(a.spend) > 0);
        if (firstWithSpend) {
          setSelectedAdId((prev) =>
            prev && d.ads.some((a) => a.id === prev) ? prev : firstWithSpend.id
          );
        } else if (d.ads.length > 0) {
          setSelectedAdId(d.ads[0].id);
        } else {
          setSelectedAdId(null);
        }
      })
      .catch(() => {
        if (!active) return;
        toast.error('Failed to load ad-level performance.');
      })
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [adAccountId, days]);

  useEffect(() => {
    if (!selectedAdId) return;
    let active = true;
    setSeriesLoading(true);
    facebookApi
      .getMetaAdInsightTimeseries(adAccountId, selectedAdId, days)
      .then((d) => active && setSeries(d))
      .catch(() => {
        if (!active) return;
        toast.error('Failed to load ad insight time series.');
      })
      .finally(() => setSeriesLoading(false));
    return () => {
      active = false;
    };
  }, [adAccountId, selectedAdId, days]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.meta_ad_id?.toLowerCase().includes(q) ||
        r.campaign_name?.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const selectedAd = useMemo(
    () => rows.find((r) => r.id === selectedAdId) || null,
    [rows, selectedAdId]
  );

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        No ads with performance data in the selected window.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ads, campaigns..."
              className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
            />
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">
            {filteredRows.length} / {rows.length} ads — click to drill in
          </div>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {filteredRows.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              No ads match your search.
            </div>
          ) : (
            filteredRows.slice(0, 60).map((ad) => (
              <AdPickRow
                key={ad.id}
                ad={ad}
                currency={currency}
                active={ad.id === selectedAdId}
                onClick={() => setSelectedAdId(ad.id)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        {!selectedAd ? (
          <div className="flex h-60 items-center justify-center text-sm text-gray-400">
            Pick an ad on the left to see its daily trend.
          </div>
        ) : (
          <>
            <AdDetailHeader ad={selectedAd} currency={currency} />

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {STOCK_METRIC_TABS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    metric === m
                      ? 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {STOCK_METRIC_LABEL[m]}
                </button>
              ))}
              <span className="ml-2 flex items-center gap-1 text-[11px] text-gray-500">
                Compare
                <select
                  value={compareMetric ?? ''}
                  onChange={(e) =>
                    setCompareMetric((e.target.value as StockMetric) || null)
                  }
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
                >
                  <option value="">(none)</option>
                  {STOCK_METRIC_TABS.filter((m) => m !== metric).map((m) => (
                    <option key={m} value={m}>
                      {STOCK_METRIC_LABEL[m]}
                    </option>
                  ))}
                </select>
              </span>
            </div>

            <div className="mt-3">
              {seriesLoading && !series ? (
                <Skeleton className="h-80 w-full" />
              ) : series ? (
                <>
                  <AdStockChart
                    points={series.points}
                    metric={metric}
                    compareMetric={compareMetric}
                    currency={currency}
                    height={320}
                  />
                  <p className="mt-1.5 text-[10px] text-gray-400">
                    Drag the handles at the bottom of the chart to zoom into a specific date window.
                    Trailing window: {series.window.since} → {series.window.until}.
                  </p>
                </>
              ) : (
                <div className="flex h-60 items-center justify-center text-sm text-gray-400">
                  No time-series data for this ad.
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function AdPickRow({
  ad,
  currency,
  active,
  onClick,
}: {
  ad: MetaAdPerformanceRow;
  currency: string;
  active: boolean;
  onClick: () => void;
}) {
  const thumb = thumbnailOrFallback(ad.creative?.thumbnail_url ?? null);
  const isVideo = ad.creative?.object_type === 'VIDEO' || !!ad.creative?.video_id;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 border-b border-gray-50 px-3 py-2 text-left transition-colors ${
        active ? 'bg-[#3CCED7]/10 border-l-2 border-l-[#3CCED7]' : 'hover:bg-gray-50'
      }`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
        {isVideo && (
          <span className="absolute right-0 top-0 rounded-bl-md bg-black/60 px-0.5 text-white">
            <Play className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-gray-900">
          {ad.name || ad.meta_ad_id}
        </div>
        <div className="truncate text-[10px] text-gray-400">
          {ad.campaign_name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px]">
          <span className="font-mono text-gray-700">
            {formatCurrency(ad.spend, currency)}
          </span>
          <span
            className={`rounded px-1 py-0.5 font-mono ${hookRateBandClass(ad.hook_rate)}`}
          >
            {Number(ad.hook_rate) > 0 ? formatPercent(ad.hook_rate) : '—'}
          </span>
        </div>
      </div>
    </button>
  );
}

function AdDetailHeader({
  ad,
  currency,
}: {
  ad: MetaAdPerformanceRow;
  currency: string;
}) {
  const thumb = thumbnailOrFallback(ad.creative?.thumbnail_url ?? null);
  const isVideo = ad.creative?.object_type === 'VIDEO' || !!ad.creative?.video_id;
  const kpis = [
    { label: 'Spend', value: formatCurrency(ad.spend, currency) },
    {
      label: 'Revenue',
      value: Number(ad.revenue) > 0 ? formatCurrency(ad.revenue, currency) : '—',
    },
    { label: 'ROAS', value: Number(ad.roas) > 0 ? `${formatRatio(ad.roas)}x` : '—' },
    { label: 'Leads', value: formatNumber(ad.leads) },
    { label: 'Purchases', value: formatNumber(ad.purchases) },
    {
      label: 'Hook rate',
      value: Number(ad.hook_rate) > 0 ? formatPercent(ad.hook_rate) : '—',
    },
    {
      label: 'Hold rate',
      value: Number(ad.hold_rate) > 0 ? formatPercent(ad.hold_rate) : '—',
    },
  ];
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        {isVideo && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white">
            <Video className="mr-0.5 inline h-2.5 w-2.5 -mt-px" /> Video
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {ad.name || ad.meta_ad_id}
          </h3>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600">
            {ad.effective_status}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-gray-500">
          {ad.campaign_name} · {ad.adset_name}
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-gray-500">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
            Ad: {ad.meta_ad_id}
          </span>
          {ad.creative && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              Creative: {ad.creative.meta_creative_id}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-md border border-gray-100 bg-gray-50/60 px-2 py-1.5"
            >
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                {k.label}
              </div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-gray-900">
                {k.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
