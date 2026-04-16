'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { NotionDraftAPI } from '@/lib/api/notionDraftApi';
import { createEmptyBlock } from '@/components/notion/NotionEditor';
import NotionLayout from '@/components/notion/NotionLayout';
import { GoogleDocListItem, googleDocsApi } from '@/lib/api/googleDocsApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DraftStatus,
  DraftSummary,
  EditorBlock,
  NotionContentBlockRecord,
} from '@/types/notion';
import { toast } from 'react-hot-toast';

const TODO_STATE_REGEX = /data-todo-state="(checked|unchecked)"/i;
const GOOGLE_DOC_URL_ID_REGEX = /\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i;

const extractGoogleDocId = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(GOOGLE_DOC_URL_ID_REGEX);
  if (match?.[1]) {
    return match[1];
  }
  return trimmed;
};

const addTodoMarkerIfMissing = (html: string) => {
  if (TODO_STATE_REGEX.test(html)) {
    return html;
  }
  const safeHtml = html && html.trim() ? html : '<br>';
  return `<span data-todo-state="unchecked"></span>${safeHtml}`;
};

const blockFromRecord = (
  record: NotionContentBlockRecord,
  fallbackId: string
): EditorBlock => {
  const content = record?.content ?? {};
  const fromHtml = typeof content.html === 'string' ? content.html : undefined;
  const fromText = typeof content.text === 'string' ? content.text : undefined;

  // Handle media blocks
  if (record.type === 'image' || record.type === 'video' || record.type === 'audio' || record.type === 'file') {
    const fileUrl = content.file_url || content.url;
    const filename = content.filename || '';
    if (fileUrl) {
      return createEmptyBlock(record.type, {
        file_url: fileUrl,
        filename,
        file_size: content.file_size,
        content_type: content.content_type,
      });
    }
  }
  
  if (record.type === 'web_bookmark') {
    const url = content.url;
    if (url) {
      return createEmptyBlock(record.type, {
        url,
        title: content.title || '',
        description: content.description || '',
        favicon: content.favicon || '',
      });
    }
  }

  let fromRichText: string | undefined;
  if (!fromHtml && !fromText) {
    const richText = Array.isArray(content.content)
      ? content.content
      : Array.isArray(content.rich_text)
      ? content.rich_text
      : null;
    if (richText) {
      fromRichText = richText
        .map((item: any) => {
          if (!item) return '';
          if (typeof item === 'string') return item;
          if (item?.text?.content) return item.text.content;
          if (item?.plain_text) return item.plain_text;
          return '';
        })
        .join('');
    }
  }

  const resolvedHtml = fromHtml ?? fromText ?? fromRichText ?? '';

  let normalizedHtml = resolvedHtml;
  if (record.type === 'todo_list') {
    normalizedHtml = addTodoMarkerIfMissing(resolvedHtml);
  }
  if (record.type === 'divider') {
    normalizedHtml = normalizedHtml || '<hr />';
  }

  const result: EditorBlock = {
    id: typeof record.id === 'string' ? record.id : fallbackId,
    type: record.type || 'rich_text',
    html: normalizedHtml,
  };

  // Handle code block language
  if (record.type === 'code' && content.language) {
    result.language = content.language;
  }

  return result;
};

const convertContentBlocksFromApi = (
  records: NotionContentBlockRecord[] | undefined
): EditorBlock[] => {
  if (!records || records.length === 0) {
    return [createEmptyBlock()];
  }
  return records.map((record, index) =>
    blockFromRecord(record, `block_${index}_${Date.now()}`)
  );
};

