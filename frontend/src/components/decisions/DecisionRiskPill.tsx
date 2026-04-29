'use client';

import type { DecisionRiskLevel } from '@/types/decision';

const RISK_TOKEN: Record<DecisionRiskLevel, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Low' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Medium' },
  HIGH: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'High' },
};

export default function DecisionRiskPill({ risk }: { risk?: DecisionRiskLevel | null }) {
  if (!risk) {
    return <span className="text-gray-400">—</span>;
  }
  const token = RISK_TOKEN[risk];
  if (!token) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${token.bg} ${token.text}`}
    >
      {token.label}
    </span>
  );
}
