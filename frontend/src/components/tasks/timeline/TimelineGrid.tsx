'use client';

import type { ReactNode } from 'react';
import { format, getQuarter } from 'date-fns';
import type { TimelineColumn, TimelineScale } from './timelineUtils';

interface TimelineGridProps {
  columns: TimelineColumn[];
  leftColumnWidth?: number;
  todayPosition?: number | null;
  scale: TimelineScale;
  children: ReactNode;
}

const TimelineGrid = ({
  columns,
  leftColumnWidth = 280,
  todayPosition,
  scale,
  children,
}: TimelineGridProps) => {
  const columnWidth = columns[0]?.width ?? 80;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const showQuarterHeader = scale === 'quarter';

  const quarterGroups = showQuarterHeader
    ? (() => {
        const groups: { label: string; width: number }[] = [];
        let index = 0;
        while (index < columns.length) {
          const start = columns[index].start;
          const quarter = getQuarter(start);
          const year = start.getFullYear();
          let width = 0;
          let end = start;
          while (
            index < columns.length &&
            getQuarter(columns[index].start) === quarter &&
            columns[index].start.getFullYear() === year
          ) {
            width += columns[index].width;
            end = columns[index].start;
            index += 1;
          }
          const label = `${format(start, 'MMMM')} - ${format(end, 'MMMM')}`;
          groups.push({ label, width });
        }
        return groups;
      })()
    : [];

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
      {showQuarterHeader ? (
        <div
          className="grid items-stretch border-b border-slate-200 bg-slate-50"
          style={{
            gridTemplateColumns: `${leftColumnWidth}px 1fr`,
            gridTemplateRows: 'auto auto',
          }}
        >
          <div className="row-span-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Work
          </div>
          <div className="overflow-x-auto scrollbar-hide" data-timeline-scroll>
            <div className="flex" style={{ minWidth: totalWidth }}>
              {quarterGroups.map((group, idx) => (
                <div
                  key={`${group.label}-${idx}`}
                  className="flex h-full items-center justify-center border-l border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-600"
                  style={{ width: group.width }}
                >
                  {group.label}
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-hide" data-timeline-scroll>
            <div className="flex" style={{ minWidth: totalWidth }}>
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="flex h-full items-center justify-center border-l border-t border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-500"
                  style={{ width: column.width }}
                >
                  {column.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="grid items-stretch border-b border-slate-200 bg-slate-50"
          style={{ gridTemplateColumns: `${leftColumnWidth}px 1fr` }}
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Work
          </div>
          <div className="overflow-x-auto scrollbar-hide" data-timeline-scroll>
            <div className="flex" style={{ minWidth: totalWidth }}>
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="flex h-full items-center justify-center border-l border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-500"
                  style={{ width: column.width }}
                >
                  {column.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="divide-y divide-slate-200">
        {columns.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            Select a date range to view the timeline.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute inset-y-0"
                style={{
                  left: leftColumnWidth,
                  width: totalWidth,
                  backgroundImage:
                    'linear-gradient(to right, rgba(226, 232, 240, 0.8) 1px, transparent 1px)',
                  backgroundSize: `${columnWidth}px 100%`,
                }}
              />
              {showQuarterHeader
                ? quarterGroups.map((group, index) => {
                    const offset = quarterGroups
                      .slice(0, index)
                      .reduce((sum, item) => sum + item.width, 0);
                    return (
                      <div
                        key={`quarter-band-${index}`}
                        className={index % 2 === 0 ? 'bg-slate-50/60' : 'bg-white/0'}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: leftColumnWidth + offset,
                          width: group.width,
                        }}
                      />
                    );
                  })
                : null}
            </div>
            {typeof todayPosition === 'number' ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-[#3CCED7] z-20"
                style={{ left: leftColumnWidth + todayPosition }}
              />
            ) : null}
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineGrid;
