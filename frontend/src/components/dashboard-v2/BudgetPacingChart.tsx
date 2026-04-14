'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, ReferenceLine,
} from 'recharts';
import type { PacingDataPoint } from '@/lib/mock/dashboardMock';

interface BudgetPacingChartProps {
  data: PacingDataPoint[];
}

function formatDollar(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      <div className="font-medium text-gray-900 mb-1">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500 capitalize">{entry.dataKey}:</span>
          <span className="font-medium text-gray-900">{formatDollar(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function BudgetPacingChart({ data }: BudgetPacingChartProps) {
  return (
    <Card className="border-[0.5px] border-gray-200 bg-white shadow-none">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-medium text-gray-900">Budget Pacing</CardTitle>
        <p className="text-[11px] text-gray-400">Actual spend vs ideal trajectory this month</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDollar}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#D1D5DB"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                name="Ideal"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3CCED7"
                strokeWidth={2}
                dot={false}
                name="Actual"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#A6E661"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                name="Projected"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
