'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MetaAdInsightPoint } from '@/lib/api/facebookApi';
import { formatCurrency, formatNumber, formatPercent } from './metaAdsUtils';

export type StockMetric =
  | 'spend'
  | 'impressions'
  | 'clicks'
  | 'leads'
  | 'purchases'
  | 'revenue'
  | 'hook_rate'
  | 'hold_rate';

export const STOCK_METRIC_LABEL: Record<StockMetric, string> = {
  spend: 'Spend',
  impressions: 'Impressions',
  clicks: 'Clicks',
  leads: 'Leads',
  purchases: 'Purchases',
  revenue: 'Revenue',
  hook_rate: 'Hook rate %',
  hold_rate: 'Hold rate %',
};

const CURRENCY_METRICS: StockMetric[] = ['spend', 'revenue'];
const PERCENT_METRICS: StockMetric[] = ['hook_rate', 'hold_rate'];

export default function AdStockChart({
  points,
  metric,
  currency,
  compareMetric,
  height = 320,
}: {
  points: MetaAdInsightPoint[];
  metric: StockMetric;
  currency: string;
  compareMetric?: StockMetric | null;
  height?: number;
}) {
  const data = useMemo(() => {
    return points.map((p) => ({
      date: p.date,
      short: p.date.slice(5), // MM-DD
      spend: Number(p.spend),
      impressions: p.impressions,
      clicks: p.clicks,
      leads: p.leads,
      purchases: p.purchases,
      revenue: Number(p.revenue),
      hook_rate: Number(p.hook_rate),
      hold_rate: Number(p.hold_rate),
    }));
  }, [points]);

  const latest = data.length > 0 ? data[data.length - 1][metric] : 0;
  const earliest = data.length > 0 ? data[0][metric] : 0;
  const isUp = latest >= earliest;
  const stroke = isUp ? '#3CCED7' : '#f97a68';
  const fillId = `stockGrad-${metric}`;

  const formatValue = (v: number | string) => {
    if (CURRENCY_METRICS.includes(metric)) return formatCurrency(v as number, currency);
    if (PERCENT_METRICS.includes(metric)) return formatPercent(v as number);
    return formatNumber(v as number);
  };

  return (
    <div className="rounded-lg border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-2">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f6" vertical={false} />
          <XAxis
            dataKey="short"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            minTickGap={18}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v) => {
              if (CURRENCY_METRICS.includes(metric)) {
                const n = Number(v);
                if (n >= 1000) return `${currency === 'USD' ? '$' : ''}${(n / 1000).toFixed(1)}k`;
                return formatCurrency(n, currency);
              }
              if (PERCENT_METRICS.includes(metric)) return `${Number(v).toFixed(0)}%`;
              const n = Number(v);
              if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
              return String(n);
            }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload;
              return p?.date ?? label;
            }}
            formatter={(v: unknown, key) => {
              const mk = key as StockMetric;
              const n = typeof v === 'number' || typeof v === 'string' ? v : 0;
              if (CURRENCY_METRICS.includes(mk)) return [formatCurrency(n as number, currency), STOCK_METRIC_LABEL[mk]];
              if (PERCENT_METRICS.includes(mk)) return [formatPercent(n as number), STOCK_METRIC_LABEL[mk]];
              return [formatNumber(n as number), STOCK_METRIC_LABEL[mk]];
            }}
          />
          {data.length > 0 && (
            <ReferenceLine
              y={latest}
              stroke={stroke}
              strokeDasharray="2 4"
              strokeOpacity={0.4}
              ifOverflow="extendDomain"
            />
          )}
          <Area
            type="monotone"
            dataKey={metric}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          {compareMetric && compareMetric !== metric && (
            <Line
              yAxisId={0}
              type="monotone"
              dataKey={compareMetric}
              stroke="#94a3b8"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
          {compareMetric && compareMetric !== metric && <Legend iconSize={10} />}
          {data.length >= 5 && (
            <Brush
              dataKey="short"
              height={28}
              stroke="#cbd5e1"
              fill="#f8fafc"
              travellerWidth={8}
              tickFormatter={() => ''}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-between px-2 text-[11px] text-gray-500">
        <span>
          Latest: <span className="font-mono text-gray-900">{formatValue(latest)}</span>
        </span>
        <span className={isUp ? 'text-[#1a9ba3]' : 'text-red-500'}>
          {isUp ? '▲' : '▼'} {Math.abs(latest - earliest) > 0.0001 ? formatValue(Math.abs(latest - earliest)) : '—'}
        </span>
      </div>
    </div>
  );
}
