"use client";

import React, { useState, useEffect } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { miroApi, BoardRevision } from "@/lib/api/miroApi";
import { BoardItem } from "@/lib/api/miroApi";
import { Viewport } from "./hooks/useBoardViewport";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface BoardSnapshotsModalProps {
  open: boolean;
  boardId: string;
  currentViewport: Viewport;
  currentItems: BoardItem[];
  onClose: () => void;
  onRestore: () => void; // Called after successful restore to reload board/items
}

export default function BoardSnapshotsModal({
  open,
  boardId,
  currentViewport,
  currentItems,
  onClose,
  onRestore,
}: BoardSnapshotsModalProps) {
  const [revisions, setRevisions] = useState<BoardRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [confirmRestoreVersion, setConfirmRestoreVersion] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load revisions when modal opens
  useEffect(() => {
    if (open) {
      loadRevisions();
    }
  }, [open, boardId]);

  const loadRevisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const revs = await miroApi.listBoardRevisions(boardId, 50);
      setRevisions(revs);
    } catch (err: any) {
      console.error("Failed to load revisions:", err);
      setError(err instanceof Error ? err.message : "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setCreating(true);
    setError(null);
    try {
      const snapshot = {
        viewport: {
          x: currentViewport.x,
          y: currentViewport.y,
          zoom: currentViewport.zoom,
        },
        items: currentItems
          .filter((item) => !item.is_deleted)
          .map((item) => ({
            id: item.id,
            type: item.type,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation ?? null,
            style: item.style,
            content: item.content,
            z_index: item.z_index,
            parent_item_id: item.parent_item_id ?? null,
          })),
      };

      await miroApi.createBoardRevision(boardId, {
        snapshot,
        note: note.trim() || undefined,
      });

      setNote("");
      await loadRevisions();
    } catch (err: any) {
      console.error("Failed to create snapshot:", err);
      setError(err instanceof Error ? err.message : "Failed to create snapshot");
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreClick = (version: number) => {
    setConfirmRestoreVersion(version);
  };

  const handleConfirmRestore = async () => {
    if (confirmRestoreVersion === null) return;
    const version = confirmRestoreVersion;

    setRestoring(version);
    setError(null);
    try {
      await miroApi.restoreBoardRevision(boardId, version);
      onRestore(); // Reload board and items
      onClose();
    } catch (err: any) {
      console.error("Failed to restore snapshot:", err);
      setError(err instanceof Error ? err.message : "Failed to restore snapshot");
    } finally {
      setRestoring(null);
      setConfirmRestoreVersion(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Prevent accidental close while an action is in-flight.
        if (!nextOpen && (creating || restoring !== null)) return;
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-gray-600" />
            Board Snapshots
          </DialogTitle>
          <DialogDescription>
            Create snapshots of the board state and restore previous versions.
          </DialogDescription>
        </DialogHeader>

        {/* Create Snapshot Section */}
        <div className="pb-4 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Create Snapshot
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) {
                  handleCreateSnapshot();
                }
              }}
            />
            <button
              onClick={handleCreateSnapshot}
              disabled={creating}
              className="px-4 py-2 bg-[#3CCED7] text-white rounded-md text-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Revisions List */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Snapshots ({revisions.length})
          </label>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading snapshots...</div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No snapshots yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {revisions.map((revision) => (
                <div
                  key={revision.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        Version {revision.version}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(revision.created_at)}
                      </span>
                    </div>
                    {revision.note && (
                      <div className="text-xs text-gray-600 mt-1">{revision.note}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {revision.snapshot?.items?.length || 0} items
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestoreClick(revision.version)}
                    disabled={restoring === revision.version || confirmRestoreVersion !== null}
                    className="ml-4 px-3 py-1.5 bg-[#3CCED7] text-white rounded text-xs hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {restoring === revision.version ? "Restoring..." : "Restore"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inline restore confirmation (keeps everything in one shared Dialog) */}
        {confirmRestoreVersion !== null && (
          <div className="rounded-md border border-[#3CCED7]/30 bg-[#3CCED7]/10 p-3 text-sm text-[#3CCED7]">
            <div className="font-semibold">Restore snapshot</div>
            <div className="mt-1">
              Restore to version {confirmRestoreVersion}? This will replace the current board state.
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setConfirmRestoreVersion(null)}
                disabled={restoring !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center rounded-md bg-[#3CCED7] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleConfirmRestore}
                disabled={restoring !== null}
              >
                {restoring !== null ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={creating || restoring !== null}
            className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

