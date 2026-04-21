"use client";

import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Share2,
  ArrowLeft,
  Save,
  Camera,
  Eye,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Viewport } from "./hooks/useBoardViewport";

interface BoardHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  viewport: Viewport;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  shareToken: string;
  onSnapshotClick?: () => void;
  onPreviewClick?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onBoardsToggle?: () => void;
  onBack?: () => void;
}

function iconBtnClass(disabled = false) {
  return [
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition",
    disabled
      ? "cursor-not-allowed opacity-40"
      : "hover:bg-gray-50 hover:text-[#3CCED7]",
  ].join(" ");
}

export default function BoardHeader({
  title,
  onTitleChange,
  viewport,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onSave,
  isSaving = false,
  shareToken,
  onSnapshotClick,
  onPreviewClick,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onBack,
}: BoardHeaderProps) {
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/miro/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className={iconBtnClass()}
          title="Back to Boards"
          aria-label="Back to Boards"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={(e) => onTitleChange(e.target.value)}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-[15px] font-semibold text-gray-900 placeholder:text-gray-300 outline-none transition focus:bg-gray-50 focus:ring-2 focus:ring-[#3CCED7]/30"
          placeholder="Untitled Board"
        />
        {isSaving && (
          <span className="text-[11px] text-gray-400">Saving…</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={iconBtnClass(!canUndo)}
            title="Undo (Cmd/Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={iconBtnClass(!canRedo)}
            title="Redo (Cmd+Shift+Z / Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        )}
        <div className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={iconBtnClass(isSaving)}
            title="Save snapshot"
            aria-label="Save snapshot"
          >
            <Save className="h-4 w-4" />
          </button>
        )}
        {onSnapshotClick && (
          <button
            type="button"
            onClick={onSnapshotClick}
            className={iconBtnClass()}
            title="Snapshots"
            aria-label="Snapshots"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
        {onPreviewClick && (
          <button
            type="button"
            onClick={onPreviewClick}
            className={iconBtnClass()}
            title="Preview"
            aria-label="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        <div className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
        <button
          type="button"
          onClick={onZoomOut}
          className={iconBtnClass()}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[44px] text-center text-xs text-gray-500">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          className={iconBtnClass()}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onFitToScreen}
          className={iconBtnClass()}
          title="Fit to screen"
          aria-label="Fit to screen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:border-[#3CCED7] hover:text-[#3CCED7]"
          title="Copy share link"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>
    </div>
  );
}
