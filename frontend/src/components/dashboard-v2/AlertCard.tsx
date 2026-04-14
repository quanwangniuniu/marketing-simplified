'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { AlertData } from '@/lib/mock/dashboardMock';

interface AlertCardProps {
  alert: AlertData;
  onAction: (id: number, action: 'accepted' | 'deferred' | 'dismissed') => void;
}

const severityConfig = {
  critical: { color: 'bg-red-500', label: 'Critical', textColor: 'text-red-700', bgColor: 'bg-red-50' },
  warning: { color: 'bg-amber-500', label: 'Warning', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  info: { color: 'bg-blue-500', label: 'Info', textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
};

export default function AlertCard({ alert, onAction }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const severity = severityConfig[alert.severity];

  return (
    <div className="relative border-[0.5px] border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Severity bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${severity.color}`} />

      <div className="pl-4 pr-3 py-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${severity.bgColor} ${severity.textColor}`}>
              {severity.label}
            </span>
            <span className="text-[13px] font-medium text-gray-900">{alert.title}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Scope */}
        <p className="text-[11px] text-gray-400 mb-2 line-clamp-1">{alert.scope}</p>

        {/* Expandable content */}
        {expanded && (
          <div className="mt-2 space-y-2.5">
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Why</span>
              <p className="text-[12px] text-gray-600 leading-4 mt-0.5">{alert.why}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Suggestion</span>
              <p className="text-[12px] text-gray-600 leading-4 mt-0.5">{alert.suggestion}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <Button
            size="sm"
            onClick={() => onAction(alert.id, 'accepted')}
            className="h-6 px-2.5 text-[11px] bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white border-0 hover:opacity-90"
          >
            Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction(alert.id, 'deferred')}
            className="h-6 px-2.5 text-[11px] border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Defer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction(alert.id, 'dismissed')}
            className="h-6 px-2.5 text-[11px] text-gray-400 hover:text-gray-600"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
