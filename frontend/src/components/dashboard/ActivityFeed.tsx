'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import type { ActivityItem } from '@/lib/mock/dashboardMock';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const typeDot: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-[#3CCED7]',
};

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="border-[0.5px] border-gray-200 bg-white shadow-none">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          <CardTitle className="text-sm font-medium text-gray-900">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-0">
          {activities.map((item, i) => (
            <div
              key={item.id}
              className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0"
            >
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center pt-1.5">
                <div className={`w-2 h-2 rounded-full ${typeDot[item.type]} shrink-0`} />
                {i < activities.length - 1 && (
                  <div className="w-px flex-1 bg-gray-100 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gray-700 leading-4">{item.message}</p>
                <span className="text-[10px] text-gray-400 mt-0.5 block">{formatTime(item.time)}</span>
              </div>
            </div>
          ))}
        </div>

        <button className="w-full text-center text-[11px] text-[#3CCED7] font-medium mt-2 hover:underline">
          View all activity →
        </button>
      </CardContent>
    </Card>
  );
}
