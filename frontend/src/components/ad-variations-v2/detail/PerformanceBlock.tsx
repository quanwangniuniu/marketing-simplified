import type { VariationPerformanceEntry } from '@/types/adVariation';
import KPICard from './KPICard';

interface Props {
  entries: VariationPerformanceEntry[];
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtInt(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '—';
  return Math.round(n).toLocaleString();
}

function fmtPct(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '—';
  return `${n.toFixed(2)}%`;
}

function fmtCurrency(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '—';
  return `$${n.toFixed(2)}`;
}

function firstDefined(metrics: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (metrics[key] !== undefined && metrics[key] !== null) return metrics[key];
  }
  return undefined;
}

export default function PerformanceBlock({ entries }: Props) {
  const latest = entries.reduce<VariationPerformanceEntry | null>((acc, e) => {
    if (!acc) return e;
    return new Date(e.recordedAt).getTime() > new Date(acc.recordedAt).getTime() ? e : acc;
  }, null);
  const metrics = latest?.metrics ?? {};

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Performance
        </h2>
        <span className="text-[11px] text-gray-400">
          {entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KPICard label="CTR" value={fmtPct(firstDefined(metrics, ['ctr', 'clickThroughRate']))} accent="emerald" />
        <KPICard label="CPA" value={fmtCurrency(firstDefined(metrics, ['cpa', 'costPerResult']))} accent="rose" />
        <KPICard label="Results" value={fmtInt(firstDefined(metrics, ['results', 'conversions', 'leads']))} />
        <KPICard label="Spend" value={fmtCurrency(firstDefined(metrics, ['spend', 'cost']))} accent="amber" />
        <KPICard label="Reach" value={fmtInt(firstDefined(metrics, ['reach']))} />
        <KPICard label="Impressions" value={fmtInt(firstDefined(metrics, ['impressions']))} />
      </div>

      {entries.length > 0 && (
        <ol className="mt-5 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <time className="text-xs text-gray-500">
                  {new Date(e.recordedAt).toLocaleString()}
                </time>
                {e.trendIndicator && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {e.trendIndicator}
                  </span>
                )}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {Object.entries(e.metrics || {}).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-2.5 py-1 text-xs"
                  >
                    <span className="uppercase tracking-wide text-gray-500">{k}</span>
                    <span className="font-semibold text-gray-900">{String(v)}</span>
                  </div>
                ))}
              </div>
              {e.observations && (
                <p className="mt-2 text-[11px] text-gray-500">{e.observations}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
