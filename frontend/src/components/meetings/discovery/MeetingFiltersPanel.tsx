'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';

import type { ProjectMemberData } from '@/lib/api/projectApi';
import type { MeetingListQueryParams } from '@/types/meeting';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  type MeetingFilterPopoverDraft,
} from './MeetingFilterPopover';
import { MeetingParticipantMultiSelect } from './MeetingParticipantMultiSelect';

/** Local draft for "All filters" until Apply advanced filters. */
export type AdvancedFiltersDraft = {
  tagSlug: string;
  participant: number[];
  excludeParticipant: number[];
  dateFrom?: string;
  dateTo?: string;
  popover: MeetingFilterPopoverDraft;
};

function buildDraftFromProps(p: {
  tagSlug: string;
  participant?: number[];
  excludeParticipant?: number[];
  dateFrom?: string;
  dateTo?: string;
  popoverDraft: MeetingFilterPopoverDraft;
}): AdvancedFiltersDraft {
  return {
    tagSlug: p.tagSlug,
    participant: p.participant?.length ? [...new Set(p.participant)] : [],
    excludeParticipant: p.excludeParticipant?.length
      ? [...new Set(p.excludeParticipant)]
      : [],
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    popover: {
      has_generated_decisions: p.popoverDraft.has_generated_decisions,
      has_generated_tasks: p.popoverDraft.has_generated_tasks,
      archived: p.popoverDraft.archived,
    },
  };
}

/** UI-only: which advanced filter rows are shown (URL value may still be empty). */
export type AdvancedFilterKind =
  | 'participants'
  | 'tags'
  | 'date_range'
  | 'generated_decisions'
  | 'generated_tasks'
  | 'archived';

function isTagsActive(tag: string) {
  return Boolean(tag?.trim());
}

function isDateRangeActive(from?: string, to?: string) {
  return Boolean(from || to);
}

function isGeneratedDecisionsActive(draft: MeetingFilterPopoverDraft) {
  return draft.has_generated_decisions !== '';
}

function isGeneratedTasksActive(draft: MeetingFilterPopoverDraft) {
  return draft.has_generated_tasks !== '';
}

function isArchivedActive(draft: MeetingFilterPopoverDraft) {
  return draft.archived !== 'all';
}

export interface MeetingFiltersPanelProps {
  /** Committed URL values (sync source while panel is open). */
  tagSlug: string;
  participant?: number[];
  excludeParticipant?: number[];
  dateFrom?: string;
  dateTo?: string;
  members: ProjectMemberData[];
  memberLabel: (userId: number) => string;
  currentUserId?: number;
  popoverDraft: MeetingFilterPopoverDraft;
  onAdvancedFiltersApply: (payload: {
    discovery: Partial<MeetingListQueryParams>;
    popoverDraft: MeetingFilterPopoverDraft;
  }) => void;
  onClosePanel: () => void;
  /** Quick filter chip toggles (URL shortcuts). */
  quickIncludeMeActive: boolean;
  quickThisWeekActive: boolean;
  quickNextWeekActive: boolean;
  quickHasGenDecisionsActive: boolean;
  quickHasGenTasksActive: boolean;
  onQuickIncludeMe: () => void;
  onQuickThisWeek: () => void;
  onQuickNextWeek: () => void;
  onQuickHasGenDecisions: () => void;
  onQuickHasGenTasks: () => void;
  disabled?: boolean;
}

function QuickChip({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-[#3CCED7] bg-[#3CCED7]/10 text-[#1a9ba3]'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        disabled && 'opacity-50',
      )}
    >
      {children}
    </button>
  );
}

