'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Monitor,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  ArrowLeft,
  Mail,
  Image as ImageIcon,
  Type,
  RectangleHorizontal,
  Minus,
  Square,
  Video,
  Share2,
  Code,
  Columns2,
  Columns3,
  Columns4,
  Menu,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import { EmailDraftStatusPill } from '@/components/email-draft-v2';
import {
  CanvasBlocks,
  CanvasBlock,
  TextStyles,
} from '@/components/mailchimp/email-builder/types';
import { useEmailBuilder } from '@/components/mailchimp/email-builder/hooks/useEmailBuilder';
import { useKlaviyoDragAndDrop } from '@/components/klaviyo/useKlaviyoDragAndDrop';
import { useUndoRedo } from '@/components/mailchimp/email-builder/hooks/useUndoRedo';
import KlaviyoNavigationSidebar from '@/components/klaviyo/KlaviyoNavigationSidebar';
import KlaviyoSectionBlocks from '@/components/klaviyo/KlaviyoSectionBlocks';
import KlaviyoTextInspector from '@/components/klaviyo/KlaviyoTextInspector';
import KlaviyoSpacerInspector from '@/components/klaviyo/KlaviyoSpacerInspector';
import KlaviyoSocialLinksInspector from '@/components/klaviyo/KlaviyoSocialLinksInspector';
import KlaviyoButtonInspector from '@/components/klaviyo/KlaviyoButtonInspector';
import KlaviyoImageInspector from '@/components/klaviyo/KlaviyoImageInspector';
import KlaviyoHeaderBarInspector from '@/components/klaviyo/KlaviyoHeaderBarInspector';
import KlaviyoVideoInspector from '@/components/klaviyo/KlaviyoVideoInspector';
import KlaviyoHtmlInspector from '@/components/klaviyo/KlaviyoHtmlInspector';
import KlaviyoColorPicker from '@/components/klaviyo/KlaviyoColorPicker';
import PreviewPanel from '@/components/mailchimp/email-builder/components/PreviewPanel';
import BlockBackgroundPicker from '@/components/mailchimp/email-builder/components/BlockBackgroundPicker';
import BorderColorPicker from '@/components/mailchimp/email-builder/components/BorderColorPicker';
import { klaviyoApi } from '@/lib/api/klaviyoApi';
import {
  contentBlocksToCanvasBlocks,
  canvasBlocksToContentBlocks,
  createDefaultCanvasBlocks,
} from '@/lib/utils/klaviyoTransform';

type EmailBuilderSnapshot = {
  canvasBlocks: CanvasBlocks;
};

