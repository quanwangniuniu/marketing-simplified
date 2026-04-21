'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { KPIAttribution } from '@/lib/mock/dashboardMock';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  change?: number;
  changeLabel?: string;
  status?: 'healthy' | 'warning' | 'critical' | 'neutral';
  progressValue?: number;
  progressMax?: number;
  attribution?: KPIAttribution;
}

const statusColors = {
  healthy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
  neutral: 'text-gray-500 bg-gray-50 border-gray-200',
};

const directionIcon = {
  up: { icon: TrendingUp, color: 'text-emerald-500' },
  down: { icon: TrendingDown, color: 'text-red-500' },
  neutral: { icon: Minus, color: 'text-gray-400' },
};

export default function KPICard({
  title, value, subtitle, icon: Icon, change, changeLabel,
  status = 'neutral', progressValue, progressMax, attribution,
}: KPICardProps) {
  const [expanded, setExpanded] = useState(false);
  const TrendIcon = change && change > 0 ? TrendingUp : change && change < 0 ? TrendingDown : Minus;
  const trendColor = change && change > 0 ? 'text-emerald-600' : change && change < 0 ? 'text-red-600' : 'text-gray-400';

  return (
    <Card
      className={`border-[0.5px] border-gray-200 bg-white shadow-none transition-all ${
        attribution ? 'cursor-pointer hover:shadow-sm' : ''
      } ${expanded ? 'col-span-1 row-span-2' : ''}`}
      onClick={() => attribution && setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3CCED7]/10 to-[#A6E661]/10 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-[#3CCED7]" />
          </div>
          <div className="flex items-center gap-1.5">
            {change !== undefined && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${statusColors[status]}`}>
                <TrendIcon className={`w-3 h-3 mr-0.5 ${trendColor}`} />
                {change > 0 ? '+' : ''}{change}%
              </Badge>
            )}
            {attribution && (
              <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>

        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{title}</div>
        <div className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</div>

        {progressValue !== undefined && progressMax !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>{progressValue}%</span>
              <span>Target: {progressMax}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] transition-all duration-500"
                style={{ width: `${Math.min(progressValue, 100)}%` }}
              />
            </div>
          </div>
        )}

        {subtitle && !progressValue && (
          <div className="text-[11px] text-gray-400 mt-1">{changeLabel || subtitle}</div>
        )}

        {/* Attribution panel */}
        <AnimatePresence>
          {expanded && attribution && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
                {/* Factors */}
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">What changed?</div>
                  {attribution.factors.map((f, i) => {
                    const dir = directionIcon[f.direction];
                    return (
                      <div key={i} className="flex items-start gap-2 py-1">
                        <dir.icon className={`w-3 h-3 mt-0.5 shrink-0 ${dir.color}`} />
                        <div className="flex-1 text-[11px] text-gray-600 leading-4">{f.label}</div>
                        <span className={`text-[10px] font-medium shrink-0 ${dir.color}`}>{f.impact}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Top contributor */}
                <div className="bg-gray-50 rounded-md px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Top contributor</div>
                  <div className="text-[11px] font-medium text-gray-800">{attribution.topContributor.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{attribution.topContributor.detail}</div>
                </div>

                {/* Compared to */}
                <div className="text-[10px] text-gray-400">
                  {attribution.comparedTo}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
