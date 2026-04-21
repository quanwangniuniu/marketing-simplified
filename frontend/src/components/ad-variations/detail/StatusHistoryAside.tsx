import type { VariationStatusHistory } from '@/types/adVariation';

interface Props {
  entries: VariationStatusHistory[];
}

export default function StatusHistoryAside({ entries }: Props) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Status History
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400">No status changes yet.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="border-l-2 border-gray-200 pl-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-gray-700">
                  <span className="font-medium">{e.fromStatus}</span>
                  <span className="mx-1 text-gray-400">→</span>
                  <span className="font-semibold">{e.toStatus}</span>
                </span>
                <time className="shrink-0 text-[11px] text-gray-400">
                  {new Date(e.changedAt).toLocaleDateString()}
                </time>
              </div>
              {e.reason && <p className="mt-0.5 text-[11px] text-gray-500">{e.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
