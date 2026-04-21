'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import type { PacingDataPoint } from '@/lib/mock/dashboardMock';

interface BudgetPacingChartProps {
  data: PacingDataPoint[];
  monthlyBudget?: number;
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

function getPacingStatus(data: PacingDataPoint[], budget: number) {
  const lastActual = data.filter(d => d.actual > 0);
  if (lastActual.length === 0) return { status: 'neutral' as const, label: 'No data', detail: '' };

  const current = lastActual[lastActual.length - 1];
  const dayOfMonth = lastActual.length;
  const idealDaily = budget / 30;
  const idealSpend = idealDaily * dayOfMonth;
  const diff = current.actual - idealSpend;
  const diffPercent = ((diff / idealSpend) * 100).toFixed(0);
  const projectedEnd = (current.actual / dayOfMonth) * 30;
  const remaining = budget - projectedEnd;

  if (Math.abs(Number(diffPercent)) <= 10) {
    return { status: 'on_track' as const, label: 'On Track', detail: `Projected to end within 10% of budget` };
  }
  if (Number(diffPercent) < -10) {
    return {
      status: 'under' as const,
      label: 'Underspending',
      detail: `$${Math.abs(Math.round(remaining)).toLocaleString()} will be unspent at current pace`,
    };
  }
  return {
    status: 'over' as const,
    label: 'Overspending',
    detail: `Projected $${Math.abs(Math.round(remaining)).toLocaleString()} over budget`,
  };
}

const statusStyle = {
  on_track: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  under: 'bg-amber-50 text-amber-700 border-amber-200',
  over: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function BudgetPacingChart({ data, monthlyBudget = 45000 }: BudgetPacingChartProps) {
  const pacing = getPacingStatus(data, monthlyBudget);

  return (
    <Card className="border-[0.5px] border-gray-200 bg-white shadow-none">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-gray-900">Budget Pacing</CardTitle>
            <p className="text-[11px] text-gray-400">Actual spend vs ideal trajectory this month</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={`text-[10px] font-medium ${statusStyle[pacing.status]}`}>
              {pacing.label}
            </Badge>
            {pacing.detail && (
              <p className="text-[10px] text-gray-400 mt-0.5 max-w-[200px]">{pacing.detail}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

              {/* Overspend danger zone */}
              <ReferenceArea
                y1={monthlyBudget}
                y2={monthlyBudget * 1.2}
                fill="#FEE2E2"
                fillOpacity={0.4}
              />

              {/* Budget limit line */}
              <ReferenceLine
                y={monthlyBudget}
                stroke="#EF4444"
                strokeWidth={1}
                strokeDasharray="8 4"
                label={{
                  value: `Budget: ${formatDollar(monthlyBudget)}`,
                  position: 'right',
                  fill: '#EF4444',
                  fontSize: 10,
                }}
              />

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
                domain={[0, monthlyBudget * 1.15]}
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
