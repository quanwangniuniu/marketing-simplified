'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DashboardSummary } from '@/types/dashboard';

interface TaskStatusCardProps {
  summary: DashboardSummary;
}

export default function TaskStatusCard({ summary }: TaskStatusCardProps) {
  const { status_overview, time_metrics } = summary;

  return (
    <Card
      data-overview-card="tasks"
      className="border-[0.5px] border-gray-200 bg-white shadow-none"
    >
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-gray-400" />
          <CardTitle className="text-sm font-medium text-gray-900">Task Overview</CardTitle>
          <span className="ml-auto text-xs text-gray-400">
            {status_overview.total_work_items} total
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {time_metrics.due_soon > 0 ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-amber-50 border border-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <div className="flex-1 text-xs text-gray-700">
              <span className="font-semibold text-amber-700">{time_metrics.due_soon}</span>
              <span className="ml-1">due soon</span>
            </div>
            <button className="text-[11px] text-[#3CCED7] font-medium hover:underline">
              Review →
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <div className="flex-1 text-xs text-emerald-700">No tasks due soon</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {status_overview.breakdown.map((row) => (
            <div
              key={row.status}
              className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: row.color ?? '#9CA3AF' }}
                />
                <span className="text-[12px] text-gray-600 truncate">{row.display_name}</span>
              </div>
              <span className="text-[12px] font-medium text-gray-900 tabular-nums">
                {row.count}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-2 text-[11px] text-gray-500 border-t border-gray-100">
          <span>
            <span className="font-medium text-gray-700">{time_metrics.completed_last_7_days}</span> completed
          </span>
          <span>
            <span className="font-medium text-gray-700">{time_metrics.created_last_7_days}</span> created
          </span>
          <span className="ml-auto text-gray-400">last 7 days</span>
        </div>
      </CardContent>
    </Card>
  );
}
