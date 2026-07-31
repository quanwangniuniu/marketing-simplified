export function formatCurrency(value: string | number, currency: string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

export function formatNumber(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatRatio(value: string, digits = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function formatPercent(value: string | number, digits = 2): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

/** Prefer finished_at, then started_at, then connection-level last_synced_at. */
export function resolveLastSyncedAt(sources: {
  finishedAt?: string | null;
  startedAt?: string | null;
  connectionLastSyncedAt?: string | null;
}): string | null {
  return (
    sources.finishedAt ||
    sources.startedAt ||
    sources.connectionLastSyncedAt ||
    null
  );
}

/** True when `run` is newer than the sync that was visible before Refresh. */
export function isNewerSyncRun(
  run: { id: number; started_at: string },
  baselineRunId: number | null,
  baselineStartedAt: string | null
): boolean {
  if (baselineRunId != null && run.id !== baselineRunId) return true;
  if (baselineRunId == null && baselineStartedAt == null) return true;
  if (baselineStartedAt != null && run.started_at > baselineStartedAt) return true;
  return false;
}

/** Human-readable tooltip / title text for last sync time (MED-246). */
export function formatLastSyncedTooltip(
  iso: string | null | undefined,
  locale = 'en-US'
): string {
  if (!iso) return 'Not synced yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not synced yet';
  return `Last synced: ${parsed.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;
}

export function hookRateBandClass(rate: string | number): string {
  const n = typeof rate === 'string' ? Number(rate) : rate;
  if (!Number.isFinite(n) || n <= 0) return 'bg-gray-100 text-gray-400';
  if (n >= 10) return 'bg-[#3CCED7]/20 text-[#1a9ba3]';
  if (n >= 5) return 'bg-[#A6E661]/20 text-[#3d6b00]';
  if (n >= 2) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function holdRateBandClass(rate: string | number): string {
  const n = typeof rate === 'string' ? Number(rate) : rate;
  if (!Number.isFinite(n) || n <= 0) return 'bg-gray-100 text-gray-400';
  if (n >= 40) return 'bg-[#3CCED7]/20 text-[#1a9ba3]';
  if (n >= 25) return 'bg-[#A6E661]/20 text-[#3d6b00]';
  if (n >= 15) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function thumbnailOrFallback(url: string | null | undefined): string | null {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  if (!url.startsWith('http')) return null;
  return url;
}
