'use client';

import { Trash2 } from 'lucide-react';
import AdDraftStatusPill from '../pills/AdDraftStatusPill';
import type { FacebookStatus } from '../types';

export interface AdCreativeRow {
  id: string;
  name: string;
  status: FacebookStatus | string | null;
  call_to_action_type?: string | null;
}

interface Props {
  creatives: AdCreativeRow[];
  loading?: boolean;
  onRowClick: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  IN_PROCESS: 'In process',
  WITH_ISSUES: 'With issues',
  DELETED: 'Deleted',
};

const humanizeCta = (value?: string | null) => {
  if (!value || value === 'NO_BUTTON') return '—';
  return value
    .split('_')
    .map((s) => (s.length === 0 ? s : s[0] + s.slice(1).toLowerCase()))
    .join(' ');
};

export default function AdCreativeTableV2({ creatives, loading, onRowClick, onDelete }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-gray-100">
        <div className="text-xs text-gray-400">Loading ad creatives…</div>
      </div>
    );
  }

  if (creatives.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-gray-100 text-center">
        <div className="text-sm font-medium text-gray-900">No ad creatives yet</div>
        <p className="mt-1 text-xs text-gray-500">
          Click <span className="font-medium">New Ad Creative</span> above to create your first one.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">Name</th>
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">Status</th>
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">Call to action</th>
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">ID</th>
            <th className="w-16 px-4 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {creatives.map((creative) => (
            <tr
              key={creative.id}
              onClick={() => onRowClick(creative.id)}
              className="group cursor-pointer transition hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {creative.name || 'Unnamed creative'}
              </td>
              <td className="px-4 py-3">
                <AdDraftStatusPill
                  platform="facebook_meta"
                  status={creative.status ?? undefined}
                  statusLabel={
                    creative.status
                      ? STATUS_LABEL[creative.status as string] ?? String(creative.status)
                      : undefined
                  }
                />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {humanizeCta(creative.call_to_action_type)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{creative.id}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(creative.id);
                  }}
                  aria-label="Delete ad creative"
                  title="Delete"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
