'use client';

import React from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import NotionDraftList from '@/components/notion/NotionDraftList';
import NotionEditor from '@/components/notion/NotionEditor';
import { DraftSummary, EditorBlock } from '@/types/notion';

interface NotionLayoutProps {
  drafts: DraftSummary[];
  selectedDraftId: number | null;
  onSelectDraft: (draftId: number | string | null | undefined) => void | Promise<void>;
  onCreateDraft: () => void | Promise<void>;
  onDeleteDraft: (draftId: number) => void | Promise<void>;
  isDraftListLoading: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  lastEditedLabel: string | null;
  onOpenPreview: () => void;
  onImportGoogleDoc: () => void | Promise<void>;
  onExportGoogleDoc: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  isSaving: boolean;
  googleDocsImportBusy: boolean;
  googleDocsExportBusy: boolean;
  hasChanges: boolean;
  isLoadingEditor: boolean;
  blocks: EditorBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<EditorBlock[]>>;
  isPreviewOpen: boolean;
  onClosePreview: () => void;
}

export default function NotionLayout({
  drafts,
  selectedDraftId,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  isDraftListLoading,
  title,
  onTitleChange,
  lastEditedLabel,
  onOpenPreview,
  onImportGoogleDoc,
  onExportGoogleDoc,
  onSave,
  isSaving,
  googleDocsImportBusy,
  googleDocsExportBusy,
  hasChanges,
  isLoadingEditor,
  blocks,
  setBlocks,
  isPreviewOpen,
  onClosePreview,
}: NotionLayoutProps) {
  const router = useRouter();

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <aside className="w-60 flex-shrink-0 bg-[#f7f7f5] border-r border-gray-200 flex flex-col overflow-hidden">

        <div className="px-2 space-y-0.5">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200/70 rounded-md transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
          <button
            type="button"
            onClick={onCreateDraft}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200/70 rounded-md transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New page
          </button>
        </div>

        <div className="mx-3 my-2 border-t border-gray-200" />

        <div className="px-4 mb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Drafts</span>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <NotionDraftList
            drafts={drafts}
            selectedId={selectedDraftId}
            onSelect={onSelectDraft}
            onCreate={onCreateDraft}
            onDelete={onDeleteDraft}
            isLoading={isDraftListLoading}
          />
        </div>
      </aside>

      <div className="flex-1 flex min-h-0 flex-col overflow-hidden bg-white">
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/80 backdrop-blur-sm px-6 py-3 flex items-center gap-4">
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Untitled"
            className="flex-1 border-0 focus:ring-0 text-4xl font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
            disabled={!selectedDraftId}
          />
          {lastEditedLabel && (
            <span aria-live="polite" className="text-sm text-gray-500 whitespace-nowrap">
              {lastEditedLabel}
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPreview}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-60"
              disabled={!selectedDraftId}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onImportGoogleDoc}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white hover:opacity-95 rounded-md transition-colors font-medium disabled:opacity-60"
              disabled={!selectedDraftId || googleDocsImportBusy || googleDocsExportBusy}
            >
              {googleDocsImportBusy ? 'Importing…' : 'Import Doc'}
            </button>
            <button
              type="button"
              onClick={onExportGoogleDoc}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white hover:opacity-95 rounded-md transition-colors font-medium disabled:opacity-60"
              disabled={!selectedDraftId || googleDocsImportBusy || googleDocsExportBusy}
            >
              {googleDocsExportBusy ? 'Exporting…' : 'Export Doc'}
            </button>
            <button
              type="button"
              onClick={onSave}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white hover:opacity-95 rounded-md transition-colors font-medium disabled:opacity-60"
              disabled={!selectedDraftId || isSaving || !hasChanges}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoadingEditor ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              Loading draft…
            </div>
          ) : selectedDraftId ? (
            <div className="h-full">
              <NotionEditor
                blocks={blocks}
                setBlocks={setBlocks}
                draftId={selectedDraftId || undefined}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-3 px-16">
              <h2 className="text-4xl font-bold text-gray-900">No draft selected</h2>
              <p className="max-w-md text-base text-gray-800 leading-relaxed">
                Create a new draft or select one from the sidebar to start writing with
                the Notion-style editor.
              </p>
              <button
                type="button"
                onClick={onCreateDraft}
                className="rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:ring-offset-2"
              >
                New draft
              </button>
            </div>
          )}
        </div>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="relative flex flex-col max-h-[90vh] min-h-[300px] w-full max-w-3xl rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex-shrink-0 h-16 border-b border-gray-200 bg-white px-6 flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{title || 'Untitled'}</h3>
                <p className="text-sm text-gray-500">Preview mode</p>
              </div>
              <button
                type="button"
                onClick={onClosePreview}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                aria-label="Close preview"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 min-h-0">
              {blocks.map((block) => {
                if (block.type === 'divider') {
                  return (
                    <div key={block.id} className="w-full border-t border-gray-300 my-4" />
                  );
                }
                if (
                  block.type === 'image' ||
                  block.type === 'video' ||
                  block.type === 'audio' ||
                  block.type === 'file' ||
                  block.type === 'web_bookmark'
                ) {
                  return (
                    <div
                      key={block.id}
                      className="prose prose-gray max-w-none"
                      dangerouslySetInnerHTML={{ __html: block.html || '' }}
                    />
                  );
                }
                if (!block.html) {
                  return (
                    <div key={block.id} className="text-gray-300 italic">
                      Empty block
                    </div>
                  );
                }
                return (
                  <div
                    key={block.id}
                    className="prose prose-gray max-w-none"
                    dangerouslySetInnerHTML={{ __html: block.html }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
