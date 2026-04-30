'use client';

import React, { useState } from 'react';
import { FileText, MoreHorizontal, Copy, Download, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotionStatusPill from './NotionStatusPill';
import type { DraftSummary } from '@/types/notion';

const formatTimestamp = (value: string) => {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const delta = Date.now() - date.getTime();
    const minutes = Math.floor(delta / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
};

interface NotionDraftCardProps {
  draft: DraftSummary;
  onOpen: (id: number) => void;
  onDuplicate: (id: number) => void;
  onExport: (id: number, title: string) => void;
  onDelete: (id: number) => void;
}

export default function NotionDraftCard({
  draft,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
}: NotionDraftCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-prevent-open]')) return;
    onOpen(draft.id);
  };

  const handleDeleteSelect = () => {
    setIsMenuOpen(false);
    window.setTimeout(() => onDelete(draft.id), 150);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(draft.id);
        }
      }}
      className="group w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:border-[#3CCED7]/30 hover:bg-gray-50/80 transition cursor-pointer"
    >
      <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#3CCED7]/15 to-[#A6E661]/15 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-[#3CCED7]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {draft.title || 'Untitled'}
          </h3>
          <NotionStatusPill status={draft.status} />
        </div>
        <div className="mt-0.5 text-xs text-gray-500 truncate">
          Updated {formatTimestamp(draft.updated_at)} · {draft.content_blocks_count}{' '}
          {draft.content_blocks_count === 1 ? 'block' : 'blocks'}
          {draft.user_email ? ` · ${draft.user_email}` : ''}
        </div>
      </div>
      <div data-prevent-open className="shrink-0">
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="Draft actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44"
            data-prevent-open
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem onSelect={() => onDuplicate(draft.id)}>
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport(draft.id, draft.title)}>
              <Download className="w-4 h-4 mr-2" /> Download JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(event) => event.stopPropagation()}
              onSelect={handleDeleteSelect}
              className="text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
