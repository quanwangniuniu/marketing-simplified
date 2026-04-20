import type { ReactNode } from 'react';

type Accent = 'default' | 'emerald' | 'rose' | 'amber';

const ACCENT: Record<Accent, string> = {
  default: 'bg-gray-50 text-gray-900',
  emerald: 'bg-emerald-50 text-emerald-800',
  rose: 'bg-rose-50 text-rose-800',
  amber: 'bg-amber-50 text-amber-800',
};

interface Props {
  label: string;
  value: ReactNode;
  accent?: Accent;
}

export default function KPICard({ label, value, accent = 'default' }: Props) {
  return (
    <div className={`rounded-lg border border-gray-100 px-3 py-2 ${ACCENT[accent]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-base font-semibold">{value ?? '—'}</div>
    </div>
  );
}
