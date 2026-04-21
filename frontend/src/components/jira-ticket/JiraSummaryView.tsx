import React from "react";
import { Calendar, CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTone = "default" | "info" | "success" | "warning";

export type SummaryMetric = {
  key: string;
  label: string;
  value: number | string;
  subtitle: string;
  tone?: MetricTone;
};

export type StatusBreakdownItem = {
  label: string;
  count: number;
  color: string;
};

export type WorkTypeItem = {
  label: string;
  percentage: number;
  color: string;
};

export interface JiraSummaryViewProps {
  metrics: SummaryMetric[];
  statusOverview: {
    total: number;
    breakdown: StatusBreakdownItem[];
  };
  workTypes: WorkTypeItem[];
  onViewWorkItems?: () => void;
  onViewItems?: () => void;
}

const metricToneStyles: Record<MetricTone, string> = {
  default: "bg-white text-slate-700",
  info: "bg-white text-slate-700",
  success: "bg-white text-slate-700",
  warning: "bg-white text-slate-700",
};

const metricIconTone: Record<MetricTone, string> = {
  default: "bg-slate-100 text-slate-500",
  info: "bg-[#3CCED7]/10 text-[#3CCED7]",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
};

const MetricIcon = ({ label, tone }: { label: string; tone: MetricTone }) => {
  const className = cn(
    "h-7 w-7 rounded-md flex items-center justify-center",
    metricIconTone[tone]
  );
  if (label.includes("completed")) {
    return (
      <div className={className}>
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }
  if (label.includes("updated")) {
    return (
      <div className={className}>
        <RefreshCw className="h-4 w-4" />
      </div>
    );
  }
  if (label.includes("created")) {
    return (
      <div className={className}>
        <Plus className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className={className}>
      <Calendar className="h-4 w-4" />
    </div>
  );
};

const buildConic = (items: StatusBreakdownItem[]) => {
  if (!items.length) {
    return "conic-gradient(#e2e8f0 0% 100%)";
  }
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  let start = 0;
  const segments = items.map((item) => {
    const portion = (item.count / total) * 100;
    const end = start + portion;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
};

const JiraSummaryView: React.FC<JiraSummaryViewProps> = ({
  metrics,
  statusOverview,
  workTypes,
  onViewWorkItems,
  onViewItems,
}) => {
  const totalWorkItems = statusOverview.total;
  const conic = buildConic(statusOverview.breakdown);

  return (
    <div data-testid="summary-view" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className={cn(
              "flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3",
              metricToneStyles[metric.tone || "default"]
            )}
          >
            <MetricIcon label={metric.label} tone={metric.tone || "default"} />
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {metric.value} {metric.label}
              </div>
              <div className="text-xs text-slate-500">{metric.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div data-testid="summary-work-type-overview" className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-slate-800">
                Work type overview
              </div>
              <div className="text-xs text-slate-500">
                Get a snapshot of the work types in your items.
              </div>
            </div>
            <button
              type="button"
              onClick={onViewWorkItems}
              className="text-xs font-semibold text-[#3CCED7] hover:underline"
            >
              View all work items
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="relative h-36 w-36">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: conic }}
              />
              <div className="absolute inset-4 rounded-full bg-white" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div data-testid="summary-total-work-items" className="text-xl font-semibold text-slate-800">
                  {totalWorkItems}
                </div>
                <div className="text-xs text-slate-500">Total work items</div>
              </div>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              {statusOverview.breakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                  <span className="font-semibold text-slate-800">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-slate-800">
                Types of work
              </div>
              <div className="text-xs text-slate-500">
                Get a breakdown of work items by their types.
              </div>
            </div>
            <button
              type="button"
              onClick={onViewItems}
              className="text-xs font-semibold text-[#3CCED7] hover:underline"
            >
              View all items
            </button>
          </div>
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            {workTypes.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                No type data yet.
              </div>
            ) : (
              workTypes.map((item) => (
                <div key={item.label} className="grid grid-cols-[90px_1fr] gap-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-3 w-full rounded-full bg-slate-200">
                      <div
                        className="absolute left-0 top-0 h-3 rounded-full bg-slate-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[11px] text-slate-500">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default JiraSummaryView;
