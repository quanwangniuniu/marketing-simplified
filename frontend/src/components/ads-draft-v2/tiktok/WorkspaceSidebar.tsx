'use client';

import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AdGroupBriefInfo, BriefInfoItem } from '@/lib/api/tiktokApi';

interface Props {
  groups: AdGroupBriefInfo[];
  selectedDraftId: string | null;
  selectedGroupId: string | null;
  onSelect: (draftId: string, groupId: string) => void;
  onCreateGroup: () => void;
  onCreateDraft: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteDraft: (draftId: string, groupId: string) => void;
  loading?: boolean;
}

const EYEBROW =
  'text-[11px] font-medium uppercase tracking-wide text-gray-500';

export default function WorkspaceSidebar({
  groups,
  selectedDraftId,
  selectedGroupId,
  onSelect,
  onCreateGroup,
  onCreateDraft,
  onDeleteGroup,
  onDeleteDraft,
  loading,
}: Props) {
  const groupsWithCounts = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        draftCount: group.creative_brief_info_item_list?.length ?? 0,
      })),
    [groups]
  );

  const initialExpanded = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((group) => set.add(group.id));
    return set;
  }, [groups]);
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      groups.forEach((group) => next.add(group.id));
      return next;
    });
  }, [groups]);

  const toggle = (groupId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className={EYEBROW}>Ad groups</span>
        <button
          type="button"
          onClick={onCreateGroup}
          title="New group"
          aria-label="New group"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && groupsWithCounts.length === 0 ? (
          <div className="px-2 py-4 text-xs text-gray-400">Loading…</div>
        ) : groupsWithCounts.length === 0 ? (
          <div className="px-2 py-4 text-xs text-gray-500">
            No ad groups yet. Click the + icon above to create your first group.
          </div>
        ) : (
          <ul className="space-y-1">
            {groupsWithCounts.map((group) => {
              const isOpen = expanded.has(group.id);
              const isGroupActive = selectedGroupId === group.id && !selectedDraftId;
              return (
                <li key={group.id}>
                  <div
                    className={`group/row flex items-center gap-1 rounded-md px-2 py-1.5 transition ${
                      isGroupActive ? 'bg-[#3CCED7]/10' : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(group.id)}
                      aria-label={isOpen ? 'Collapse group' : 'Expand group'}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition hover:text-gray-700"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-gray-900">
                        {group.name || 'Untitled group'}
                      </div>
                      <div className="truncate text-[10px] text-gray-400">
                        {group.gid} · {group.draftCount} draft{group.draftCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateDraft(group.id);
                      }}
                      aria-label="New draft in group"
                      title="New draft"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover/row:opacity-100"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteGroup(group.id);
                      }}
                      aria-label="Delete group"
                      title="Delete group"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover/row:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>

                  {isOpen && (
                    <ul className="ml-6 mt-1 space-y-0.5">
                      {group.creative_brief_info_item_list.map((draft: BriefInfoItem) => {
                        const isActive = selectedDraftId === draft.id;
                        return (
                          <li key={draft.id}>
                            <div
                              className={`group/draft flex items-center gap-2 rounded-md px-2 py-1 transition ${
                                isActive
                                  ? 'bg-[#3CCED7]/10 text-[#0E8A96]'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => onSelect(draft.id, group.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="truncate text-xs font-medium">
                                  {draft.name || 'Unnamed draft'}
                                </div>
                                <div className="truncate text-[10px] text-gray-400">
                                  {draft.ad_draft_id} · {draft.creative_type || 'UNKNOWN'}
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteDraft(draft.id, group.id);
                                }}
                                aria-label="Delete draft"
                                title="Delete draft"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover/draft:opacity-100"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                      <li>
                        <button
                          type="button"
                          onClick={() => onCreateDraft(group.id)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          New draft
                        </button>
                      </li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
