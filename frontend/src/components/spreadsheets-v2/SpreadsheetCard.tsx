'use client';

import Link from 'next/link';
import { Trash2, CalendarDays, FileSpreadsheet } from 'lucide-react';
import type { SpreadsheetData } from '@/types/spreadsheet';

interface Props {
  spreadsheet: SpreadsheetData;
  projectId: number;
  onRequestDelete?: (spreadsheet: SpreadsheetData) => void;
}

function formatRelative(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SpreadsheetCard({ spreadsheet, projectId, onRequestDelete }: Props) {
  return (
    <div className="group relative rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-200">
      <Link
        href={`/spreadsheets-v2/${spreadsheet.id}?project_id=${projectId}`}
        className="block"
        aria-label={`Open ${spreadsheet.name}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3CCED7]/10 to-[#A6E661]/10 text-[#0E8A96]">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-[15px] font-semibold text-gray-900 group-hover:text-gray-950">
              {spreadsheet.name || 'Untitled spreadsheet'}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                Updated {formatRelative(spreadsheet.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </Link>
      {onRequestDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(spreadsheet);
          }}
          aria-label={`Delete ${spreadsheet.name}`}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
