'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TaskAPI, parseTaskHierarchyApiError } from '@/lib/api/taskApi';
import { cn } from '@/lib/utils';
import type { TaskData } from '@/types/task';
import { getTaskParentId, getTaskParentSlug, getTaskParentSummary } from '@/types/task';

const MIN_SEARCH_LENGTH = 1;
const SEARCH_DEBOUNCE_MS = 300;

interface Props {
  task: TaskData;
  readOnly?: boolean;
  disabled?: boolean;
  onUpdated: () => void | Promise<void>;
}

function parentFromRelationship(task: TaskData): TaskData | null {
  const parentId = getTaskParentId(task);
  if (parentId == null) return null;
  const slug = getTaskParentSlug(task);
  const summary = getTaskParentSummary(task);
  return {
    id: parentId,
    slug: slug ?? undefined,
    summary: summary ?? `Task ${parentId}`,
    type: 'asset',
    project_id: task.project_id,
  };
}

export function mergeParentCandidates(...groups: TaskData[][]): TaskData[] {
  const byId = new Map<number, TaskData>();
  for (const group of groups) {
    for (const row of group) {
      if (row.id != null && !byId.has(row.id)) {
        byId.set(row.id, row);
      }
    }
  }
  return Array.from(byId.values());
}

export function rememberParent(
  parents: TaskData[],
  parent: TaskData | null | undefined,
): TaskData[] {
  if (parent?.id == null) return parents;
  if (parents.some((row) => row.id === parent.id)) return parents;
  return [...parents, parent];
}

function parentTypeLabel(type: string | undefined): string | undefined {
  return type ? type.replace(/_/g, ' ') : undefined;
}

/** Whether a task title (or numeric id) matches a parent-picker search query. */
export function taskSummaryMatchesSearch(
  task: TaskData,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if ((task.summary ?? '').toLowerCase().includes(q)) return true;
  if (/^\d+$/.test(q) && task.id != null && String(task.id) === q) return true;
  return false;
}

