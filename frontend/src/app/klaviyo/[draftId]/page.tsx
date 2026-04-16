"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Layout from "@/components/layout/Layout";
import {
  Monitor,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  Sparkles,
  Image as ImageIcon,
  Type,
  FileText,
  RectangleHorizontal,
  Minus,
  Square,
  Video,
  Share2,
  Hexagon,
  ListChecks,
  Code,
  Grid3x3,
  ShoppingBag,
  Heart,
  Columns2,
  Columns3,
  Columns4,
  Menu,
  Layers,
  Table,
  MessageSquare,
} from "lucide-react";
import {
  CanvasBlocks,
  CanvasBlock,
  TextStyles,
} from "@/components/mailchimp/email-builder/types";
import { useEmailBuilder } from "@/components/mailchimp/email-builder/hooks/useEmailBuilder";
import { useKlaviyoDragAndDrop } from "@/components/klaviyo/useKlaviyoDragAndDrop";
import { useUndoRedo } from "@/components/mailchimp/email-builder/hooks/useUndoRedo";
import KlaviyoNavigationSidebar from "@/components/klaviyo/KlaviyoNavigationSidebar";
import KlaviyoSectionBlocks from "@/components/klaviyo/KlaviyoSectionBlocks";
import KlaviyoTextInspector from "@/components/klaviyo/KlaviyoTextInspector";
import KlaviyoSpacerInspector from "@/components/klaviyo/KlaviyoSpacerInspector";
import KlaviyoSocialLinksInspector from "@/components/klaviyo/KlaviyoSocialLinksInspector";
import KlaviyoButtonInspector from "@/components/klaviyo/KlaviyoButtonInspector";
import KlaviyoImageInspector from "@/components/klaviyo/KlaviyoImageInspector";
import KlaviyoHeaderBarInspector from "@/components/klaviyo/KlaviyoHeaderBarInspector";
import KlaviyoVideoInspector from "@/components/klaviyo/KlaviyoVideoInspector";
import KlaviyoHtmlInspector from "@/components/klaviyo/KlaviyoHtmlInspector";
import KlaviyoColorPicker from "@/components/klaviyo/KlaviyoColorPicker";
import PreviewPanel from "@/components/mailchimp/email-builder/components/PreviewPanel";
import BlockBackgroundPicker from "@/components/mailchimp/email-builder/components/BlockBackgroundPicker";
import BorderColorPicker from "@/components/mailchimp/email-builder/components/BorderColorPicker";
import { klaviyoApi } from "@/lib/api/klaviyoApi";
import {
  contentBlocksToCanvasBlocks,
  canvasBlocksToContentBlocks,
  createDefaultCanvasBlocks,
} from "@/lib/utils/klaviyoTransform";

type EmailBuilderSnapshot = {
  canvasBlocks: CanvasBlocks;
};