export default function KlaviyoDetailV2Page() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const draftIdParam = params?.draftId as string | undefined;
  const parsedDraftId = draftIdParam ? Number(draftIdParam) : NaN;
  const draftId =
    Number.isInteger(parsedDraftId) && parsedDraftId > 0 ? parsedDraftId : null;
  const hasInvalidDraftId = Boolean(draftIdParam) && draftId == null;
  const returnTo = searchParams?.get('returnTo');

  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/klaviyo';

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load state
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('Untitled template');
  const [draftSubject, setDraftSubject] = useState<string>('Untitled template');
  const [draftStatus, setDraftStatus] = useState<string | null>('draft');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDraftName, setTempDraftName] = useState<string>('Untitled template');

  // Builder state via hook
  const builderState = useEmailBuilder();
  const {
    activeNav,
    setActiveNav,
    deviceMode,
    setDeviceMode,
    isPreviewOpen,
    setIsPreviewOpen,
    previewTab,
    setPreviewTab,
    showMoreBlocks,
    setShowMoreBlocks,
    showMoreLayouts,
    setShowMoreLayouts,
    canvasBlocks,
    setCanvasBlocks,
    selectedBlock,
    setSelectedBlock,
    setSelectedSection,
    hoveredBlock,
    setHoveredBlock,
    removeBlock,
    updateLayoutColumns,
  } = builderState;

  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Selected block resolution (supports nested layout columns)
  const selectedBlockData = React.useMemo(() => {
    if (!selectedBlock) return null;
    if (selectedBlock.layoutBlockId && selectedBlock.columnIndex !== undefined) {
      const sectionBlocks =
        canvasBlocks[selectedBlock.section as keyof typeof canvasBlocks];
      if (!sectionBlocks) return null;
      const layoutBlock = sectionBlocks.find(
        (block) => block.id === selectedBlock.layoutBlockId,
      );
      if (!layoutBlock) return null;
      const columnBlocks = (layoutBlock as any).columnBlocks || [];
      if (columnBlocks[selectedBlock.columnIndex]) {
        return (
          columnBlocks[selectedBlock.columnIndex].find(
            (block: CanvasBlock) => block.id === selectedBlock.id,
          ) || null
        );
      }
      return null;
    }
    const sectionBlocks =
      canvasBlocks[selectedBlock.section as keyof typeof canvasBlocks];
    if (!sectionBlocks) return null;
    return sectionBlocks.find((block) => block.id === selectedBlock.id) || null;
  }, [selectedBlock, canvasBlocks]);

  const selectedBlockType = selectedBlockData?.type;
  const isTextBlockSelected =
    !!selectedBlockType &&
    (selectedBlockType === 'Text' || selectedBlockType === 'Paragraph');
  const isSpacerBlockSelected =
    !!selectedBlockType && selectedBlockType === 'Spacer';
  const isSocialBlockSelected =
    !!selectedBlockType && selectedBlockType === 'Social';
  const isButtonBlockSelected =
    !!selectedBlockType && selectedBlockType === 'Button';
  const isImageBlockSelected =
    !!selectedBlockType && selectedBlockType === 'Image';
  const isHeaderBarBlockSelected =
    !!selectedBlockType && selectedBlockType === 'HeaderBar';
  const isVideoBlockSelected =
    !!selectedBlockType && selectedBlockType === 'Video';
  const isCodeBlockSelected =
    !!selectedBlockType && selectedBlockType === 'Code';

  const currentStyles = React.useMemo(
    () => selectedBlockData?.styles || {},
    [selectedBlockData?.styles],
  );

  // Color picker open state
  const [isTextAreaBackgroundPickerOpen, setIsTextAreaBackgroundPickerOpen] =
    useState(false);
  const [isBlockBackgroundPickerOpen, setIsBlockBackgroundPickerOpen] =
    useState(false);
  const [isBorderColorPickerOpen, setIsBorderColorPickerOpen] = useState(false);
  const [isTextColorPickerOpen, setIsTextColorPickerOpen] = useState(false);
  const [
    isSpacerBlockBackgroundPickerOpen,
    setIsSpacerBlockBackgroundPickerOpen,
  ] = useState(false);
  const [isButtonTextColorPickerOpen, setIsButtonTextColorPickerOpen] =
    useState(false);
  const [
    isButtonBackgroundColorPickerOpen,
    setIsButtonBackgroundColorPickerOpen,
  ] = useState(false);
  const [isButtonBorderColorPickerOpen, setIsButtonBorderColorPickerOpen] =
    useState(false);

  const updateTextBlockStyles = useCallback(
    (styleUpdates: Partial<TextStyles>) => {
      if (!selectedBlock || !isTextBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const currentBlock = sectionBlocks[blockIndex];
        const updatedStyles = { ...currentBlock.styles, ...styleUpdates };
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...currentBlock,
          styles: updatedStyles,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isTextBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateSpacerBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isSpacerBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isSpacerBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateSocialBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isSocialBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isSocialBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateButtonBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isButtonBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isButtonBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateImageBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isImageBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];

        if (
          selectedBlock.layoutBlockId &&
          selectedBlock.columnIndex !== undefined
        ) {
          const layoutBlockIndex = sectionBlocks.findIndex(
            (block) => block.id === selectedBlock.layoutBlockId,
          );
          if (layoutBlockIndex === -1) return prev;
          const layoutBlock = sectionBlocks[layoutBlockIndex];
          const existingColumnBlocks =
            (layoutBlock as any).columnBlocks || [];
          const columnBlocks = existingColumnBlocks.map(
            (col: CanvasBlock[]) => [...col],
          );
          while (columnBlocks.length <= selectedBlock.columnIndex) {
            columnBlocks.push([]);
          }
          const columnBlockIndex = columnBlocks[
            selectedBlock.columnIndex
          ].findIndex((block: CanvasBlock) => block.id === selectedBlock.id);
          if (columnBlockIndex === -1) return prev;
          const updatedColumnBlocks = [...columnBlocks];
          updatedColumnBlocks[selectedBlock.columnIndex] = [
            ...updatedColumnBlocks[selectedBlock.columnIndex],
          ];
          updatedColumnBlocks[selectedBlock.columnIndex][columnBlockIndex] = {
            ...updatedColumnBlocks[selectedBlock.columnIndex][columnBlockIndex],
            ...updates,
          };
          const updatedLayoutBlock = {
            ...layoutBlock,
            columnBlocks: updatedColumnBlocks,
          };
          const updatedSectionBlocks = [...sectionBlocks];
          updatedSectionBlocks[layoutBlockIndex] = updatedLayoutBlock;
          return { ...prev, [selectedBlock.section]: updatedSectionBlocks };
        }

        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isImageBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateHeaderBarBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isHeaderBarBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isHeaderBarBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateVideoBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isVideoBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isVideoBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const updateHtmlBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isCodeBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id,
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return { ...prev, [selectedBlock.section]: updatedBlocks };
      });
    },
    [isCodeBlockSelected, selectedBlock, setCanvasBlocks],
  );

  const getCurrentSnapshot = useCallback(
    (): EmailBuilderSnapshot => ({ canvasBlocks }),
    [canvasBlocks],
  );

  const { saveSnapshot, undo, redo, canUndo, canRedo } =
    useUndoRedo<EmailBuilderSnapshot>({
      initialState: getCurrentSnapshot(),
    });

  const isRestoringRef = useRef(false);
  const hasRecordedInitialRef = useRef(false);
  const lastRecordedSnapshotRef = useRef(JSON.stringify(getCurrentSnapshot()));

  useEffect(() => {
    const snapshot = getCurrentSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (!hasRecordedInitialRef.current) {
      hasRecordedInitialRef.current = true;
      lastRecordedSnapshotRef.current = serialized;
      return;
    }
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      lastRecordedSnapshotRef.current = serialized;
      return;
    }
    if (serialized === lastRecordedSnapshotRef.current) return;
    lastRecordedSnapshotRef.current = serialized;
    saveSnapshot(snapshot);
  }, [canvasBlocks, saveSnapshot, getCurrentSnapshot]);

  const contentBlocks = [
    { icon: Type, label: 'Text', color: 'text-[#3CCED7]', type: 'Text' },
    {
      icon: ImageIcon,
      label: 'Image',
      color: 'text-purple-600',
      type: 'Image',
    },
    {
      icon: Columns2,
      label: 'Split',
      color: 'text-gray-600',
      type: 'Layout',
    },
    {
      icon: RectangleHorizontal,
      label: 'Button',
      color: 'text-orange-600',
      type: 'Button',
    },
    {
      icon: Menu,
      label: 'Header bar',
      color: 'text-gray-700',
      type: 'HeaderBar',
    },
    { icon: Minus, label: 'Divider', color: 'text-gray-600', type: 'Divider' },
    {
      icon: Share2,
      label: 'Social links',
      color: 'text-indigo-600',
      type: 'Social',
    },
    { icon: Square, label: 'Spacer', color: 'text-pink-600', type: 'Spacer' },
    { icon: Video, label: 'Video', color: 'text-red-600', type: 'Video' },
    { icon: Code, label: 'HTML', color: 'text-gray-800', type: 'Code' },
  ];

  const blankLayouts = [
    { columns: 1, label: '1', icon: Square },
    { columns: 2, label: '2', icon: Columns2 },
    { columns: 3, label: '3', icon: Columns3 },
    { columns: 4, label: '4', icon: Columns4 },
  ];

  const {
    handleDragStart,
    handleBlockDragStart,
    handleDragOverDropZone,
    handleDragLeaveDropZone,
    handleDrop,
    handleDragEnd,
    dragOverIndex,
    handleColumnBlockDrop,
  } = useKlaviyoDragAndDrop(setCanvasBlocks);

  const updateBlockContent = useCallback(
    (section: string, blockId: string, content: string) => {
      setCanvasBlocks((prev) => {
        const sectionBlocks = [...prev[section as keyof typeof prev]];
        const blockIndex = sectionBlocks.findIndex((b) => b.id === blockId);
        if (blockIndex === -1) return prev;
        const updated = { ...sectionBlocks[blockIndex], content };
        const newBlocks = [...sectionBlocks];
        newBlocks[blockIndex] = updated;
        return { ...prev, [section]: newBlocks } as typeof prev;
      });
    },
    [setCanvasBlocks],
  );

  // Load draft
  useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const draft = await klaviyoApi.getEmailDraft(draftId);
        const resolvedName =
          draft.name || draft.subject || 'Untitled template';
        setDraftName(resolvedName);
        setDraftSubject(draft.subject || resolvedName);
        setDraftStatus(draft.status || 'draft');
        setTempDraftName(resolvedName);
        if (draft.blocks && draft.blocks.length > 0) {
          const convertedBlocks = contentBlocksToCanvasBlocks(draft.blocks);
          setCanvasBlocks(convertedBlocks);
        } else {
          setCanvasBlocks(createDefaultCanvasBlocks());
        }
      } catch (err: any) {
        console.error('Failed to load draft:', err);
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load draft',
        );
        if (err?.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadDraft();
  }, [draftId, setCanvasBlocks]);

  // Save (PATCH body whitelist: no status — avoid B-CRIT-01)
  const handleSave = useCallback(async () => {
    if (!draftId) {
      const message = 'Invalid draft id. Please reopen from templates list.';
      setSaveError(message);
      toast.error(message);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const nextName = tempDraftName.trim() || 'Untitled template';
      const shouldUpdateName = isEditingName && nextName !== draftName;
      const subjectForSave = shouldUpdateName ? nextName : draftSubject;
      if (shouldUpdateName) {
        await klaviyoApi.patchEmailDraft(draftId, {
          name: nextName,
          subject: nextName,
        });
      }
      if (isEditingName) {
        setDraftName(nextName);
        setDraftSubject(nextName);
        setTempDraftName(nextName);
        setIsEditingName(false);
      }
      const serializedBlocks = canvasBlocksToContentBlocks(canvasBlocks);
      await klaviyoApi.patchEmailDraft(draftId, {
        subject: subjectForSave,
        blocks: serializedBlocks,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save draft',
      );
      if (err?.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    draftId,
    tempDraftName,
    isEditingName,
    draftName,
    draftSubject,
    canvasBlocks,
  ]);

  const handleNameSave = useCallback(async () => {
    if (!draftId) {
      toast.error('Invalid draft id. Please reopen from templates list.');
      setIsEditingName(false);
      return;
    }
    const nextName = tempDraftName.trim() || 'Untitled template';
    if (nextName === draftName) {
      setTempDraftName(nextName);
      setIsEditingName(false);
      return;
    }
    try {
      await klaviyoApi.patchEmailDraft(draftId, {
        name: nextName,
        subject: nextName,
      });
      setDraftName(nextName);
      setDraftSubject(nextName);
      setTempDraftName(nextName);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update draft name:', err);
      toast.error('Failed to update draft name');
      setTempDraftName(draftName);
      setIsEditingName(false);
    }
  }, [draftId, tempDraftName, draftName]);

  const handleUndo = useCallback(() => {
    const prevSnapshot = undo();
    if (prevSnapshot) {
      isRestoringRef.current = true;
      setCanvasBlocks(prevSnapshot.canvasBlocks);
    }
  }, [undo, setCanvasBlocks]);

  const handleRedo = useCallback(() => {
    const nextSnapshot = redo();
    if (nextSnapshot) {
      isRestoringRef.current = true;
      setCanvasBlocks(nextSnapshot.canvasBlocks);
    }
  }, [redo, setCanvasBlocks]);

  const handleExit = () => {
    router.push(safeReturnTo);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleUndo, handleRedo, canUndo, canRedo]);

  useEffect(() => {
    if (selectedBlock) setActiveNav('Styles');
  }, [selectedBlock, setActiveNav]);

  // Error / loading states
  if (hasInvalidDraftId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center rounded-xl bg-white py-24 ring-1 ring-rose-200">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <div className="ml-3">
            <p className="text-sm font-medium text-rose-700">
              Invalid template link
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Please open a template from the Klaviyo list.
            </p>
            <button
              type="button"
              onClick={() => router.push(safeReturnTo)}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
            >
              Back to templates
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center rounded-xl bg-white py-24 ring-1 ring-gray-200">
          <Loader2 className="h-5 w-5 animate-spin text-[#3CCED7]" />
          <span className="ml-2 text-sm text-gray-500">
            Loading template...
          </span>
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center rounded-xl bg-white py-24 ring-1 ring-rose-200">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <div className="ml-3">
            <p className="text-sm font-medium text-rose-700">
              Failed to load template
            </p>
            <p className="mt-1 text-xs text-gray-500">{loadError}</p>
            <button
              type="button"
              onClick={() => router.push(safeReturnTo)}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
            >
              Back to templates
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div
        className="-m-5 flex flex-col bg-white"
        style={{ height: 'calc(100vh - 3rem)' }}
      >
        {/* Top header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-2.5 shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleExit}
              aria-label="Back to templates"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3CCED7]/10 to-[#A6E661]/10">
              <Mail className="h-4 w-4 text-[#3CCED7]" />
            </div>
            {isEditingName ? (
              <input
                type="text"
                value={tempDraftName}
                onChange={(e) => setTempDraftName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  else if (e.key === 'Escape') {
                    setTempDraftName(draftName);
                    setIsEditingName(false);
                  }
                }}
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="min-w-0 max-w-[360px] truncate rounded-md px-2 py-1 text-left text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                title="Click to rename"
              >
                {draftName}
              </button>
            )}
            <EmailDraftStatusPill platform="klaviyo" status={draftStatus} />
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </span>
            )}
            {saveError && (
              <span
                className="inline-flex max-w-[240px] items-center gap-1 truncate rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200"
                title={saveError}
              >
                <AlertTriangle className="h-3 w-3" />
                {saveError}
              </span>
            )}
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex h-9 items-center rounded-lg bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Exit
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              title={isSaving ? 'Saving' : 'Save (Cmd+S)'}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Main area: left sidebar + center canvas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <div className="flex w-80 flex-col border-r border-gray-200 bg-white">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveNav('Add')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  activeNav === 'Add'
                    ? 'border-b-2 border-[#3CCED7] text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Content
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('Styles')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  activeNav === 'Styles'
                    ? 'border-b-2 border-[#3CCED7] text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Styles
              </button>
            </div>

            {/* Conditional render: selected block in Styles → inspector/picker; else nav sidebar */}
            {activeNav === 'Styles' && selectedBlock ? (
              <>
                {isTextBlockSelected ? (
                  <>
                    {isTextAreaBackgroundPickerOpen ? (
                      <BlockBackgroundPicker
                        currentStyles={currentStyles}
                        handleStyleChange={(updates) => {
                          updateTextBlockStyles({
                            backgroundColor:
                              updates.blockBackgroundColor ||
                              updates.backgroundColor,
                          });
                        }}
                        setIsBlockBackgroundPickerOpen={
                          setIsTextAreaBackgroundPickerOpen
                        }
                      />
                    ) : isBlockBackgroundPickerOpen ? (
                      <BlockBackgroundPicker
                        currentStyles={currentStyles}
                        handleStyleChange={(updates) => {
                          updateTextBlockStyles({
                            blockBackgroundColor: updates.blockBackgroundColor,
                          });
                        }}
                        setIsBlockBackgroundPickerOpen={
                          setIsBlockBackgroundPickerOpen
                        }
                      />
                    ) : isBorderColorPickerOpen ? (
                      <BorderColorPicker
                        currentStyles={currentStyles}
                        handleStyleChange={(updates) => {
                          updateTextBlockStyles({
                            borderColor: updates.borderColor,
                          });
                        }}
                        setIsBorderColorPickerOpen={setIsBorderColorPickerOpen}
                      />
                    ) : (
                      <KlaviyoTextInspector
                        currentStyles={currentStyles}
                        handleStyleChange={updateTextBlockStyles}
                        setIsTextAreaBackgroundPickerOpen={
                          setIsTextAreaBackgroundPickerOpen
                        }
                        setIsBlockBackgroundPickerOpen={
                          setIsBlockBackgroundPickerOpen
                        }
                        setIsBorderColorPickerOpen={setIsBorderColorPickerOpen}
                        setIsTextColorPickerOpen={setIsTextColorPickerOpen}
                        isTextColorPickerOpen={isTextColorPickerOpen}
                      />
                    )}
                  </>
                ) : isSpacerBlockSelected ? (
                  <>
                    {isSpacerBlockBackgroundPickerOpen ? (
                      <BlockBackgroundPicker
                        currentStyles={
                          selectedBlockData?.spacerBlockStyles || {}
                        }
                        handleStyleChange={(updates) => {
                          updateSpacerBlockSettings({
                            spacerBlockStyles: {
                              ...selectedBlockData?.spacerBlockStyles,
                              backgroundColor: updates.blockBackgroundColor,
                            },
                          });
                        }}
                        setIsBlockBackgroundPickerOpen={
                          setIsSpacerBlockBackgroundPickerOpen
                        }
                      />
                    ) : (
                      <KlaviyoSpacerInspector
                        selectedBlockData={selectedBlockData}
                        updateSpacerSettings={updateSpacerBlockSettings}
                        setIsSpacerBlockBackgroundPickerOpen={
                          setIsSpacerBlockBackgroundPickerOpen
                        }
                      />
                    )}
                  </>
                ) : isSocialBlockSelected ? (
                  <KlaviyoSocialLinksInspector
                    selectedBlockData={selectedBlockData}
                    updateSocialSettings={updateSocialBlockSettings}
                  />
                ) : isButtonBlockSelected ? (
                  <>
                    {isButtonTextColorPickerOpen ? (
                      <KlaviyoColorPicker
                        currentColor={
                          selectedBlockData?.styles?.color ||
                          selectedBlockData?.buttonTextColor ||
                          '#FFFFFF'
                        }
                        onColorChange={(color) => {
                          const currentBtnStyles =
                            selectedBlockData?.styles || {};
                          updateButtonBlockSettings({
                            styles: { ...currentBtnStyles, color },
                            buttonTextColor: color,
                          });
                        }}
                        onClose={() => setIsButtonTextColorPickerOpen(false)}
                        title="Text Color"
                      />
                    ) : isButtonBackgroundColorPickerOpen ? (
                      <KlaviyoColorPicker
                        currentColor={
                          selectedBlockData?.buttonBackgroundColor || '#AD11CC'
                        }
                        onColorChange={(color) => {
                          updateButtonBlockSettings({
                            buttonBackgroundColor: color,
                          });
                        }}
                        onClose={() =>
                          setIsButtonBackgroundColorPickerOpen(false)
                        }
                        title="Button Color"
                      />
                    ) : isButtonBorderColorPickerOpen ? (
                      <KlaviyoColorPicker
                        currentColor={
                          selectedBlockData?.buttonBlockStyles?.borderColor ||
                          '#000000'
                        }
                        onColorChange={(color) => {
                          const btnBorderStyles =
                            selectedBlockData?.buttonBlockStyles || {};
                          updateButtonBlockSettings({
                            buttonBlockStyles: {
                              ...btnBorderStyles,
                              borderColor: color,
                            },
                          });
                        }}
                        onClose={() => setIsButtonBorderColorPickerOpen(false)}
                        title="Border Color"
                      />
                    ) : (
                      <KlaviyoButtonInspector
                        selectedBlockData={selectedBlockData}
                        updateButtonSettings={updateButtonBlockSettings}
                        setIsButtonTextColorPickerOpen={
                          setIsButtonTextColorPickerOpen
                        }
                        setIsButtonBackgroundColorPickerOpen={
                          setIsButtonBackgroundColorPickerOpen
                        }
                        setIsButtonBorderColorPickerOpen={
                          setIsButtonBorderColorPickerOpen
                        }
                      />
                    )}
                  </>
                ) : isImageBlockSelected ? (
                  <KlaviyoImageInspector
                    selectedBlockData={selectedBlockData}
                    updateImageSettings={updateImageBlockSettings}
                  />
                ) : isHeaderBarBlockSelected ? (
                  <KlaviyoHeaderBarInspector
                    selectedBlockData={selectedBlockData}
                    updateHeaderBarSettings={updateHeaderBarBlockSettings}
                  />
                ) : isVideoBlockSelected ? (
                  <KlaviyoVideoInspector
                    selectedBlockData={selectedBlockData}
                    updateVideoSettings={updateVideoBlockSettings}
                  />
                ) : isCodeBlockSelected ? (
                  <KlaviyoHtmlInspector
                    selectedBlockData={selectedBlockData}
                    updateHtmlSettings={updateHtmlBlockSettings}
                  />
                ) : (
                  <KlaviyoNavigationSidebar
                    activeNav={activeNav}
                    contentBlocks={contentBlocks}
                    blankLayouts={blankLayouts}
                    showMoreBlocks={showMoreBlocks}
                    setShowMoreBlocks={setShowMoreBlocks}
                    showMoreLayouts={showMoreLayouts}
                    setShowMoreLayouts={setShowMoreLayouts}
                    handleDragStart={handleDragStart}
                  />
                )}
              </>
            ) : (
              <KlaviyoNavigationSidebar
                activeNav={activeNav}
                contentBlocks={contentBlocks}
                blankLayouts={blankLayouts}
                showMoreBlocks={showMoreBlocks}
                setShowMoreBlocks={setShowMoreBlocks}
                showMoreLayouts={showMoreLayouts}
                setShowMoreLayouts={setShowMoreLayouts}
                handleDragStart={handleDragStart}
              />
            )}
          </div>

          {/* Center canvas */}
          <div className="flex flex-1 flex-col bg-gray-50">
            {/* Canvas toolbar */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Cmd+Z)"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${
                    canUndo
                      ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      : 'cursor-not-allowed text-gray-300'
                  }`}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Cmd+Shift+Z)"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${
                    canRedo
                      ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      : 'cursor-not-allowed text-gray-300'
                  }`}
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setDeviceMode('desktop')}
                  title="Desktop"
                  className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition ${
                    deviceMode === 'desktop'
                      ? 'bg-white text-[#3CCED7] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('mobile')}
                  title="Mobile"
                  className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition ${
                    deviceMode === 'mobile'
                      ? 'bg-white text-[#3CCED7] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="inline-flex h-8 items-center rounded-md bg-white px-3 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-[#3CCED7]/50"
                >
                  Preview & test
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-y-auto p-6">
              <div
                className={`mx-auto bg-white shadow-lg ${
                  deviceMode === 'desktop' ? 'max-w-3xl' : 'max-w-md'
                }`}
              >
                <KlaviyoSectionBlocks
                  section="header"
                  blocks={canvasBlocks.header || []}
                  selectedBlock={selectedBlock}
                  setSelectedBlock={setSelectedBlock}
                  setSelectedSection={setSelectedSection}
                  hoveredBlock={hoveredBlock}
                  setHoveredBlock={setHoveredBlock}
                  dragOverIndex={dragOverIndex}
                  handleDragOverDropZone={handleDragOverDropZone}
                  handleDragLeaveDropZone={handleDragLeaveDropZone}
                  handleDrop={handleDrop}
                  handleBlockDragStart={handleBlockDragStart}
                  handleDragEnd={handleDragEnd}
                  removeBlock={removeBlock}
                  updateLayoutColumns={updateLayoutColumns}
                  deviceMode={deviceMode}
                  updateBlockContent={updateBlockContent}
                  handleColumnBlockDrop={handleColumnBlockDrop}
                  setCanvasBlocks={setCanvasBlocks}
                />
                <KlaviyoSectionBlocks
                  section="body"
                  blocks={canvasBlocks.body}
                  selectedBlock={selectedBlock}
                  setSelectedBlock={setSelectedBlock}
                  setSelectedSection={setSelectedSection}
                  hoveredBlock={hoveredBlock}
                  setHoveredBlock={setHoveredBlock}
                  dragOverIndex={dragOverIndex}
                  handleDragOverDropZone={handleDragOverDropZone}
                  handleDragLeaveDropZone={handleDragLeaveDropZone}
                  handleDrop={handleDrop}
                  handleBlockDragStart={handleBlockDragStart}
                  handleDragEnd={handleDragEnd}
                  removeBlock={removeBlock}
                  updateLayoutColumns={updateLayoutColumns}
                  deviceMode={deviceMode}
                  updateBlockContent={updateBlockContent}
                  handleColumnBlockDrop={handleColumnBlockDrop}
                  setCanvasBlocks={setCanvasBlocks}
                />
                <KlaviyoSectionBlocks
                  section="footer"
                  blocks={canvasBlocks.footer || []}
                  selectedBlock={selectedBlock}
                  setSelectedBlock={setSelectedBlock}
                  setSelectedSection={setSelectedSection}
                  hoveredBlock={hoveredBlock}
                  setHoveredBlock={setHoveredBlock}
                  dragOverIndex={dragOverIndex}
                  handleDragOverDropZone={handleDragOverDropZone}
                  handleDragLeaveDropZone={handleDragLeaveDropZone}
                  handleDrop={handleDrop}
                  handleBlockDragStart={handleBlockDragStart}
                  handleDragEnd={handleDragEnd}
                  removeBlock={removeBlock}
                  updateLayoutColumns={updateLayoutColumns}
                  deviceMode={deviceMode}
                  updateBlockContent={updateBlockContent}
                  handleColumnBlockDrop={handleColumnBlockDrop}
                  setCanvasBlocks={setCanvasBlocks}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <PreviewPanel
          isPreviewOpen={isPreviewOpen}
          setIsPreviewOpen={setIsPreviewOpen}
          previewTab={previewTab}
          setPreviewTab={setPreviewTab}
          canvasBlocks={canvasBlocks}
          previewContainerRef={previewContainerRef}
        />
      </div>
    </DashboardLayout>
  );
}
