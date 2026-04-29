'use client';

import type { DecisionSignal } from '@/types/decision';

interface Props {
  signals: DecisionSignal[];
}

export default function DecisionExecutionSummarySection({ signals }: Props) {
  return (
    <section
      id="decision-section-execution"
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Execution summary
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Outcome signals captured for this decision.
        </p>
      </div>
      {signals.length === 0 ? (
        <p className="text-xs text-gray-400">No outcome signals yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {signals.map((signal) => (
            <li key={signal.id} className="py-2.5">
              <div className="text-sm text-gray-900">
                {signal.displayTextOverride || signal.displayText || '—'}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                {signal.metric} · {signal.movement} · {signal.period}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