const convertBlocksToPayload = (
  blocks: EditorBlock[]
): NotionContentBlockRecord[] =>
  blocks.map((block, order) => {
    // Handle media blocks - extract content from HTML
    if (block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'file') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = block.html;
      const img = tempDiv.querySelector('img');
      const video = tempDiv.querySelector('video');
      const audio = tempDiv.querySelector('audio');
      const link = tempDiv.querySelector('a');
      
      const fileUrl = img?.getAttribute('src') || video?.getAttribute('src') || audio?.getAttribute('src') || link?.getAttribute('href') || '';
      const filename = img?.getAttribute('alt') || link?.textContent?.trim() || '';
      
      return {
        id: block.id,
        type: block.type,
        order,
        content: {
          file_url: fileUrl,
          filename,
        },
      };
    }
    
    if (block.type === 'web_bookmark') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = block.html;
      const link = tempDiv.querySelector('a');
      const url = link?.getAttribute('href') || '';
      const titleEl = tempDiv.querySelector('.font-medium');
      const descEl = tempDiv.querySelector('.text-sm');
      const faviconEl = tempDiv.querySelector('img');
      
      return {
        id: block.id,
        type: block.type,
        order,
        content: {
          url,
          title: titleEl?.textContent?.trim() || '',
          description: descEl?.textContent?.trim() || '',
          favicon: faviconEl?.getAttribute('src') || '',
        },
      };
    }
    
    // Handle code blocks with language
    if (block.type === 'code') {
      return {
        id: block.id,
        type: block.type,
        order,
        content: {
          html: block.html,
          language: block.language || 'plain',
        },
      };
    }
    
    return {
      id: block.id,
      type: block.type || 'rich_text',
      order,
      content: {
        html: block.type === 'divider' ? block.html || '<hr />' : block.html,
      },
    };
  });

const buildSnapshot = (title: string, status: string, blocks: EditorBlock[]) =>
  JSON.stringify({
    title,
    status,
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      html: block.html,
      ...(block.language !== undefined && { language: block.language }),
    })),
  });

