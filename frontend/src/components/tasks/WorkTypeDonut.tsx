'use client';

import { useMemo } from 'react';
import { TASK_TYPES, type TypeMeta } from './TYPE_META';

interface WorkTypeDonutProps {
  // Map type value → count.
  counts: Record<string, number>;
  size?: number;
  thickness?: number;
}

interface Segment {
  meta: TypeMeta;
  count: number;
  startDeg: number;
  endDeg: number;
}

const TWO_PI = Math.PI * 2;

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number
): string => {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, startDeg);
  const o2 = polar(cx, cy, rOuter, endDeg);
  const i1 = polar(cx, cy, rInner, endDeg);
  const i2 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
};

export default function WorkTypeDonut({
  counts,
  size = 180,
  thickness = 26,
}: WorkTypeDonutProps) {
  const total = useMemo(
    () => TASK_TYPES.reduce((acc, t) => acc + (counts[t.value] || 0), 0),
    [counts]
  );

  const segments: Segment[] = useMemo(() => {
    if (total === 0) return [];
    let cursor = 0;
    return TASK_TYPES.filter((t) => (counts[t.value] || 0) > 0).map((meta) => {
      const count = counts[meta.value] || 0;
      const sweep = (count / total) * 360;
      const seg = {
        meta,
        count,
        startDeg: cursor,
        endDeg: cursor + sweep,
      };
      cursor += sweep;
      return seg;
    });
  }, [counts, total]);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - thickness;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={rOuter - thickness / 2}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={thickness}
            />
          ) : (
            segments.map((seg) => (
              <path
                key={seg.meta.value}
                d={arcPath(cx, cy, rOuter, rInner, seg.startDeg, seg.endDeg)}
                fill={seg.meta.hex}
              />
            ))
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold text-gray-900">{total}</div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400">Total</div>
        </div>
      </div>

      <div className="flex-1">
        {total === 0 ? (
          <p className="text-sm text-gray-400">No tasks yet.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {segments.slice(0, 6).map((seg) => (
              <li key={seg.meta.value} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="inline-block h-2 w-2 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: seg.meta.hex }}
                  />
                  <span className="truncate text-gray-700">{seg.meta.label}</span>
                </div>
                <span className="text-gray-400">{seg.count}</span>
              </li>
            ))}
            {segments.length > 6 ? (
              <li className="text-[11px] text-gray-400">
                +{segments.length - 6} more
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
