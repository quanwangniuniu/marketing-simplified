'use client';

interface StateTransition {
  id: number;
  fromStatus?: string;
  toStatus?: string;
  changedAt?: string;
  changedBy?: number | null;
}

interface Props {
  transitions: StateTransition[];
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DecisionActivityAside({ transitions }: Props) {
  if (!transitions || transitions.length === 0) return null;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Activity
      </h3>
      <ul className="space-y-3">
        {transitions.map((t) => (
          <li key={t.id} className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-gray-900">
                {t.fromStatus} → <span className="font-medium">{t.toStatus}</span>
              </div>
              <div className="text-[11px] text-gray-500">
                {formatDate(t.changedAt)}
                {t.changedBy != null && <span> · User #{t.changedBy}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
