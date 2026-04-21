'use client';

import { FilePenLine, Loader2 } from 'lucide-react';

interface Props {
  projectName?: string | null;
  decisionCount: number;
  role?: string | null;
  canCreate: boolean;
  creating: boolean;
  onCreate: () => void;
}

export default function DecisionsCardHeader({
  projectName,
  decisionCount,
  role,
  canCreate,
  creating,
  onCreate,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-gray-900">
          {projectName || 'No project selected'}
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {decisionCount} decision{decisionCount === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {role && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
            {role}
          </span>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePenLine className="h-4 w-4" />}
            {creating ? 'Creating…' : 'Create Decision'}
          </button>
        )}
      </div>
    </div>
  );
}