export default function TaskParentPicker({
  task,
  readOnly = false,
  disabled = false,
  onUpdated,
}: Props) {
  const taskId = task.id;
  const currentParentId = getTaskParentId(task);
  const [parentId, setParentId] = useState(
    () => (currentParentId != null ? String(currentParentId) : ''),
  );
  /** Current + previously selected parents; always shown without a search request. */
  const [retainedParents, setRetainedParents] = useState<TaskData[]>(() => {
    const seed = parentFromRelationship(task);
    return seed ? [seed] : [];
  });
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TaskData[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const relationshipParent = useMemo(
    () => parentFromRelationship(task),
    [task],
  );

  const projectId = task.project?.id ?? task.project_id ?? task.project?.slug;

  const pinnedParents = useMemo(
    () => mergeParentCandidates(
      relationshipParent ? [relationshipParent] : [],
      retainedParents,
    ),
    [relationshipParent, retainedParents],
  );

  const searchableParents = useMemo(() => {
    const extra = searchResults.filter(
      (row) =>
        row.id != null &&
        String(row.id) !== String(taskId) &&
        !pinnedParents.some((pinned) => pinned.id === row.id),
    );
    return mergeParentCandidates(pinnedParents, extra);
  }, [pinnedParents, searchResults, taskId]);

  const selectedParent = useMemo(() => {
    if (parentId === '') return null;
    return (
      searchableParents.find((row) => String(row.id) === parentId) ??
      pinnedParents.find((row) => String(row.id) === parentId) ??
      null
    );
  }, [parentId, pinnedParents, searchableParents]);

  useEffect(() => {
    setParentId(currentParentId != null ? String(currentParentId) : '');
    setInlineError(null);
    const seed = parentFromRelationship(task);
    if (seed) {
      setRetainedParents((prev) => rememberParent(prev, seed));
    }
  }, [taskId, currentParentId, task.parent_relationship]);

  useEffect(() => {
    setRetainedParents([]);
  }, [taskId]);

  useEffect(() => {
    if (!open) return;

    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (projectId == null || projectId === '') return;

    setSearching(true);
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const response = await TaskAPI.getTasks({
          project_id: projectId,
          has_parent: false,
          search: trimmed,
          page_size: 20,
          page: 1,
        });
        if (cancelled) return;

        const responseData = response.data;
        const rows: TaskData[] = Array.isArray(responseData)
          ? responseData
          : (responseData?.results ?? []);

        setSearchResults(
          rows.filter(
            (row) => row.id != null && String(row.id) !== String(taskId),
          ),
        );
      } catch {
        if (!cancelled) {
          toast.error('Failed to search parent tasks.');
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, searchQuery, projectId, taskId]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSearching(false);
    }
  }, []);

  const handleParentChange = async (nextParentId: string) => {
    if (!taskId || readOnly || disabled || saving) return;
    if (nextParentId === parentId) return;
    if (currentParentId == null) {
      toast.error('Current parent is unknown; refresh the page and try again.');
      return;
    }

    const newParent = searchableParents.find((row) => String(row.id) === nextParentId);
    if (!newParent?.id) {
      toast.error('Selected parent task was not found.');
      return;
    }

    const oldParent = searchableParents.find((row) => row.id === currentParentId);

    setSaving(true);
    setInlineError(null);
    try {
      await TaskAPI.moveSubtask(
        newParent.id,
        taskId,
        { old_parent_id: currentParentId },
      );
      if (oldParent) {
        setRetainedParents((prev) => rememberParent(prev, oldParent));
      }
      setParentId(nextParentId);
      await onUpdated();
    } catch (error) {
      setParentId(currentParentId != null ? String(currentParentId) : '');
      const parsed = parseTaskHierarchyApiError(error);
      if (parsed.isHierarchyCycle) {
        setInlineError(parsed.message);
      } else {
        toast.error(parsed.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const trimmedSearch = searchQuery.trim();
  const isSearching = trimmedSearch.length >= MIN_SEARCH_LENGTH;
  const matchingPinnedWhenSearching = useMemo(
    () => (
      isSearching
        ? pinnedParents.filter((row) => taskSummaryMatchesSearch(row, trimmedSearch))
        : []
    ),
    [isSearching, pinnedParents, trimmedSearch],
  );
  const displayedSearchResults = useMemo(
    () => mergeParentCandidates(
      matchingPinnedWhenSearching,
      searchResults.filter(
        (row) =>
          row.id != null &&
          String(row.id) !== String(taskId) &&
          !matchingPinnedWhenSearching.some((pinned) => pinned.id === row.id),
      ),
    ),
    [matchingPinnedWhenSearching, searchResults, taskId],
  );

  if (!task.is_subtask) {
    return null;
  }

  const pickerDisabled =
    readOnly ||
    disabled ||
    saving ||
    currentParentId == null;

  const showSearchHint =
    open && trimmedSearch.length > 0 && trimmedSearch.length < MIN_SEARCH_LENGTH;
  const showTypeToSearch = open && trimmedSearch.length === 0 && pinnedParents.length <= 1;
  const showPinnedGroup = !isSearching && pinnedParents.length > 0;

  return (
    <div className="min-w-0" data-testid="task-parent-picker">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label="Parent task"
            disabled={pickerDisabled}
            data-testid="task-parent-picker-trigger"
            className={cn(
              'inline-flex min-w-0 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            )}
          >
            <span className="min-w-0 truncate text-left">
              {selectedParent?.summary ?? 'Select parent…'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-50 w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search parent task…"
              value={searchQuery}
              onValueChange={setSearchQuery}
              data-testid="task-parent-picker-search"
            />
            <CommandList className="max-h-56">
              {showSearchHint ? (
                <CommandEmpty>Type at least {MIN_SEARCH_LENGTH} characters to search</CommandEmpty>
              ) : null}
              {showTypeToSearch ? (
                <CommandEmpty>Type to search parent tasks</CommandEmpty>
              ) : null}
              {searching ? (
                <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
              ) : null}
              {isSearching && !searching && displayedSearchResults.length === 0 ? (
                <CommandEmpty>No parent tasks found</CommandEmpty>
              ) : null}
              {!isSearching && !showTypeToSearch && pinnedParents.length === 0 ? (
                <CommandEmpty>No parent tasks found</CommandEmpty>
              ) : null}
              {showPinnedGroup ? (
                <CommandGroup heading="Current & recent">
                  {pinnedParents.map((row) => {
                    const isSelected = String(row.id) === parentId;
                    const typeLabel = parentTypeLabel(row.type);
                    return (
                      <CommandItem
                        key={`pinned-${row.id}`}
                        value={`pinned-${row.id} ${row.summary ?? ''}`}
                        onSelect={() => {
                          void handleParentChange(String(row.id));
                          handleOpenChange(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            isSelected ? 'opacity-100 text-[#3CCED7]' : 'opacity-0',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{row.summary || `Task ${row.id}`}</span>
                          {typeLabel ? (
                            <span className="text-[11px] text-gray-400">{typeLabel}</span>
                          ) : null}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              {isSearching && displayedSearchResults.length > 0 ? (
                <CommandGroup heading="Search results">
                  {displayedSearchResults.map((row) => {
                      const isSelected = String(row.id) === parentId;
                      const typeLabel = parentTypeLabel(row.type);
                      return (
                        <CommandItem
                          key={`search-${row.id}`}
                          value={`search-${row.id} ${row.summary ?? ''}`}
                          onSelect={() => {
                            void handleParentChange(String(row.id));
                            handleOpenChange(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              isSelected ? 'opacity-100 text-[#3CCED7]' : 'opacity-0',
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{row.summary || `Task ${row.id}`}</span>
                            {typeLabel ? (
                              <span className="text-[11px] text-gray-400">{typeLabel}</span>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {inlineError ? (
        <p
          className="mt-1 text-xs text-rose-600"
          role="alert"
          data-testid="task-parent-picker-error"
        >
          {inlineError}
        </p>
      ) : null}
    </div>
  );
}
