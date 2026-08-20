'use client';

import { LineChart, Line } from 'recharts';
import type { SparklinePayload } from './sparklineData';

interface SparklineCellProps {
  payload: SparklinePayload;
  width: number;
  height: number;
}

const DEFAULT_COLOR = '#3CCED7';
const PADDING = 2;

/**
 * Renders a backend-resolved sparkline series as a compact, axis-less line
 * inside a spreadsheet cell (MED-295). `connectNulls` bridges the line across
 * gaps (null) so a missing point doesn't break the trend line.
 */
export default function SparklineCell({ payload, width, height }: SparklineCellProps) {
  const hasData = payload.series.some((v) => v != null);
  if (!hasData) return null;

  const data = payload.series.map((v, i) => ({ i, v }));
  const chartWidth = Math.max(width - PADDING * 2, 1);
  const chartHeight = Math.max(height - PADDING * 2, 1);

  return (
    <div
      data-testid="sparkline-cell"
      aria-label="sparkline"
      style={{ width, height, display: 'flex', alignItems: 'center', overflow: 'hidden' }}
    >
      <LineChart
        width={chartWidth}
        height={chartHeight}
        data={data}
        margin={{ top: PADDING, right: PADDING, bottom: PADDING, left: PADDING }}
      >
        <Line
          type="monotone"
          dataKey="v"
          stroke={payload.color ?? DEFAULT_COLOR}
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </div>
  );
}