function NotionPageContent() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  // Initialize selectedDraftId from localStorage if available
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notion_selected_draft_id');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return null;
  });
  const [isLoadingDrafts, setIsLoadingDrafts] = useState<boolean>(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('Untitled');
  const [status, setStatus] = useState<DraftStatus>('draft');
  const [blocks, setBlocks] = useState<EditorBlock[]>([createEmptyBlock()]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [lastEditedAt, setLastEditedAt] = useState<Date | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);
  const [googleDocsImportBusy, setGoogleDocsImportBusy] = useState<boolean>(false);
  const [googleDocsExportBusy, setGoogleDocsExportBusy] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importDocumentId, setImportDocumentId] = useState<string>('');
  const [googleDocsListLoading, setGoogleDocsListLoading] = useState<boolean>(false);
  const [googleDocsDocuments, setGoogleDocsDocuments] = useState<GoogleDocListItem[]>([]);
  const [googleDocsListError, setGoogleDocsListError] = useState<string | null>(null);

  const router = useRouter();
  const snapshotRef = useRef<string>(buildSnapshot(title, status, blocks));

  const handleNavigateAway = useCallback(
    (destination: string) => {
      if (!hasChanges) {
        router.push(destination);
        return;
      }
      toast(
        (t: { id: string }) => (
          <div className="flex items-center gap-4 bg-white rounded-lg shadow-lg border border-gray-100 px-4 py-3 min-w-[300px]">
            <div className="flex items-center gap-2 flex-1">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Unsaved changes will be lost</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  router.push(destination);
                }}
                className="px-3 py-1 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
              >
                Leave
              </button>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Stay
              </button>
            </div>
          </div>
        ),
        {
          duration: 6000,
          position: 'bottom-center',
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }
      );
    },
    [hasChanges, router]
  );

  const syncSnapshot = useCallback(
    (nextTitle: string, nextStatus: string, nextBlocks: EditorBlock[]) => {
      snapshotRef.current = buildSnapshot(nextTitle, nextStatus, nextBlocks);
      setHasChanges(false);
    },
    []
  );

  const loadDraftDetail = useCallback(
    async (draftId: number | string | null | undefined) => {
      // Validate draftId
      if (!draftId || draftId === null || draftId === undefined) {
        toast.error('Invalid draft ID');
        return;
      }
      
      // Convert to number if it's a string
      const numericId = typeof draftId === 'string' ? parseInt(draftId, 10) : draftId;
      if (isNaN(numericId) || numericId <= 0) {
        toast.error('Invalid draft ID');
        return;
      }
      
      setIsLoadingEditor(true);
      try {
        const draft = await NotionDraftAPI.getDraft(numericId);
        const nextBlocks = convertContentBlocksFromApi(draft.content_blocks || []);
        
        setSelectedDraftId(numericId);
        // Save selected draft ID to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('notion_selected_draft_id', numericId.toString());
        }
        setBlocks(nextBlocks);
        const nextTitle = draft.title || 'Untitled';
        const nextStatus = (draft.status as DraftStatus) || 'draft';
        setTitle(nextTitle);
        setStatus(nextStatus);
        // Reset lastEditedAt when loading a draft (user hasn't edited yet)
        setLastEditedAt(null);
        setHasChanges(false);
        syncSnapshot(nextTitle, nextStatus, nextBlocks);
        
        // Focus the first block after loading
        setTimeout(() => {
          const firstBlock = document.querySelector('[data-block-id]') as HTMLElement;
          if (firstBlock) {
            firstBlock.focus();
          }
        }, 100);
      } catch (error: any) {
        console.error('Failed to load draft:', error);
        const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to load draft';
        toast.error(errorMessage);
        // Reset state on error
        setSelectedDraftId(null);
        setBlocks([createEmptyBlock()]);
      } finally {
        setIsLoadingEditor(false);
      }
    },
    [syncSnapshot]
  );

  const refreshDrafts = useCallback(async () => {
    setIsLoadingDrafts(true);
    try {
      const data = await NotionDraftAPI.listDrafts();
      console.log('refreshDrafts: API response:', data);
      
      // Ensure data is always an array
      const safeData = Array.isArray(data) ? data : [];
      console.log('refreshDrafts: safeData:', safeData);
      console.log('refreshDrafts: safeData length:', safeData.length);
      
      // Validate and filter drafts with valid IDs
      const validDrafts = safeData.filter((draft) => {
        return draft && draft.id !== undefined && draft.id !== null;
      });
      console.log('refreshDrafts: validDrafts:', validDrafts);
      console.log('refreshDrafts: validDrafts length:', validDrafts.length);
      
      // Use functional update to preserve current state if needed
      setDrafts((prev) => {
        console.log('refreshDrafts: Previous drafts:', prev);
        console.log('refreshDrafts: Previous drafts length:', prev.length);
        console.log('refreshDrafts: Current selectedDraftId:', selectedDraftId);
        
        // If we have a selected draft, check if it's in the refreshed list
        const currentSelectedId = selectedDraftId;
        if (currentSelectedId) {
          const selectedDraftInList = validDrafts.find((d) => d.id === currentSelectedId);
          console.log('refreshDrafts: Selected draft in list:', selectedDraftInList);
          
          if (selectedDraftInList) {
            // If found, use the refreshed list (it will be sorted by updated_at)
            console.log('refreshDrafts: Using refreshed list with selected draft');
            return validDrafts;
          } else {
            // If not found in refreshed list, keep it from previous state
            const selectedDraft = prev.find((d) => d.id === currentSelectedId);
            console.log('refreshDrafts: Selected draft not in list, keeping from prev:', selectedDraft);
            
            if (selectedDraft) {
              // Merge: put selected draft at top, then refreshed drafts
              const otherDrafts = validDrafts.filter((d) => d.id !== currentSelectedId);
              const result = [selectedDraft, ...otherDrafts];
              console.log('refreshDrafts: Merged result:', result);
              return result;
            }
          }
        }
        // Default: use the refreshed list
        console.log('refreshDrafts: Using refreshed list (default)');
        return validDrafts;
      });
      
      // Only auto-load first draft if no draft is currently selected
      if (validDrafts.length > 0) {
        // Don't auto-load if a draft is already selected
      } else {
        // Only reset if we have no drafts and no current selection
        setSelectedDraftId((currentId) => {
          if (!currentId) {
            const defaultBlocks = [createEmptyBlock()];
            setBlocks(defaultBlocks);
            setTitle('Untitled');
            setStatus('draft');
            setLastEditedAt(null);
            syncSnapshot('Untitled', 'draft', defaultBlocks);
          }
          return currentId;
        });
      }
    } catch (error) {
      console.error('Failed to refresh drafts:', error);
      toast.error('Unable to load drafts');
      // Don't clear drafts on error - preserve current state
      setDrafts((prev) => prev);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [selectedDraftId, syncSnapshot]);

  // Only refresh drafts on initial mount, not on every refreshDrafts change
  useEffect(() => {
    const loadInitialDraft = async () => {
      try {
        const data = await NotionDraftAPI.listDrafts();
        const safeData = Array.isArray(data) ? data : [];
        const validDrafts = safeData.filter((draft) => {
          return draft && draft.id !== undefined && draft.id !== null;
        });
        
        setDrafts(validDrafts);
        
        // After refreshing drafts, try to load the saved draft ID from localStorage
        if (typeof window !== 'undefined') {
          const savedDraftId = localStorage.getItem('notion_selected_draft_id');
          if (savedDraftId) {
            const parsedId = parseInt(savedDraftId, 10);
            if (!isNaN(parsedId) && parsedId > 0) {
              // Check if the draft exists in the refreshed list
              const draftExists = validDrafts.some((d) => d.id === parsedId);
              if (draftExists) {
                // Load the draft after a short delay to ensure drafts list is ready
                setTimeout(() => {
                  loadDraftDetail(parsedId);
                }, 100);
              } else {
                // Draft doesn't exist, clear the saved ID
                localStorage.removeItem('notion_selected_draft_id');
                setSelectedDraftId(null);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load initial drafts:', error);
        toast.error('Unable to load drafts');
      } finally {
        setIsLoadingDrafts(false);
      }
    };
    
    loadInitialDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  useEffect(() => {
    if (!selectedDraftId) {
      setHasChanges(false);
      return;
    }
    const snapshot = buildSnapshot(title, status, blocks);
    const hasChangesNow = snapshot !== snapshotRef.current;
    setHasChanges(hasChangesNow);
    
    // Update lastEditedAt when content changes
    if (hasChangesNow) {
      setLastEditedAt(new Date());
    }
  }, [blocks, selectedDraftId, status, title]);

  const handleCreateDraft = useCallback(async () => {
    try {
      setIsSaving(true);
      const initialBlocks = [createEmptyBlock()];
      const payload = {
        title: 'Untitled draft',
        status: 'draft' as DraftStatus,
        content_blocks: convertBlocksToPayload(initialBlocks),
      };
      const draft = await NotionDraftAPI.createDraft(payload);
      
      // Validate that draft.id exists
      if (!draft.id) {
        throw new Error('Draft created but id is missing');
      }
      
      // Convert content blocks from API response
      const nextBlocks = convertContentBlocksFromApi(draft.content_blocks || []);
      const nextTitle = draft.title || 'Untitled draft';
      const nextStatus = (draft.status as DraftStatus) || 'draft';
      
      // Update state immediately so editor shows
      setSelectedDraftId(draft.id);
      // Save selected draft ID to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('notion_selected_draft_id', draft.id.toString());
      }
      setBlocks(nextBlocks);
      setTitle(nextTitle);
      setStatus(nextStatus);
      // Reset lastEditedAt when creating a draft (user hasn't edited yet)
      setLastEditedAt(null);
      setHasChanges(false);
      setIsLoadingEditor(false);
      syncSnapshot(nextTitle, nextStatus, nextBlocks);
      
      // Refresh drafts list to update the UI (in background, don't wait)
      NotionDraftAPI.listDrafts()
        .then((data) => {
          const safeData = Array.isArray(data) ? data : [];
          setDrafts(safeData);
        })
        .catch(() => {
          // Continue even if list refresh fails
        });
      
      toast.success('Draft created');
      
      // Focus the editor after a short delay to ensure it's rendered
      setTimeout(() => {
        const firstBlock = document.querySelector('[data-block-id]') as HTMLElement;
        if (firstBlock) {
          firstBlock.focus();
        }
      }, 100);
    } catch (error: any) {
      console.error('Failed to create draft:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to create draft';
      toast.error(errorMessage);
      // Reset state on error
      setSelectedDraftId(null);
      setBlocks([createEmptyBlock()]);
      setIsLoadingEditor(false);
    } finally {
      setIsSaving(false);
    }
  }, [syncSnapshot]);

  const performDeleteDraft = useCallback(
    async (draftId: number) => {
      try {
        setDeletingDraftId(draftId);
        await NotionDraftAPI.deleteDraft(draftId);
        setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
        toast.success('Draft deleted');
        if (selectedDraftId === draftId) {
          const remaining = drafts.filter((draft) => draft.id !== draftId);
          if (remaining.length > 0) {
            await loadDraftDetail(remaining[0].id);
          } else {
            const defaultBlocks = [createEmptyBlock()];
            setSelectedDraftId(null);
            // Clear saved draft ID from localStorage
            if (typeof window !== 'undefined') {
              localStorage.removeItem('notion_selected_draft_id');
            }
            setBlocks(defaultBlocks);
            setTitle('Untitled');
            setStatus('draft');
            setLastEditedAt(null);
            syncSnapshot('Untitled', 'draft', defaultBlocks);
          }
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete draft');
      } finally {
        setDeletingDraftId(null);
      }
    },
    [drafts, loadDraftDetail, selectedDraftId, syncSnapshot]
  );

  const handleDeleteDraft = useCallback(
    (draftId: number) => {
      toast(
        (t) => (
          <div className="flex items-center gap-4 bg-white rounded-lg shadow-lg border border-gray-100 px-4 py-3 min-w-[280px]">
            <div className="flex items-center gap-2 flex-1">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Delete this draft?</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  performDeleteDraft(draftId);
                }}
                className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        {
          duration: 4000,
          position: 'bottom-center',
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }
      );
    },
    [performDeleteDraft]
  );

  const handleSave = useCallback(async () => {
    if (!selectedDraftId) {
      toast.error('Select a draft to save');
      return;
    }
    try {
      setIsSaving(true);
      const payload = {
        title: title.trim() || 'Untitled',
        status,
        content_blocks: convertBlocksToPayload(blocks),
      };
      const updated = await NotionDraftAPI.updateDraft(selectedDraftId, payload);
      console.log('Update API response:', updated);
      console.log('Update API response keys:', Object.keys(updated));
      
      // Use selectedDraftId if id is missing from response (backend serializer issue)
      const draftId = updated.id || selectedDraftId;
      if (!draftId) {
        console.error('No draft ID available!', { updated, selectedDraftId });
        throw new Error('Draft ID is missing from update response');
      }
      
      // Create updated summary from the response
      // UpdateDraftSerializer returns minimal fields, so we use existing draft data for other fields
      const existingDraft = drafts.find(d => d.id === draftId);
      const updatedSummary: DraftSummary = {
        id: draftId,
        title: updated.title || 'Untitled',
        status: updated.status || 'draft',
        user_email: existingDraft?.user_email || '',
        content_blocks_count: blocks.length,
        created_at: existingDraft?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      console.log('Created updatedSummary:', updatedSummary);
      
      // Update the draft in the list and move it to the top (most recently updated)
      // Use functional update to ensure we're working with the latest state
      setDrafts((prev) => {
        console.log('Previous drafts before update:', prev);
        console.log('Previous drafts length:', prev.length);
        console.log('Selected draft ID:', selectedDraftId);
        
        // Ensure we have a valid previous state
        if (!prev || prev.length === 0) {
          console.log('No previous drafts, returning new list with updatedSummary');
          return [updatedSummary];
        }
        
        // Check if the draft already exists in the list
        const existingIndex = prev.findIndex((draft) => draft.id === selectedDraftId);
        console.log('Existing index:', existingIndex);
        
        if (existingIndex >= 0) {
          // If draft exists, replace it and move to top
          const newDrafts = [...prev];
          newDrafts[existingIndex] = updatedSummary;
          // Move to top
          const result = [updatedSummary, ...newDrafts.filter((d) => d.id !== selectedDraftId)];
          console.log('Draft exists, new list:', result);
          console.log('New list length:', result.length);
          return result;
        } else {
          // If draft doesn't exist, add it to the top
          const result = [updatedSummary, ...prev];
          console.log('Draft does not exist, adding to top:', result);
          console.log('New list length:', result.length);
          return result;
        }
      });
      
      // Verify the update after a short delay
      setTimeout(() => {
        setDrafts((current) => {
          console.log('Drafts after update (delayed check):', current);
          console.log('Drafts length after update:', current.length);
          const draftExists = current.some((d) => d.id === selectedDraftId);
          console.log('Draft exists in list:', draftExists);
          if (!draftExists) {
            console.error('Draft disappeared! Attempting to restore...');
            // Try to restore
            const restored = [updatedSummary, ...current];
            console.log('Restored list:', restored);
            return restored;
          }
          return current;
        });
      }, 200);
      
      const nextBlocks = convertContentBlocksFromApi(updated.content_blocks);
      setBlocks(nextBlocks);
      const nextTitle = updated.title || 'Untitled';
      const nextStatus = (updated.status as DraftStatus) || 'draft';
      setTitle(nextTitle);
      setStatus(nextStatus);
      // Reset lastEditedAt after saving (content is synced, no unsaved edits)
      setLastEditedAt(null);
      
      // Update snapshot AFTER state updates to avoid triggering refreshDrafts
      syncSnapshot(nextTitle, nextStatus, nextBlocks);
      setHasChanges(false);
      toast.success('Draft saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [blocks, selectedDraftId, status, syncSnapshot, title]);

  const lastEditedLabel = useMemo(() => {
    if (!lastEditedAt) return null;
    const delta = Date.now() - lastEditedAt.getTime();
    const seconds = Math.floor(delta / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) {
      return 'Last edited just now';
    } else if (minutes < 60) {
      return `Last edited ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (hours < 24) {
      return `Last edited ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (days < 7) {
      return `Last edited ${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else if (weeks < 4) {
      return `Last edited ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (months < 12) {
      return `Last edited ${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
      return `Last edited ${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
  }, [lastEditedAt]);

  const htmlToPlainText = useCallback((html: string) => {
    if (typeof window === 'undefined') return html;
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return (temp.textContent || temp.innerText || '').trim();
  }, []);

  const plainTextToHtml = useCallback((text: string) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/\n/g, '<br>');
  }, []);

  const handleOpenImportGoogleDoc = useCallback(() => {
    if (!selectedDraftId) {
      toast.error('Select a draft first.');
      return;
    }
    setImportDocumentId('');
    setGoogleDocsDocuments([]);
    setGoogleDocsListError(null);
    setIsImportModalOpen(true);
  }, [selectedDraftId]);

  useEffect(() => {
    if (!isImportModalOpen) return;
    let cancelled = false;
    const loadDocuments = async () => {
      try {
        setGoogleDocsListLoading(true);
        const docs = await googleDocsApi.listDocuments(30);
        if (!cancelled) {
          setGoogleDocsDocuments(docs);
          setGoogleDocsListError(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setGoogleDocsDocuments([]);
          const message =
            error?.response?.data?.error || 'Failed to load Google Docs files. You can paste a Doc URL/ID.';
          setGoogleDocsListError(message);
        }
      } finally {
        if (!cancelled) {
          setGoogleDocsListLoading(false);
        }
      }
    };
    loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [isImportModalOpen]);

  const handleConfirmImportGoogleDoc = useCallback(async () => {
    if (!selectedDraftId) return;
    const normalizedDocumentId = extractGoogleDocId(importDocumentId);
    if (!normalizedDocumentId) {
      toast.error('Please select a document or paste a Google Doc URL/ID.');
      return;
    }
    try {
      setGoogleDocsImportBusy(true);
      const payload = await googleDocsApi.importDocument(normalizedDocumentId);
      const importedTitle = payload?.title || title;
      const importedContent = payload?.content || '';
      const importedHtml = payload?.content_html || plainTextToHtml(importedContent);
      const block = createEmptyBlock('rich_text');
      block.html = importedHtml;
      setTitle(importedTitle);
      setBlocks([block]);
      setLastEditedAt(new Date());
      setHasChanges(true);
      setIsImportModalOpen(false);
      toast.success('Imported Google Doc into this draft. Click Save to persist.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to import Google Doc.');
    } finally {
      setGoogleDocsImportBusy(false);
    }
  }, [importDocumentId, plainTextToHtml, selectedDraftId, title]);

  const handleExportGoogleDoc = useCallback(async () => {
    if (!selectedDraftId) {
      toast.error('Select a draft first.');
      return;
    }
    try {
      setGoogleDocsExportBusy(true);
      const content = blocks
        .map((block) => {
          if (block.type === 'divider') return '----------------';
          return htmlToPlainText(block.html || '');
        })
        .filter((line) => line.length > 0)
        .join('\n\n');

      const payload = await googleDocsApi.exportRawContent(title || 'Untitled', content);
      if (payload?.url) {
        window.open(payload.url, '_blank');
      }
      toast.success('Exported to Google Docs.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to export Google Doc.');
    } finally {
      setGoogleDocsExportBusy(false);
    }
  }, [blocks, htmlToPlainText, selectedDraftId, title]);

  return (
    <Layout
      showHeader={true}
      showSidebar={true}
      unsavedChangesGuard={
        hasChanges ? { hasChanges, onNavigateAway: handleNavigateAway } : undefined
      }
    >
      <NotionLayout
        drafts={drafts}
        selectedDraftId={selectedDraftId}
        onSelectDraft={loadDraftDetail}
        onCreateDraft={handleCreateDraft}
        onDeleteDraft={handleDeleteDraft}
        isDraftListLoading={isLoadingDrafts || deletingDraftId !== null}
        title={title}
        onTitleChange={setTitle}
        lastEditedLabel={lastEditedLabel}
        onOpenPreview={() => setIsPreviewOpen(true)}
        onImportGoogleDoc={handleOpenImportGoogleDoc}
        onExportGoogleDoc={handleExportGoogleDoc}
        onSave={handleSave}
        isSaving={isSaving}
        googleDocsImportBusy={googleDocsImportBusy}
        googleDocsExportBusy={googleDocsExportBusy}
        hasChanges={hasChanges}
        isLoadingEditor={isLoadingEditor}
        blocks={blocks}
        setBlocks={setBlocks}
        isPreviewOpen={isPreviewOpen}
        onClosePreview={() => setIsPreviewOpen(false)}
      />
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Google Doc</DialogTitle>
            <DialogDescription>
              Select a Google Doc from the list. If listing is unavailable, paste a Doc URL or ID.
            </DialogDescription>
          </DialogHeader>
          {googleDocsListError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {googleDocsListError}
            </div>
          ) : null}
          <div className="max-h-[320px] overflow-y-auto rounded-md border border-gray-200">
            {googleDocsListLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Loading Google Docs...</div>
            ) : googleDocsDocuments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No Google Docs files found for this connected account.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {googleDocsDocuments.map((doc) => {
                  const selected = importDocumentId === doc.id;
                  return (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => setImportDocumentId(doc.id)}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          selected ? 'bg-emerald-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {doc.modified_time
                            ? `Updated ${new Date(doc.modified_time).toLocaleString()}`
                            : 'No modified time'}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="google-doc-url-or-id" className="text-sm font-medium text-gray-700">
              Google Doc URL or ID
            </label>
            <input
              id="google-doc-url-or-id"
              value={importDocumentId}
              onChange={(event) => setImportDocumentId(event.target.value)}
              placeholder="https://docs.google.com/document/d/... or document ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              disabled={googleDocsImportBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImportGoogleDoc}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={googleDocsImportBusy || !importDocumentId.trim()}
            >
              {googleDocsImportBusy ? 'Importing…' : 'Import'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

export default function NotionPage() {
  return (
    <ProtectedRoute>
      <NotionPageContent />
    </ProtectedRoute>
  );
}

