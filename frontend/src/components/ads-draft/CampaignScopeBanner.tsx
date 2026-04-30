'use client';

import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useProjectStore } from '@/lib/projectStore';

interface Props {
  className?: string;
}

export default function CampaignScopeBanner({ className = '' }: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const projects = useProjectStore((state) => state.projects);

  const cid = sp?.get('cid') ?? null;

  const projectName = useMemo(() => {
    if (!cid) return null;
    const match = projects.find((p) => String(p.id) === cid);
    return match?.name ?? `Project #${cid}`;
  }, [cid, projects]);

  if (!cid) return null;

  const clear = () => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    next.delete('cid');
    const query = next.toString();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-100 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          Scoped to
        </span>
        <span className="truncate text-sm text-gray-900">{projectName}</span>
      </div>
      <button
        type="button"
        onClick={clear}
        aria-label="Clear campaign scope"
        title="Clear campaign scope"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
