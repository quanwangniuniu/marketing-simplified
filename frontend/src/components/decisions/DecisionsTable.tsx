'use client';

import { Trash2 } from 'lucide-react';
import DecisionStatusPill from './DecisionStatusPill';
import DecisionRiskPill from './DecisionRiskPill';
import type { DecisionListItem } from '@/types/decision';

function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  const diffMs = Date.now() - parsed.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  items: DecisionListItem[];
  onRowClick: (id: number) => void;
  onDelete: (item: DecisionListItem) => void;
  canDelete: boolean;
}

export default function DecisionsTable({ items, onRowClick, onDelete, canDelete }: Props) {
  return (
    <>
      <div className="divide-y divide-gray-100 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="p-3">
            <button
              type="button"
              onClick={() => onRowClick(item.id)}
              className="block w-full rounded-lg border border-gray-100 bg-white p-3 text-left transition active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-gray-500">
                    #{item.projectSeq ?? '—'}
                  </div>
                  <div className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-snug text-gray-900">
                    {item.title?.trim() || 'Untitled decision'}
                  </div>
                </div>
                <div className="shrink-0 text-[12px] text-gray-500">
                  {formatRelative(item.updatedAt ?? item.lastEditedAt ?? item.createdAt)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DecisionStatusPill status={item.status} />
                <DecisionRiskPill risk={item.riskLevel ?? null} />
              </div>
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                aria-label={`Delete decision ${item.title ?? '#' + item.projectSeq}`}
                title="Delete"
                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-16 px-5 py-2.5">#Seq</th>
              <th className="px-3 py-2.5">Title</th>
              <th className="w-40 px-3 py-2.5">Status</th>
              <th className="w-28 px-3 py-2.5">Risk</th>
              <th className="w-28 px-3 py-2.5">Updated</th>
              <th className="w-12 px-3 py-2.5" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick(item.id)}
                className="group cursor-pointer border-b border-gray-50 text-gray-900 transition last:border-0 hover:bg-gray-50/60"
              >
                <td className="px-5 py-3 text-[12px] text-gray-500">#{item.projectSeq ?? '—'}</td>
                <td className="px-3 py-3 font-medium text-gray-900">
                  <span className="line-clamp-1">{item.title?.trim() || 'Untitled decision'}</span>
                </td>
                <td className="px-3 py-3">
                  <DecisionStatusPill status={item.status} />
                </td>
                <td className="px-3 py-3">
                  <DecisionRiskPill risk={item.riskLevel ?? null} />
                </td>
                <td className="px-3 py-3 text-[12px] text-gray-500">
                  {formatRelative(item.updatedAt ?? item.lastEditedAt ?? item.createdAt)}
                </td>
                <td className="px-3 py-3 text-right">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                      aria-label={`Delete decision ${item.title ?? '#' + item.projectSeq}`}
                      title="Delete"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
