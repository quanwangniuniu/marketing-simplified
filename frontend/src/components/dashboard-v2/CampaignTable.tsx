'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowUpDown } from 'lucide-react';
import type { CampaignData } from '@/lib/mock/dashboardMock';

interface CampaignTableProps {
  campaigns: CampaignData[];
  title?: string;
  compact?: boolean;
}

type SortKey = 'spend' | 'roas' | 'change';

const platformIcons: Record<string, { label: string; color: string }> = {
  meta: { label: 'M', color: 'bg-blue-500' },
  google: { label: 'G', color: 'bg-red-500' },
  tiktok: { label: 'T', color: 'bg-gray-900' },
};

export default function CampaignTable({ campaigns, title = 'Campaign Performance', compact = false }: CampaignTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>('roas');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...campaigns].sort((a, b) => {
    const diff = a[sortBy] - b[sortBy];
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(true); }
  };

  return (
    <Card className="border-[0.5px] border-gray-200 bg-white shadow-none">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-medium text-gray-900">{title}</CardTitle>
        <p className="text-[11px] text-gray-400">
          {compact ? 'Campaigns requiring attention' : 'Anomalous campaigns highlighted in red'}
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-medium text-gray-400 px-4 py-2 w-8"></th>
                <th className="text-left font-medium text-gray-400 px-2 py-2">Campaign</th>
                <th
                  className="text-right font-medium text-gray-400 px-2 py-2 cursor-pointer hover:text-gray-600 select-none"
                  onClick={() => toggleSort('spend')}
                >
                  <span className="inline-flex items-center gap-0.5">Spend <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-right font-medium text-gray-400 px-2 py-2">Conv.</th>
                <th
                  className="text-right font-medium text-gray-400 px-2 py-2 cursor-pointer hover:text-gray-600 select-none"
                  onClick={() => toggleSort('roas')}
                >
                  <span className="inline-flex items-center gap-0.5">ROAS <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th
                  className="text-right font-medium text-gray-400 px-2 py-2 cursor-pointer hover:text-gray-600 select-none"
                  onClick={() => toggleSort('change')}
                >
                  <span className="inline-flex items-center gap-0.5">Change <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="text-center font-medium text-gray-400 px-2 py-2 w-8">Flag</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const plat = platformIcons[c.platform];
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      c.isAnomaly ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-2">
                      {c.isAnomaly && <div className="w-[3px] h-6 bg-red-500 rounded-r-full -ml-4" />}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${plat.color} flex items-center justify-center shrink-0`}>
                          <span className="text-white text-[7px] font-bold">{plat.label}</span>
                        </div>
                        <span className="text-gray-900 font-medium truncate max-w-[240px]" title={c.name}>
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-right px-2 py-2 text-gray-600 tabular-nums">
                      ${c.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right px-2 py-2 text-gray-600 tabular-nums">{c.conversions}</td>
                    <td className="text-right px-2 py-2 tabular-nums">
                      <span className={c.roas < 1 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                        {c.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="text-right px-2 py-2">
                      <span className={`tabular-nums ${c.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {c.change >= 0 ? '+' : ''}{c.change}%
                      </span>
                    </td>
                    <td className="text-center px-2 py-2">
                      {c.isAnomaly && (
                        <span title={c.anomalyReason}>
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