export default function KlaviyoEmailBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const draftIdParam = params?.draftId as string | undefined;
  const parsedDraftId = draftIdParam ? Number(draftIdParam) : NaN;
  const draftId =
    Number.isInteger(parsedDraftId) && parsedDraftId > 0
      ? parsedDraftId
      : null;
  const hasInvalidDraftId = Boolean(draftIdParam) && draftId == null;
  const templateId = searchParams?.get("templateId");
  const returnTo = searchParams?.get("returnTo");

  // Save state management
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load state management
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("Untitled Email");
  const [draftSubject, setDraftSubject] = useState<string>("Untitled Email");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDraftName, setTempDraftName] = useState<string>("Untitled Email");

  // Use custom hooks for state management
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

  // Computed values for selected block
  const selectedBlockData = React.useMemo(() => {
    if (!selectedBlock) return null;
    
    // Check if this is a nested block inside a layout column
    if (selectedBlock.layoutBlockId && selectedBlock.columnIndex !== undefined) {
      const sectionBlocks =
        canvasBlocks[selectedBlock.section as keyof typeof canvasBlocks];
      if (!sectionBlocks) return null;
      
      // Find the layout block
      const layoutBlock = sectionBlocks.find(
        (block) => block.id === selectedBlock.layoutBlockId
      );
      
      if (!layoutBlock) return null;
      
      // Get the nested block from the column
      const columnBlocks = (layoutBlock as any).columnBlocks || [];
      if (columnBlocks[selectedBlock.columnIndex]) {
        return (
          columnBlocks[selectedBlock.columnIndex].find(
            (block: CanvasBlock) => block.id === selectedBlock.id
          ) || null
        );
      }
      
      return null;
    }
    
    // Top-level block
    const sectionBlocks =
      canvasBlocks[selectedBlock.section as keyof typeof canvasBlocks];
    if (!sectionBlocks) return null;
    return sectionBlocks.find((block) => block.id === selectedBlock.id) || null;
  }, [selectedBlock, canvasBlocks]);

  const selectedBlockType = selectedBlockData?.type;
  // Check for Text block (Klaviyo uses "Text" type, which maps to "Paragraph" in rendering)
  const isTextBlockSelected =
    !!selectedBlockType && (selectedBlockType === "Text" || selectedBlockType === "Paragraph");
  const isSpacerBlockSelected =
    !!selectedBlockType && selectedBlockType === "Spacer";
  const isSocialBlockSelected =
    !!selectedBlockType && selectedBlockType === "Social";
  const isButtonBlockSelected =
    !!selectedBlockType && selectedBlockType === "Button";
  const isImageBlockSelected =
    !!selectedBlockType && selectedBlockType === "Image";
  const isHeaderBarBlockSelected =
    !!selectedBlockType && selectedBlockType === "HeaderBar";
  const isVideoBlockSelected =
    !!selectedBlockType && selectedBlockType === "Video";
  const isCodeBlockSelected =
    !!selectedBlockType && selectedBlockType === "Code";

  const currentStyles = React.useMemo(
    () => selectedBlockData?.styles || {},
    [selectedBlockData?.styles]
  );

  // Color picker states
  const [isTextAreaBackgroundPickerOpen, setIsTextAreaBackgroundPickerOpen] =
    useState(false);
  const [isBlockBackgroundPickerOpen, setIsBlockBackgroundPickerOpen] =
    useState(false);
  const [isBorderColorPickerOpen, setIsBorderColorPickerOpen] = useState(false);
  const [isTextColorPickerOpen, setIsTextColorPickerOpen] = useState(false);
  const [isSpacerBlockBackgroundPickerOpen, setIsSpacerBlockBackgroundPickerOpen] =
    useState(false);
  const [isButtonTextColorPickerOpen, setIsButtonTextColorPickerOpen] =
    useState(false);
  const [isButtonBackgroundColorPickerOpen, setIsButtonBackgroundColorPickerOpen] =
    useState(false);
  const [isButtonBorderColorPickerOpen, setIsButtonBorderColorPickerOpen] =
    useState(false);

  // Function to update Text block styles
  const updateTextBlockStyles = useCallback(
    (styleUpdates: Partial<TextStyles>) => {
      if (!selectedBlock || !isTextBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const currentBlock = sectionBlocks[blockIndex];
        const updatedStyles = {
          ...currentBlock.styles,
          ...styleUpdates,
        };

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...currentBlock,
          styles: updatedStyles,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isTextBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update Spacer block settings
  const updateSpacerBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isSpacerBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isSpacerBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update Social block settings
  const updateSocialBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isSocialBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isSocialBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update Button block settings
  const updateButtonBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isButtonBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isButtonBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update Image block settings
  const updateImageBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isImageBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        
        // Check if this is a nested block inside a layout column
        if (selectedBlock.layoutBlockId && selectedBlock.columnIndex !== undefined) {
          // Find the layout block
          const layoutBlockIndex = sectionBlocks.findIndex(
            (block) => block.id === selectedBlock.layoutBlockId
          );
          if (layoutBlockIndex === -1) return prev;
          
          const layoutBlock = sectionBlocks[layoutBlockIndex];
          // Get the columnBlocks array and create a new copy to avoid mutation
          const existingColumnBlocks = (layoutBlock as any).columnBlocks || [];
          const columnBlocks = existingColumnBlocks.map((col: CanvasBlock[]) => [...col]);
          
          // Ensure we have enough columns
          while (columnBlocks.length <= selectedBlock.columnIndex) {
            columnBlocks.push([]);
          }
          
          // Find the nested block in the specified column
          const columnBlockIndex = columnBlocks[selectedBlock.columnIndex].findIndex(
            (block: CanvasBlock) => block.id === selectedBlock.id
          );
          if (columnBlockIndex === -1) return prev;
          
          // Update the nested block
          const updatedColumnBlocks = [...columnBlocks];
          updatedColumnBlocks[selectedBlock.columnIndex] = [...updatedColumnBlocks[selectedBlock.columnIndex]];
          updatedColumnBlocks[selectedBlock.columnIndex][columnBlockIndex] = {
            ...updatedColumnBlocks[selectedBlock.columnIndex][columnBlockIndex],
            ...updates,
          };
          
          // Update the layout block with new columnBlocks
          const updatedLayoutBlock = {
            ...layoutBlock,
            columnBlocks: updatedColumnBlocks,
          };
          
          // Update the section blocks
          const updatedSectionBlocks = [...sectionBlocks];
          updatedSectionBlocks[layoutBlockIndex] = updatedLayoutBlock;
          
          return {
            ...prev,
            [selectedBlock.section]: updatedSectionBlocks,
          };
        }
        
        // Top-level block update
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isImageBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update HeaderBar block settings
  const updateHeaderBarBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isHeaderBarBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isHeaderBarBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update Video block settings
  const updateVideoBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isVideoBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isVideoBlockSelected, selectedBlock, setCanvasBlocks]
  );

  // Function to update HTML block settings
  const updateHtmlBlockSettings = useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock || !isCodeBlockSelected) return;
      setCanvasBlocks((prev) => {
        const sectionKey = selectedBlock.section as keyof typeof prev;
        const sectionBlocks = [...prev[sectionKey]];
        const blockIndex = sectionBlocks.findIndex(
          (block) => block.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [isCodeBlockSelected, selectedBlock, setCanvasBlocks]
  );

  const getCurrentSnapshot = useCallback(
    (): EmailBuilderSnapshot => ({
      canvasBlocks,
    }),
    [canvasBlocks]
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

    if (serialized === lastRecordedSnapshotRef.current) {
      return;
    }

    lastRecordedSnapshotRef.current = serialized;
    saveSnapshot(snapshot);
  }, [canvasBlocks, saveSnapshot, getCurrentSnapshot]);

  // Define content blocks for the sidebar
  const contentBlocks = [
    {
      icon: Type,
      label: "Text",
      color: "text-blue-600",
      type: "Text",
    },
    {
      icon: ImageIcon,
      label: "Image",
      color: "text-purple-600",
      type: "Image",
    },
    {
      icon: Columns2,
      label: "Split",
      color: "text-gray-600",
      type: "Layout",
    },
    {
      icon: RectangleHorizontal,
      label: "Button",
      color: "text-orange-600",
      type: "Button",
    },
    {
      icon: Menu,
      label: "Header bar",
      color: "text-gray-700",
      type: "HeaderBar",
    },
    { icon: Minus, label: "Divider", color: "text-gray-600", type: "Divider" },
    {
      icon: Share2,
      label: "Social links",
      color: "text-indigo-600",
      type: "Social",
    },
    { icon: Square, label: "Spacer", color: "text-pink-600", type: "Spacer" },
    { icon: Video, label: "Video", color: "text-red-600", type: "Video" },
    { icon: Code, label: "HTML", color: "text-gray-800", type: "Code" },
  ];

  const blankLayouts = [
    { columns: 1, label: "1", icon: Square },
    { columns: 2, label: "2", icon: Columns2 },
    { columns: 3, label: "3", icon: Columns3 },
    { columns: 4, label: "4", icon: Columns4 },
  ];

  // Drag and drop handlers
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

  // Helper function to update block content
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
    [setCanvasBlocks]
  );

  // Load draft data
  useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) return;

      setIsLoading(true);
      setLoadError(null);

      try {
        const draft = await klaviyoApi.getEmailDraft(draftId);
        setDraftName(draft.name || draft.subject || "Untitled Email");
        setDraftSubject(draft.subject || "Untitled Email");
        setTempDraftName(draft.name || draft.subject || "Untitled Email");

        // If draft has blocks, convert them to canvas blocks
        if (draft.blocks && draft.blocks.length > 0) {
          const convertedBlocks = contentBlocksToCanvasBlocks(draft.blocks);
          setCanvasBlocks(convertedBlocks);
        } else {
          // If no blocks, use default blocks
          const defaultBlocks = createDefaultCanvasBlocks();
          setCanvasBlocks(defaultBlocks);
        }
      } catch (err: any) {
        console.error("Failed to load draft:", err);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load draft"
        );

        if (err?.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [draftId, setCanvasBlocks]);

  // Handle save
  const handleSave = async () => {
    if (!draftId) {
      const message = "Invalid draft id. Please reopen from drafts list.";
      setSaveError(message);
      toast.error(message);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // If user clicks Save while the title input is focused, persist the latest name first.
      const nextName = tempDraftName.trim() || "Untitled Email";
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

      // Convert canvas blocks to content blocks
      const contentBlocks = canvasBlocksToContentBlocks(canvasBlocks);

      // Save editor content; name updates are handled separately to avoid races.
      await klaviyoApi.patchEmailDraft(draftId, {
        subject: subjectForSave,
        blocks: contentBlocks,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to save draft:", err);
      setSaveError(
        err instanceof Error ? err.message : "Failed to save draft"
      );

      if (err?.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle name edit
  const handleNameSave = async () => {
    if (!draftId) {
      toast.error("Invalid draft id. Please reopen from drafts list.");
      setIsEditingName(false);
      return;
    }

    const nextName = tempDraftName.trim() || "Untitled Email";
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
      console.error("Failed to update draft name:", err);
      toast.error("Failed to update draft name");
      setTempDraftName(draftName);
      setIsEditingName(false);
    }
  };

  // Handle undo
  const handleUndo = useCallback(() => {
    const prevSnapshot = undo();
    if (prevSnapshot) {
      isRestoringRef.current = true;
      setCanvasBlocks(prevSnapshot.canvasBlocks);
    }
  }, [undo, setCanvasBlocks]);

  // Handle redo
  const handleRedo = useCallback(() => {
    const nextSnapshot = redo();
    if (nextSnapshot) {
      isRestoringRef.current = true;
      setCanvasBlocks(nextSnapshot.canvasBlocks);
    }
  }, [redo, setCanvasBlocks]);

  // Handle exit
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/klaviyo';

  const handleExit = () => {
    router.push(safeReturnTo);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // Cmd/Ctrl + Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) handleUndo();
      }
      // Cmd/Ctrl + Shift + Z to redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleUndo, handleRedo, canUndo, canRedo]);

  // Auto-switch sidebar to Styles when a block is selected
  useEffect(() => {
    if (selectedBlock) {
      setActiveNav("Styles");
    }
  }, [selectedBlock, setActiveNav]);

  if (hasInvalidDraftId) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <p className="text-red-600 mb-4">
              Invalid draft link. Please open a draft from the Klaviyo list.
            </p>
            <button
              onClick={() => router.push(safeReturnTo)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Drafts
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading email draft...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <p className="text-red-600 mb-4">{loadError}</p>
            <button
              onClick={() => router.push(safeReturnTo)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Drafts
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative h-full flex flex-col bg-white">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-4">
          <div className="text-lg font-bold">klaviyo</div>
          {isEditingName ? (
            <input
              type="text"
              value={tempDraftName}
              onChange={(e) => setTempDraftName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNameSave();
                } else if (e.key === "Escape") {
                  setTempDraftName(draftName);
                  setIsEditingName(false);
                }
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              className="text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
              onClick={() => setIsEditingName(true)}
            >
              {draftName}
            </div>
          )}
        </div>

        <button
          onClick={handleExit}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
        >
          Exit
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveNav("Add")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeNav === "Add"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Content
            </button>
            <button
              onClick={() => setActiveNav("Styles")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeNav === "Styles"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Styles
            </button>
          </div>

          {/* Navigation Sidebar Content */}
          {activeNav === "Styles" && selectedBlock ? (
            <>
              {isTextBlockSelected ? (
                <>
                  {isTextAreaBackgroundPickerOpen ? (
                    <BlockBackgroundPicker
                      currentStyles={currentStyles}
                      handleStyleChange={(updates) => {
                        updateTextBlockStyles({
                          backgroundColor: updates.blockBackgroundColor || updates.backgroundColor,
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
                        "#FFFFFF"
                      }
                      onColorChange={(color) => {
                        const currentStyles = selectedBlockData?.styles || {};
                        updateButtonBlockSettings({
                          styles: { ...currentStyles, color },
                          buttonTextColor: color,
                        });
                      }}
                      onClose={() => setIsButtonTextColorPickerOpen(false)}
                      title="Text Color"
                    />
                  ) : isButtonBackgroundColorPickerOpen ? (
                    <KlaviyoColorPicker
                      currentColor={
                        selectedBlockData?.buttonBackgroundColor || "#AD11CC"
                      }
                      onColorChange={(color) => {
                        updateButtonBlockSettings({
                          buttonBackgroundColor: color,
                        });
                      }}
                      onClose={() => setIsButtonBackgroundColorPickerOpen(false)}
                      title="Button Color"
                    />
                  ) : isButtonBorderColorPickerOpen ? (
                    <KlaviyoColorPicker
                      currentColor={
                        selectedBlockData?.buttonBlockStyles?.borderColor ||
                        "#000000"
                      }
                      onColorChange={(color) => {
                        const currentStyles =
                          selectedBlockData?.buttonBlockStyles || {};
                        updateButtonBlockSettings({
                          buttonBlockStyles: {
                            ...currentStyles,
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

        {/* Center Canvas Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Canvas Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className={`p-2 rounded ${
                  canUndo
                    ? "hover:bg-gray-100 text-gray-700"
                    : "text-gray-300 cursor-not-allowed"
                }`}
                title="Undo (Cmd+Z)"
              >
                <Undo2 className="h-5 w-5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className={`p-2 rounded ${
                  canRedo
                    ? "hover:bg-gray-100 text-gray-700"
                    : "text-gray-300 cursor-not-allowed"
                }`}
                title="Redo (Cmd+Shift+Z)"
              >
                <Redo2 className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`p-2 rounded ${
                  deviceMode === "desktop"
                    ? "bg-gray-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Monitor className="h-5 w-5" />
              </button>
              <button
                onClick={() => setDeviceMode("mobile")}
                className={`p-2 rounded ${
                  deviceMode === "mobile"
                    ? "bg-gray-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Smartphone className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Preview & test
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Saving..." : "Save"}</span>
              </button>
            </div>
          </div>

          {/* Save Status Messages */}
          {saveSuccess && (
            <div className="mx-6 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
              Draft saved successfully!
            </div>
          )}
          {saveError && (
            <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {saveError}
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto p-6">
            <div
              className={`mx-auto bg-white shadow-lg ${
                deviceMode === "desktop" ? "max-w-3xl" : "max-w-md"
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
    </Layout>
  );
}



