'use client';

import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown } from 'lucide-react';

const PRIORITY_TOKEN: Record<
  string,
  { bg: string; text: string; label: string; Icon: typeof Minus }
> = {
  HIGHEST: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Highest', Icon: ChevronsUp },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'High', Icon: ChevronUp },
  MEDIUM: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Medium', Icon: Minus },
  LOW: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Low', Icon: ChevronDown },
  LOWEST: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Lowest', Icon: ChevronsDown },
};

export default function PriorityPill({ priority }: { priority?: string }) {
  const token = (priority && PRIORITY_TOKEN[priority]) || PRIORITY_TOKEN.MEDIUM;
  const { Icon } = token;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${token.bg} ${token.text}`}
    >
      <Icon className="h-3 w-3" />
      {token.label}
    </span>
  );
}

export { PRIORITY_TOKEN };
