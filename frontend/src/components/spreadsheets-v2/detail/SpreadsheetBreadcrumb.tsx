'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  projectId: number | null;
  projectName?: string | null;
  spreadsheetName?: string | null;
}

export default function SpreadsheetBreadcrumb({ projectId, projectName, spreadsheetName }: Props) {
  const listHref = projectId
    ? `/spreadsheets?project_id=${projectId}`
    : '/spreadsheets';
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-gray-500"
    >
      <Link
        href={listHref}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-gray-50 hover:text-gray-900"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" />
        <span>Spreadsheets</span>
      </Link>
      {projectName && (
        <>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500">{projectName}</span>
        </>
      )}
      {spreadsheetName && (
        <>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-900 line-clamp-1 max-w-[40ch]">
            {spreadsheetName}
          </span>
        </>
      )}
    </nav>
  );
}
