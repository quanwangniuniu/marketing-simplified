'use client';

import { Trash2 } from 'lucide-react';
import AdDraftStatusPill from '../pills/AdDraftStatusPill';
import type { GoogleAd } from '@/lib/api/googleAdsApi';

interface Props {
  ads: GoogleAd[];
  loading?: boolean;
  onRowClick: (id: number) => void;
  onDelete: (id: number) => void;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  PAUSED: 'Paused',
};

const TYPE_LABEL: Record<string, string> = {
  RESPONSIVE_SEARCH_AD: 'Responsive Search',
  RESPONSIVE_DISPLAY_AD: 'Responsive Display',
  VIDEO_RESPONSIVE_AD: 'Video Responsive',
  VIDEO_AD: 'Video',
  IMAGE_AD: 'Image',
};

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AdTableV2({ ads, loading, onRowClick, onDelete }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-gray-100 text-xs text-gray-400">
        Loading ads…
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-gray-100 text-center">
        <div className="text-sm font-medium text-gray-900">No Google Ads yet</div>
        <p className="mt-1 text-xs text-gray-500">
          Click <span className="font-medium">New Ad</span> above to create your first ad.
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
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">Type</th>
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">Created</th>
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">ID</th>
            <th className="w-16 px-4 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ads.map((ad) => (
            <tr
              key={ad.id}
              onClick={() => onRowClick(ad.id!)}
              className="group cursor-pointer transition hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {ad.name || 'Untitled ad'}
              </td>
              <td className="px-4 py-3">
                <AdDraftStatusPill
                  platform="google_ads"
                  status={ad.status as any}
                  statusLabel={ad.status ? STATUS_LABEL[ad.status] ?? ad.status : undefined}
                />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {ad.type ? TYPE_LABEL[ad.type] ?? ad.type.replace(/_/g, ' ') : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{formatDate(ad.created_at)}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{ad.id}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(ad.id!);
                  }}
                  aria-label="Delete ad"
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
