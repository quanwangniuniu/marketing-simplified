'use client';

const STATUS_TOKEN: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  SUBMITTED: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Submitted' },
  UNDER_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Under Review' },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Rejected' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
  LOCKED: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Locked' },
};

export default function StatusPill({ status }: { status?: string }) {
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

export { STATUS_TOKEN };
