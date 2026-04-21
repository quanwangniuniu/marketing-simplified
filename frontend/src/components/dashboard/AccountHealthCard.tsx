'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Link2 } from 'lucide-react';
import type { AccountHealth, DataSourceStatus } from '@/lib/mock/dashboardMock';

interface AccountHealthCardProps {
  health: AccountHealth;
  dataSources: DataSourceStatus[];
}

const statusDot: Record<string, string> = {
  connected: 'bg-emerald-500',
  warning: 'bg-amber-500',
  disconnected: 'bg-red-500',
};

const statusLabel: Record<string, string> = {
  connected: 'Connected',
  warning: 'Delayed',
  disconnected: 'Offline',
};

const healthColor: Record<string, string> = {
  healthy: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-red-600',
};

const healthDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'from-emerald-400 to-emerald-500';
  if (score >= 60) return 'from-amber-400 to-amber-500';
  return 'from-red-400 to-red-500';
}

function formatSyncTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function AccountHealthCard({ health, dataSources }: AccountHealthCardProps) {
  return (
    <Card className="border-[0.5px] border-gray-200 bg-white shadow-none">
      <CardContent className="p-4 space-y-4">
        {/* Data Sources */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Link2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">Data Sources</span>
          </div>
          <div className="space-y-2">
            {dataSources.map((src) => (
              <div key={src.platform} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${statusDot[src.status]}`} />
                  <span className="text-gray-700">{src.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${src.status === 'connected' ? 'text-gray-400' : 'text-amber-500'}`}>
                    {statusLabel[src.status]}
                  </span>
                  <span className="text-gray-300">{formatSyncTime(src.lastSync)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Account Health */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">Account Health</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              {health.overallScore}<span className="text-xs text-gray-400 font-normal"> / 100</span>
            </span>
          </div>

          {/* Score bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${scoreColor(health.overallScore)} transition-all duration-500`}
              style={{ width: `${health.overallScore}%` }}
            />
          </div>

          {/* Metric breakdown */}
          <div className="space-y-2">
            {health.metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${healthDot[m.status]}`} />
                  <span className="text-gray-600">{m.label}</span>
                </div>
                <span className={`font-medium ${healthColor[m.status]}`}>{m.value}%</span>
              </div>
            ))}
          </div>

          <button className="w-full text-center text-[11px] text-[#3CCED7] font-medium mt-3 hover:underline">
            View full audit →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
