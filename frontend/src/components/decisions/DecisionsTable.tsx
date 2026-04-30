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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-5 py-2.5 w-16">#Seq</th>
            <th className="px-3 py-2.5">Title</th>
            <th className="px-3 py-2.5 w-40">Status</th>
            <th className="px-3 py-2.5 w-28">Risk</th>
            <th className="px-3 py-2.5 w-28">Updated</th>
            <th className="px-3 py-2.5 w-12" aria-hidden="true" />
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
  );
}
