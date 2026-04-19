'use client';

import type { DecisionStatus } from '@/types/decision';

const STATUS_TOKEN: Record<DecisionStatus, { bg: string; text: string; label: string }> = {
  PREDRAFT: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Pre-draft' },
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  AWAITING_APPROVAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Awaiting Approval' },
  COMMITTED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Committed' },
  REVIEWED: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Reviewed' },
  ARCHIVED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Archived' },
};

export default function DecisionStatusPill({ status }: { status?: DecisionStatus | null }) {
  const token = (status && STATUS_TOKEN[status]) || STATUS_TOKEN.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${token.bg} ${token.text}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {token.label}
    </span>
  );
}

export { STATUS_TOKEN as DECISION_STATUS_TOKEN };
