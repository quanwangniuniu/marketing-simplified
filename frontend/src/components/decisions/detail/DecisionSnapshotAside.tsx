'use client';

interface Props {
  snapshot?: Record<string, unknown> | null;
  committedAt?: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DecisionSnapshotAside({ snapshot, committedAt }: Props) {
  if (!snapshot || Object.keys(snapshot).length === 0) return null;

  const entries = Object.entries(snapshot).filter(
    ([k]) => k !== 'timestamp'
  );

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Commit snapshot
      </h3>
      <p className="mb-3 text-[11px] text-gray-400">Captured on {formatDate(committedAt)}</p>
      <dl className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[88px_1fr] items-start gap-3 py-1">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {key.replace(/_/g, ' ')}
            </dt>
            <dd className="text-[12px] text-gray-900">
              {value === null
                ? '—'
                : typeof value === 'boolean'
                ? value ? 'Yes' : 'No'
                : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
