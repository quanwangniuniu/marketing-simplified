'use client';

import React from 'react';
import { DraftSummary } from '@/types/notion';

interface NotionDraftListProps {
  drafts: DraftSummary[];
  selectedId: number | null;
  onSelect: (draftId: number) => void;
  onCreate: () => void;
  onDelete?: (draftId: number) => void;
  isLoading?: boolean;
}

const formatTimestamp = (value: string) => {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export default function NotionDraftList({
  drafts,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  isLoading = false,
}: NotionDraftListProps) {
  // Ensure drafts is always an array
  const safeDrafts = Array.isArray(drafts) ? drafts : [];

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 rounded-md bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      ) : safeDrafts.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 leading-relaxed">
          No drafts yet. Click <span className="font-semibold">New</span> to
          start a document.
        </div>
      ) : (
        <ul className="py-2">
          {safeDrafts.map((draft) => {
            // Validate draft.id exists and is valid
            if (!draft || draft.id === undefined || draft.id === null) {
              return null;
            }

            // Ensure draft.id is a valid number or string
            const draftId = typeof draft.id === 'string' ? parseInt(draft.id, 10) : draft.id;
            if (isNaN(draftId) || draftId <= 0) {
              return null;
            }

            const isSelected = draftId === selectedId;
            const timestamp = formatTimestamp(draft.updated_at);
            return (
              <li key={draftId} className="group">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draftId) {
                      onSelect(draftId);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (draftId) {
                        onSelect(draftId);
                      }
                    }
                  }}
                  className={`w-full text-left py-1.5 px-3 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#3CCED7]/8 border-l-2 border-[#3CCED7]'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <p
                    className={`text-sm truncate min-w-0 max-w-full ${
                      isSelected ? 'text-[#3CCED7] font-medium' : 'text-gray-900'
                    }`}
                  >
                    {draft.title || 'Untitled'}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {timestamp}
                    </span>
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDelete(draft.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-red-500 transition-opacity"
                        aria-label="Delete draft"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.5 3a1 1 0 00-.894.553L7.382 4H5a1 1 0 100 2h10a1 1 0 100-2h-2.382l-.224-.447A1 1 0 0011.5 3h-3zm-3 5a1 1 0 011 1v6a1 1 0 102 0V9a1 1 0 112 0v6a1 1 0 102 0V9a1 1 0 112 0v6a3 3 0 01-3 3H8.5a3 3 0 01-3-3V9a1 1 0 011-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
