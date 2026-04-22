'use client';

import { Plus } from 'lucide-react';

interface Props {
  projectName?: string | null;
  onCreate: () => void;
}

export default function SpreadsheetsHeader({ projectName, onCreate }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900">Spreadsheets</h1>
        {projectName && (
          <p className="mt-0.5 text-xs text-gray-500">
            In <span className="font-medium text-gray-700">{projectName}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>New spreadsheet</span>
      </button>
    </header>
  );
}