function FilterRowChrome({
  label,
  operator,
  children,
  onRemove,
  removeLabel,
}: {
  label: string;
  operator?: ReactNode;
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-2 py-2">
      <span className="w-[7.5rem] shrink-0 text-xs font-semibold text-slate-800">
        {label}
      </span>
      {operator != null ? (
        typeof operator === 'string' || typeof operator === 'number' ? (
          <span className="shrink-0 text-xs text-slate-600">{operator}</span>
        ) : (
          <div className="shrink-0">{operator}</div>
        )
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
        aria-label={removeLabel}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

const compactControl =
  'h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50';

const compactDate = `${compactControl} max-w-[11rem]`;

export function MeetingFiltersPanel({
  tagSlug,
  participant,
  excludeParticipant,
  dateFrom,
  dateTo,
  members,
  memberLabel,
  currentUserId,
  popoverDraft,
  onAdvancedFiltersApply,
  onClosePanel,
  quickIncludeMeActive,
  quickThisWeekActive,
  quickNextWeekActive,
  quickHasGenDecisionsActive,
  quickHasGenTasksActive,
  onQuickIncludeMe,
  onQuickThisWeek,
  onQuickNextWeek,
  onQuickHasGenDecisions,
  onQuickHasGenTasks,
  disabled,
}: MeetingFiltersPanelProps) {
  const [draft, setDraft] = useState<AdvancedFiltersDraft>(() =>
    buildDraftFromProps({
      tagSlug,
      participant,
      excludeParticipant,
      dateFrom,
      dateTo,
      popoverDraft,
    }),
  );
  const [addedKinds, setAddedKinds] = useState<Set<AdvancedFilterKind>>(
    () => new Set(),
  );
  const [participantModeLocal, setParticipantModeLocal] = useState<
    'include' | 'exclude'
  >('include');

  useEffect(() => {
    setDraft((d) => ({
      ...d,
      participant: participant?.length ? [...participant] : [],
      excludeParticipant: excludeParticipant?.length
        ? [...excludeParticipant]
        : [],
      dateFrom,
      dateTo,
    }));
  }, [participant, excludeParticipant, dateFrom, dateTo]);

  useEffect(() => {
    setDraft((d) => ({
      ...d,
      popover: {
        has_generated_decisions: popoverDraft.has_generated_decisions,
        has_generated_tasks: popoverDraft.has_generated_tasks,
        archived: popoverDraft.archived,
      },
    }));
  }, [
    popoverDraft.has_generated_decisions,
    popoverDraft.has_generated_tasks,
    popoverDraft.archived,
  ]);

  const hasParticipantInDraft = draft.participant.length > 0;
  const hasExcludeInDraft = draft.excludeParticipant.length > 0;
  const showDualParticipantRows = hasParticipantInDraft && hasExcludeInDraft;

  const showParticipantsSingleRow =
    !showDualParticipantRows &&
    (addedKinds.has('participants') ||
      hasParticipantInDraft ||
      hasExcludeInDraft);

  const participantSingleMode: 'include' | 'exclude' = showDualParticipantRows
    ? 'include'
    : hasParticipantInDraft && !hasExcludeInDraft
      ? 'include'
      : hasExcludeInDraft && !hasParticipantInDraft
        ? 'exclude'
        : participantModeLocal;

  useEffect(() => {
    if (hasExcludeInDraft && !hasParticipantInDraft) {
      setParticipantModeLocal('exclude');
    } else if (hasParticipantInDraft && !hasExcludeInDraft) {
      setParticipantModeLocal('include');
    }
  }, [hasParticipantInDraft, hasExcludeInDraft]);

  const showTags =
    isTagsActive(draft.tagSlug) || addedKinds.has('tags');
  const showDateRange =
    isDateRangeActive(draft.dateFrom, draft.dateTo) ||
    addedKinds.has('date_range');
  const showGeneratedDecisions =
    isGeneratedDecisionsActive(draft.popover) ||
    addedKinds.has('generated_decisions');
  const showGeneratedTasks =
    isGeneratedTasksActive(draft.popover) ||
    addedKinds.has('generated_tasks');
  const showArchived =
    isArchivedActive(draft.popover) || addedKinds.has('archived');

  const controlDisabled = Boolean(disabled);

  const addKind = (kind: AdvancedFilterKind) => {
    setAddedKinds((prev) => new Set(prev).add(kind));
  };

  const removeKind = (kind: AdvancedFilterKind) => {
    setAddedKinds((prev) => {
      const next = new Set(prev);
      next.delete(kind);
      return next;
    });
  };

  const participantsMenuDisabled =
    showDualParticipantRows || showParticipantsSingleRow;

  const menuDisabled: Partial<Record<AdvancedFilterKind, boolean>> = {
    participants: participantsMenuDisabled,
    tags: showTags,
    date_range: showDateRange,
    generated_decisions: showGeneratedDecisions,
    generated_tasks: showGeneratedTasks,
    archived: showArchived,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Quick filters</p>
        <div className="flex flex-wrap gap-2">
          <QuickChip
            active={quickIncludeMeActive}
            onClick={onQuickIncludeMe}
            disabled={disabled || !currentUserId}
          >
            Include me
          </QuickChip>
          <QuickChip
            active={quickThisWeekActive}
            onClick={onQuickThisWeek}
            disabled={disabled}
          >
            This week
          </QuickChip>
          <QuickChip
            active={quickNextWeekActive}
            onClick={onQuickNextWeek}
            disabled={disabled}
          >
            Next week
          </QuickChip>
          <QuickChip
            active={quickHasGenDecisionsActive}
            onClick={onQuickHasGenDecisions}
            disabled={disabled}
          >
            Has generated decisions
          </QuickChip>
          <QuickChip
            active={quickHasGenTasksActive}
            onClick={onQuickHasGenTasks}
            disabled={disabled}
          >
            Has generated tasks
          </QuickChip>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">All filters</p>

        <div className="space-y-2">
          {showDualParticipantRows ? (
            <>
              <FilterRowChrome
                label="Participants"
                operator="includes"
                removeLabel="Remove participant includes filter"
                onRemove={() => {
                  setDraft((d) => ({ ...d, participant: [] }));
                }}
              >
                <MeetingParticipantMultiSelect
                  value={draft.participant}
                  onChange={(ids) => {
                    setDraft((d) => ({ ...d, participant: ids }));
                  }}
                  members={members}
                  memberLabel={memberLabel}
                  disabled={disabled}
                />
              </FilterRowChrome>
              <FilterRowChrome
                label="Participants"
                operator="excludes"
                removeLabel="Remove participant excludes filter"
                onRemove={() => {
                  setDraft((d) => ({ ...d, excludeParticipant: [] }));
                }}
              >
                <MeetingParticipantMultiSelect
                  value={draft.excludeParticipant}
                  onChange={(ids) => {
                    setDraft((d) => ({ ...d, excludeParticipant: ids }));
                  }}
                  members={members}
                  memberLabel={memberLabel}
                  disabled={disabled}
                />
              </FilterRowChrome>
            </>
          ) : null}

          {showParticipantsSingleRow && !showDualParticipantRows ? (
            <FilterRowChrome
              label="Participants"
              operator={
                <select
                  className={cn(compactControl, 'w-[7.25rem] shrink-0')}
                  value={participantSingleMode}
                  onChange={(e) => {
                    const next = e.target.value as 'include' | 'exclude';
                    if (next === participantSingleMode) return;
                    if (next === 'exclude') {
                      setDraft((d) => ({
                        ...d,
                        participant: [],
                        excludeParticipant: d.participant ?? [],
                      }));
                    } else {
                      setDraft((d) => ({
                        ...d,
                        excludeParticipant: [],
                        participant: d.excludeParticipant ?? [],
                      }));
                    }
                    setParticipantModeLocal(next);
                  }}
                  disabled={controlDisabled}
                  aria-label="Participant filter mode"
                >
                  <option value="include">includes</option>
                  <option value="exclude">excludes</option>
                </select>
              }
              removeLabel="Remove participants filter"
              onRemove={() => {
                setDraft((d) => ({
                  ...d,
                  participant: [],
                  excludeParticipant: [],
                }));
                removeKind('participants');
                setParticipantModeLocal('include');
              }}
            >
              <MeetingParticipantMultiSelect
                value={
                  participantSingleMode === 'include'
                    ? draft.participant
                    : draft.excludeParticipant
                }
                onChange={(ids) => {
                  if (participantSingleMode === 'include') {
                    setDraft((d) => ({
                      ...d,
                      participant: ids,
                      excludeParticipant: [],
                    }));
                  } else {
                    setDraft((d) => ({
                      ...d,
                      excludeParticipant: ids,
                      participant: [],
                    }));
                  }
                }}
                members={members}
                memberLabel={memberLabel}
                disabled={disabled}
              />
            </FilterRowChrome>
          ) : null}

          {showTags ? (
            <FilterRowChrome
              label="Tags"
              removeLabel="Remove tag filter"
              onRemove={() => {
                setDraft((d) => ({ ...d, tagSlug: '' }));
                removeKind('tags');
              }}
            >
              <input
                type="text"
                value={draft.tagSlug}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tagSlug: e.target.value }))
                }
                disabled={disabled}
                placeholder="Tag slug…"
                className={cn(compactControl, 'placeholder:text-slate-400')}
                aria-label="Filter by tag"
              />
            </FilterRowChrome>
          ) : null}

          {showDateRange ? (
            <FilterRowChrome
              label="Date range"
              removeLabel="Remove date range filter"
              onRemove={() => {
                setDraft((d) => ({
                  ...d,
                  dateFrom: undefined,
                  dateTo: undefined,
                }));
                removeKind('date_range');
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={draft.dateFrom ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      dateFrom: e.target.value.trim() || undefined,
                    }))
                  }
                  disabled={disabled}
                  className={compactDate}
                  aria-label="Scheduled date from"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                  type="date"
                  value={draft.dateTo ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      dateTo: e.target.value.trim() || undefined,
                    }))
                  }
                  disabled={disabled}
                  className={compactDate}
                  aria-label="Scheduled date to"
                />
              </div>
            </FilterRowChrome>
          ) : null}

          {showGeneratedDecisions ? (
            <FilterRowChrome
              label="Generated decisions"
              removeLabel="Remove generated decisions filter"
              onRemove={() => {
                setDraft((d) => ({
                  ...d,
                  popover: {
                    ...d.popover,
                    has_generated_decisions: '',
                  },
                }));
                removeKind('generated_decisions');
              }}
            >
              <select
                value={draft.popover.has_generated_decisions}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    popover: {
                      ...d.popover,
                      has_generated_decisions: e.target
                        .value as MeetingFilterPopoverDraft['has_generated_decisions'],
                    },
                  }))
                }
                disabled={controlDisabled}
                className={compactControl}
                aria-label="Generated decisions filter"
              >
                <option value="">Any</option>
                <option value="yes">Has any</option>
                <option value="no">Has none</option>
              </select>
            </FilterRowChrome>
          ) : null}

          {showGeneratedTasks ? (
            <FilterRowChrome
              label="Generated tasks"
              removeLabel="Remove generated tasks filter"
              onRemove={() => {
                setDraft((d) => ({
                  ...d,
                  popover: {
                    ...d.popover,
                    has_generated_tasks: '',
                  },
                }));
                removeKind('generated_tasks');
              }}
            >
              <select
                value={draft.popover.has_generated_tasks}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    popover: {
                      ...d.popover,
                      has_generated_tasks: e.target
                        .value as MeetingFilterPopoverDraft['has_generated_tasks'],
                    },
                  }))
                }
                disabled={controlDisabled}
                className={compactControl}
                aria-label="Generated tasks filter"
              >
                <option value="">Any</option>
                <option value="yes">Has any</option>
                <option value="no">Has none</option>
              </select>
            </FilterRowChrome>
          ) : null}

          {showArchived ? (
            <FilterRowChrome
              label="Archived"
              removeLabel="Remove archived filter"
              onRemove={() => {
                setDraft((d) => ({
                  ...d,
                  popover: {
                    ...d.popover,
                    archived: 'all',
                  },
                }));
                removeKind('archived');
              }}
            >
              <select
                value={draft.popover.archived}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    popover: {
                      ...d.popover,
                      archived: e.target
                        .value as MeetingFilterPopoverDraft['archived'],
                    },
                  }))
                }
                disabled={controlDisabled}
                className={compactControl}
                aria-label="Archived meetings filter"
              >
                <option value="all">All meetings</option>
                <option value="no">Exclude archived</option>
                <option value="yes">Only archived</option>
              </select>
            </FilterRowChrome>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="meetings-add-filter-trigger"
              disabled={disabled}
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm font-medium text-[#1a9ba3] hover:bg-[#3CCED7]/10 hover:text-[#0f757a] disabled:opacity-50',
              )}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Add filter
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[min(100vw-2rem,16rem)]">
            <DropdownMenuItem
              disabled={participantsMenuDisabled}
              onSelect={() => addKind('participants')}
            >
              Participants
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={menuDisabled.tags}
              onSelect={() => addKind('tags')}
            >
              Tags
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={menuDisabled.date_range}
              onSelect={() => addKind('date_range')}
            >
              Date range
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={menuDisabled.generated_decisions}
              onSelect={() => addKind('generated_decisions')}
            >
              Generated decisions
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={menuDisabled.generated_tasks}
              onSelect={() => addKind('generated_tasks')}
            >
              Generated tasks
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={menuDisabled.archived}
              onSelect={() => addKind('archived')}
            >
              Archived
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClosePanel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#3CCED7] hover:bg-[#2AB5BD]"
            onClick={() => {
              onAdvancedFiltersApply({
                discovery: {
                  tag: draft.tagSlug.trim() || undefined,
                  participant: draft.participant.length ? draft.participant : undefined,
                  exclude_participant: draft.excludeParticipant.length
                    ? draft.excludeParticipant
                    : undefined,
                  date_from: draft.dateFrom,
                  date_to: draft.dateTo,
                },
                popoverDraft: draft.popover,
              });
            }}
          >
            Apply advanced filters
          </Button>
        </div>
      </div>
    </div>
  );
}
