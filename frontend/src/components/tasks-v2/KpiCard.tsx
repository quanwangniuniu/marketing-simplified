'use client';

import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  icon: LucideIcon;
  iconGradient: string;
  value: number | string;
  label: string;
  hint?: string;
}

export default function KpiCard({
  icon: Icon,
  iconGradient,
  value,
  label,
  hint,
}: KpiCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:ring-gray-200">
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm ${iconGradient}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-semibold leading-none text-gray-900">{value}</div>
        <div className="mt-1 text-xs font-medium text-gray-700">{label}</div>
        {hint ? <div className="text-[11px] text-gray-400">{hint}</div> : null}
      </div>
    </div>
  );
}
