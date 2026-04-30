"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import { computeMinMaxNormalized } from "./rankingScoring";
import {
  AD_ACCENT_PALETTE,
  RADAR_DIMENSIONS,
} from "./comparisonDimensions";

interface ComparisonRadarProps {
  rows: MetaAdPerformanceRow[];
}

export default function ComparisonRadar({ rows }: ComparisonRadarProps) {
  const data = useMemo(() => {
    const perDimension = RADAR_DIMENSIONS.map((dim) => {
      const normalized = computeMinMaxNormalized(rows, dim.key, dim.invert);
      const point: Record<string, string | number> = { dimension: dim.label };
      for (const row of rows) {
        point[`ad_${row.id}`] = normalized.get(row.id) ?? 0;
      }
      return point;
    });
    return perDimension;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-xs text-gray-400">
        No comparison data.
      </div>
    );
  }

  return (
    <div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart outerRadius="78%" data={data}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11, fill: "#6B7280" }}
            />
            <PolarRadiusAxis
              tick={false}
              axisLine={false}
              domain={[0, 1]}
            />
            {rows.map((row, idx) => {
              const accent = AD_ACCENT_PALETTE[idx] ?? "#94A3B8";
              return (
                <Radar
                  key={row.id}
                  name={row.name || row.meta_ad_id}
                  dataKey={`ad_${row.id}`}
                  stroke={accent}
                  strokeWidth={1.5}
                  fill={accent}
                  fillOpacity={0.1}
                  isAnimationActive={false}
                />
              );
            })}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {rows.map((row, idx) => {
          const accent = AD_ACCENT_PALETTE[idx] ?? "#94A3B8";
          return (
            <span
              key={row.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] text-gray-700"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="max-w-[180px] truncate">
                {row.name || row.meta_ad_id}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
