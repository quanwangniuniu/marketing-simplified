'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { CampaignTemplate } from '@/types/campaign';
import SharingScopePill from '../pills/SharingScopePill';

interface Props {
  templates: CampaignTemplate[];
  loading: boolean;
  errorMessage: string | null;
  onRowClick?: (template: CampaignTemplate) => void;
  showArchived?: boolean;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function TemplateListTable({
  templates,
  loading,
  errorMessage,
  onRowClick,
  showArchived = false,
}: Props) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading templates…
        </div>
      ) : errorMessage ? (
        <div className="px-6 py-12 text-center text-sm text-rose-600">{errorMessage}</div>
      ) : templates.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-900">
            {showArchived ? 'No archived templates' : 'No templates yet'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {showArchived
              ? 'Archived templates will appear here.'
              : 'Open a campaign and choose '}
            {!showArchived && (
              <span className="font-medium text-gray-700">Save as Template</span>
            )}
            {!showArchived && ' to create one.'}
          </p>
        </div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-10 px-4 py-3 text-left"></th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Scope</th>
              <th className="px-4 py-3 text-left">Creator</th>
              <th className="px-4 py-3 text-left">Version</th>
              <th className="px-4 py-3 text-left">Uses</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {templates.map((t) => {
              const dot = t.is_archived
                ? 'bg-gray-200'
                : t.sharing_scope === 'PERSONAL'
                ? 'bg-gray-300'
                : t.sharing_scope === 'TEAM'
                ? 'bg-[#3CCED7]'
                : 'bg-[#A6E661]';
              return (
                <tr
                  key={t.id}
                  className={`cursor-pointer transition hover:bg-gray-50/80 ${t.is_archived ? 'opacity-60 italic' : ''}`}
                  onClick={() =>
                    onRowClick
                      ? onRowClick(t)
                      : router.push(`/campaigns/templates/${t.id}`)
                  }
                >
                  <td className="px-4 py-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.name || 'Untitled'}</div>
                    {t.description ? (
                      <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">{t.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <SharingScopePill scope={t.sharing_scope} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {t.creator?.username ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px]">
                      v{t.version_number}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{t.usage_count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
