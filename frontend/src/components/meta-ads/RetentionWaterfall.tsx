'use client';

import { formatNumber, formatPercent } from './metaAdsUtils';

interface Step {
  label: string;
  count: number;
  ratioOfImpressions: number;
  ratioOfPrev: number;
}

export default function RetentionWaterfall({
  impressions,
  p25,
  p50,
  p75,
  p100,
}: {
  impressions: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
}) {
  const steps: Step[] = [
    {
      label: 'Impressions',
      count: impressions,
      ratioOfImpressions: 100,
      ratioOfPrev: 100,
    },
    {
      label: 'Watched 25%',
      count: p25,
      ratioOfImpressions: impressions > 0 ? (p25 / impressions) * 100 : 0,
      ratioOfPrev: impressions > 0 ? (p25 / impressions) * 100 : 0,
    },
    {
      label: 'Watched 50%',
      count: p50,
      ratioOfImpressions: impressions > 0 ? (p50 / impressions) * 100 : 0,
      ratioOfPrev: p25 > 0 ? (p50 / p25) * 100 : 0,
    },
    {
      label: 'Watched 75%',
      count: p75,
      ratioOfImpressions: impressions > 0 ? (p75 / impressions) * 100 : 0,
      ratioOfPrev: p50 > 0 ? (p75 / p50) * 100 : 0,
    },
    {
      label: 'Watched 100%',
      count: p100,
      ratioOfImpressions: impressions > 0 ? (p100 / impressions) * 100 : 0,
      ratioOfPrev: p75 > 0 ? (p100 / p75) * 100 : 0,
    },
  ];

  return (
    <div className="space-y-2.5">
      {steps.map((step, idx) => {
        const width = Math.max(2, Math.min(100, step.ratioOfImpressions));
        const isFirst = idx === 0;
        return (
          <div key={step.label}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-gray-700">{step.label}</span>
              <span className="font-mono text-gray-500">
                {formatNumber(step.count)}
                {!isFirst && (
                  <span className="ml-1.5 text-gray-400">
                    {formatPercent(step.ratioOfImpressions)} of impr
                    {step.ratioOfPrev > 0 && step.ratioOfPrev < 100 && (
                      <span className="ml-1 text-gray-400">
                        ({formatPercent(step.ratioOfPrev)} held)
                      </span>
                    )}
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${
                  isFirst
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                    : idx === 1
                      ? 'bg-gradient-to-r from-[#3CCED7] to-[#7fdde3]'
                      : idx === 2
                        ? 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661]'
                        : idx === 3
                          ? 'bg-gradient-to-r from-[#A6E661] to-[#9be06a]'
                          : 'bg-gradient-to-r from-[#5ea320] to-[#3d6b00]'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
