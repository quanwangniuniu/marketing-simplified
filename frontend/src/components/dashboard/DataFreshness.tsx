'use client';

import type { DataSourceStatus } from '@/lib/mock/dashboardMock';

interface DataFreshnessProps {
  sources: DataSourceStatus[];
}

const statusDot: Record<string, string> = {
  connected: 'bg-emerald-500',
  warning: 'bg-amber-500',
  disconnected: 'bg-red-500',
};

const platformLabels: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  slack: 'Slack',
};

function formatSyncTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function DataFreshness({ sources }: DataFreshnessProps) {
  return (
    <div className="flex items-center gap-4 px-1">
      {sources.map((s) => (
        <div key={s.platform} className="flex items-center gap-1.5 text-[11px]">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot[s.status]}`} />
          <span className="text-gray-500">{platformLabels[s.platform] || s.name}</span>
          <span className="text-gray-300">{formatSyncTime(s.lastSync)}</span>
        </div>
      ))}
    </div>
  );
}
