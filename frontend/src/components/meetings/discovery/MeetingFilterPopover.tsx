'use client';

import { useState, useEffect } from 'react';

import { selectToTriBool, triBoolToSelect } from '@/lib/meetings/meetingDiscoveryUrl';
import type { MeetingListQueryParams } from '@/types/meeting';
import { cn } from '@/lib/utils';

export interface MeetingFilterPopoverDraft {
  has_generated_decisions: '' | 'yes' | 'no';
  has_generated_tasks: '' | 'yes' | 'no';
  archived: '' | 'all' | 'yes' | 'no';
}

export interface MeetingFilterPopoverFormProps {
  draft: MeetingFilterPopoverDraft;
  onDraftChange: (next: MeetingFilterPopoverDraft) => void;
  disabled?: boolean;
  className?: string;
  /** `panel`: compact copy for the Filter dialog (no intro blurb). */
  variant?: 'default' | 'panel';
}

const fieldLabel = 'mb-1.5 block text-sm font-medium text-slate-700';

/** Generated / archive tri-state fields (inside the meetings Filter panel). */
export function MeetingFilterPopoverForm({
  draft,
  onDraftChange,
  disabled,
  className,
  variant = 'default',
}: MeetingFilterPopoverFormProps) {
  const selectClass =
    'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50';

  return (
    <div className={cn('space-y-4', className)}>
      {variant === 'default' ? (
        <p className="text-xs text-gray-500">
          Generated = origin only (not artifact links).
        </p>
      ) : (
        <p className="sr-only">Generated filters use meeting origin links only.</p>
      )}

      <div>
        <label className={fieldLabel}>Generated decisions</label>
        <select
          value={draft.has_generated_decisions}
          onChange={(e) =>
            onDraftChange({
              ...draft,
              has_generated_decisions: e.target
                .value as MeetingFilterPopoverDraft['has_generated_decisions'],
            })
          }
          className={selectClass}
          aria-label="Generated decisions filter"
        >
          <option value="">Any</option>
          <option value="yes">Has any</option>
          <option value="no">Has none</option>
        </select>
      </div>

      <div>
        <label className={fieldLabel}>Generated tasks</label>
        <select
          value={draft.has_generated_tasks}
          onChange={(e) =>
            onDraftChange({
              ...draft,
              has_generated_tasks: e.target.value as MeetingFilterPopoverDraft['has_generated_tasks'],
            })
          }
          className={selectClass}
          aria-label="Generated tasks filter"
        >
          <option value="">Any</option>
          <option value="yes">Has any</option>
          <option value="no">Has none</option>
        </select>
      </div>

      <div>
        <label className={fieldLabel}>Archived</label>
        <select
          value={draft.archived}
          onChange={(e) =>
            onDraftChange({
              ...draft,
              archived: e.target.value as MeetingFilterPopoverDraft['archived'],
            })
          }
          className={selectClass}
        >
          <option value="all">All meetings</option>
          <option value="no">Active only</option>
          <option value="yes">Archived only</option>
        </select>
      </div>
    </div>
  );
}

export function usePopoverDraftFromParams(
  has_generated_decisions: boolean | undefined,
  has_generated_tasks: boolean | undefined,
  is_archived: boolean | undefined,
): [MeetingFilterPopoverDraft, (d: MeetingFilterPopoverDraft) => void] {
  const [draft, setDraft] = useState<MeetingFilterPopoverDraft>(() => ({
    has_generated_decisions: triBoolToSelect(has_generated_decisions),
    has_generated_tasks: triBoolToSelect(has_generated_tasks),
    archived:
      is_archived === true ? 'yes' : is_archived === false ? 'no' : 'all',
  }));

  useEffect(() => {
    setDraft({
      has_generated_decisions: triBoolToSelect(has_generated_decisions),
      has_generated_tasks: triBoolToSelect(has_generated_tasks),
      archived:
        is_archived === true ? 'yes' : is_archived === false ? 'no' : 'all',
    });
  }, [has_generated_decisions, has_generated_tasks, is_archived]);

  return [draft, setDraft];
}

export function popoverDraftFromQuery(
  has_generated_decisions: boolean | undefined,
  has_generated_tasks: boolean | undefined,
  is_archived: boolean | undefined,
): MeetingFilterPopoverDraft {
  return {
    has_generated_decisions: triBoolToSelect(has_generated_decisions),
    has_generated_tasks: triBoolToSelect(has_generated_tasks),
    archived:
      is_archived === true ? 'yes' : is_archived === false ? 'no' : 'all',
  };
}

export function patchFromPopoverDraft(
  draft: MeetingFilterPopoverDraft,
): Pick<
  MeetingListQueryParams,
  'has_generated_decisions' | 'has_generated_tasks' | 'is_archived'
> {
  let is_archived: boolean | undefined;
  if (draft.archived === 'yes') is_archived = true;
  else if (draft.archived === 'no') is_archived = false;
  else is_archived = undefined;

  return {
    has_generated_decisions: selectToTriBool(draft.has_generated_decisions),
    has_generated_tasks: selectToTriBool(draft.has_generated_tasks),
    is_archived,
  };
}
