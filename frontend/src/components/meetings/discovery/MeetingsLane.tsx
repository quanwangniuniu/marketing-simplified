'use client';

import type { ReactNode } from 'react';

import { LaneCountBadge } from '@/components/meetings/discovery/LaneCountBadge';
import { MeetingsSortMenu } from '@/components/meetings/discovery/MeetingsSortMenu';
import type { MeetingSortKey } from '@/lib/meetings/meetingSectionSort';

export type MeetingsLaneProps = {
  title: string;
  /** Optional subtitle under the title; omit for no helper line. */
  description?: string;
  headingId: string;
  sortValue: MeetingSortKey;
  onSortChange: (value: MeetingSortKey) => void;
  sortAriaContext: string;
  /** Badge **A**: lane + discovery filters (API `*_result_count`). */
  resultCount?: number;
  /** Badge **B**: lane base without filters (API `*_lane_total`). */
  totalCount?: number;
  /** When true and resultCount is 0, badge shows a loading placeholder. */
  loading: boolean;
  disabled?: boolean;
  children: ReactNode;
};

/**
 * Jira-style board column: one grey panel with title + count badge + sort in the header, then card stack.
 */
export function MeetingsLane({
  title,
  description,
  headingId,
  sortValue,
  onSortChange,
  sortAriaContext,
  resultCount,
  totalCount,
  loading,
  disabled,
  children,
}: MeetingsLaneProps) {
  return (
    <section
      aria-labelledby={headingId}
      className="meeting-column flex min-h-[420px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50"
    >
      <div className="meeting-column__header flex shrink-0 flex-col gap-3 border-b border-slate-200/90 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1 sm:pr-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              id={headingId}
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              {title}
            </h2>
            <LaneCountBadge
              visible={resultCount}
              total={totalCount}
              loading={loading}
              debugLabel={title}
            />
          </div>
          {description?.trim() ? (
            <p className="mt-1.5 text-sm leading-snug text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        <MeetingsSortMenu
          value={sortValue}
          onChange={onSortChange}
          ariaLabelContext={sortAriaContext}
          disabled={disabled}
        />
      </div>

      <div className="meeting-column__list min-h-0 flex-1 px-3 pb-4 pt-3 sm:px-4">
        {children}
      </div>
    </section>
  );
}
