"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/dashboard-v2/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { miroApi, MiroBoard, BoardItem, UpdateBoardItemData } from "@/lib/api/miroApi";
import { useBoardViewport, Viewport } from "@/components/miro-v2/hooks/useBoardViewport";
import { useBoardItems } from "@/components/miro-v2/hooks/useBoardItems";
import { LineVariant, ToolOptions, ToolType } from "@/components/miro-v2/hooks/useToolDnD";
import { useBoardItemHistory } from "@/components/miro-v2/hooks/useBoardItemHistory";
import BoardCanvas from "@/components/miro-v2/BoardCanvas";
import BoardHeader from "@/components/miro-v2/BoardHeader";
import BoardToolbar from "@/components/miro-v2/BoardToolbar";
import BoardPropertiesPanel from "@/components/miro-v2/BoardPropertiesPanel";
import BoardSnapshotsModal from "@/components/miro-v2/BoardSnapshotsModal";
import BoardPreviewModal from "@/components/miro-v2/BoardPreviewModal";
import BoardListSidebar from "@/components/miro-v2/BoardListSidebar";
import CreateBoardModal from "@/components/miro-v2/CreateBoardModal";
import { applyConnectorLayouts, type AnchorSide } from "@/components/miro-v2/utils/connectorLayout";
import { insertGraphTemplate } from "@/components/miro-v2/templates/insertGraphTemplate";
import type { GraphTemplateId } from "@/components/miro-v2/templates/graphTemplates";

/** Eraser: keep linked connectors at their last layout when an endpoint is erased. */
const ERASE_CONNECTOR_LAYOUT_OPTIONS = { preserveOrphanConnectors: true as const };

function MiroBoardPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.boardId as string;

  const [board, setBoard] = useState<MiroBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [isSnapshotsModalOpen, setIsSnapshotsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isBoardsSidebarOpen, setIsBoardsSidebarOpen] = useState(true);
  const [projectBoards, setProjectBoards] = useState<MiroBoard[]>([]);
  const [isBoardsLoading, setIsBoardsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [deleteBoardLoadingId, setDeleteBoardLoadingId] = useState<string | null>(null);
  const [lineVariant, setLineVariant] = useState<LineVariant>("straight_solid");
  const [brushSettings, setBrushSettings] = useState({
    strokeColor: "#000000",
    strokeWidth: 4,
  });

  // IMPORTANT: keep container (sizing) and canvas (event/rect) refs separate.
  // Reusing the same ref for two elements makes initial sizing unreliable and can
  // "fix itself" only after DevTools triggers a reflow/resize.
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const autoFitDoneRef = useRef(false);

  // Initialize viewport from board data
  const initialViewport: Viewport = board?.viewport
    ? {
        x: board.viewport.x || 0,
        y: board.viewport.y || 0,
        zoom: board.viewport.zoom || 1,
      }
    : { x: 0, y: 0, zoom: 1 };

  const {
    viewport,
    setViewport,
    screenToWorld,
    zoomAtPoint,
    startPan,
    updatePan,
    endPan,
    panBy,
  } = useBoardViewport(initialViewport);

  const {
    items,
    loading: itemsLoading,
    selectedItemIds,
    setSelectedItemIds,
    loadItems,
    createItem,
    updateItem,
    updateItemOptimistic,
    updateItemAsync,
    deleteItem,
    batchUpdateItems,
    removeItemsOptimistic,
    restoreItemsOptimistic,
  } = useBoardItems(boardId);
  const { push, undo, redo, canUndo, canRedo, buildUpdateEntry } = useBoardItemHistory();

  const connectorSignature = useCallback((c: BoardItem): string => {
    const conn = c.style?.connection ? JSON.stringify(c.style.connection) : "";
    const svgPath = typeof c.style?.svgPath === "string" ? c.style.svgPath : "";
    return [c.is_deleted, c.x, c.y, c.width, c.height, svgPath, conn].join("|");
  }, []);

  const getChangedLinkedConnectors = useCallback(
    (prevItems: BoardItem[], nextItems: BoardItem[]): Array<{ before: BoardItem; after: BoardItem }> => {
      const prevById = new Map(prevItems.map((i) => [i.id, i]));
      const nextById = new Map(nextItems.map((i) => [i.id, i]));

      const pairs: Array<{ before: BoardItem; after: BoardItem }> = [];
      for (const next of nextItems) {
        if (next.type !== "connector" || !next.style?.connection) continue;
        const prev = prevById.get(next.id);
        if (!prev || prev.type !== "connector") continue;
        if (connectorSignature(prev) !== connectorSignature(next)) {
          pairs.push({ before: prev, after: nextById.get(next.id)! });
        }
      }
      return pairs;
    },
    [connectorSignature]
  );

  const linkedConnectorSigRef = useRef<Map<string, string>>(new Map());

  const loadProjectBoards = useCallback(
    async (projectId: number) => {
      setIsBoardsLoading(true);
      try {
        const allBoards = await miroApi.getBoards();
        const boards = allBoards.filter(
          (item) => item.project_id === projectId && !item.is_archived
        );
        setProjectBoards(boards);
      } catch (err) {
        console.error("Failed to load project boards:", err);
      } finally {
        setIsBoardsLoading(false);
      }
    },
    []
  );

  // Persist linked connector geometry (and soft-deletes) after layout runs in useBoardItems.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const connectors = items.filter((i) => i.type === "connector" && i.style?.connection);
      if (connectors.length === 0) return;
      const updates: Array<{ id: string } & Partial<UpdateBoardItemData>> = [];
      for (const c of connectors) {
        const sig = [
          c.is_deleted,
          c.x,
          c.y,
          c.width,
          c.height,
          c.style?.svgPath ?? "",
          JSON.stringify(c.style?.connection ?? {}),
        ].join("|");
        if (linkedConnectorSigRef.current.get(c.id) === sig) continue;
        linkedConnectorSigRef.current.set(c.id, sig);
        updates.push({
          id: c.id,
          x: c.x,
          y: c.y,
          width: c.width,
          height: c.height,
          rotation: 0,
          style: c.style,
          is_deleted: c.is_deleted,
        });
      }
      if (updates.length > 0) {
        batchUpdateItems(updates).catch((err) =>
          console.error("Failed to persist linked connectors:", err)
        );
      }
    }, 220);
    return () => clearTimeout(t);
  }, [items, batchUpdateItems]);

  // Load board data
  useEffect(() => {
    const loadBoard = async () => {
      setLoading(true);
      setError(null);
      try {
        const boardData = await miroApi.getBoard(boardId);
        setBoard(boardData);
        loadProjectBoards(boardData.project_id);
        miroApi.markBoardAccess(boardId).catch((markErr) => {
          console.error("Failed to mark board access:", markErr);
        });
        
        // Update viewport from board
        if (boardData.viewport) {
          setViewport({
            x: boardData.viewport.x || 0,
            y: boardData.viewport.y || 0,
            zoom: boardData.viewport.zoom || 1,
          });
        }
      } catch (err: any) {
        console.error("Failed to load board:", err);
        if (err?.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load board");
      } finally {
        setLoading(false);
      }
    };

    if (boardId) {
      loadBoard();
      loadItems();
    }
  }, [boardId, loadItems, setViewport, loadProjectBoards]);

  // Reset one-time auto-fit when switching boards
  useEffect(() => {
    autoFitDoneRef.current = false;
  }, [boardId]);

  // Update canvas size when the container lays out / resizes.
  // useLayoutEffect ensures we measure as soon as layout is committed.
  // Deferred re-measure handles 0x0 on first paint (e.g. before flex layout settles).
  useLayoutEffect(() => {
    const updateCanvasSize = () => {
      if (canvasContainerRef.current) {
        const w = canvasContainerRef.current.clientWidth;
        const h = canvasContainerRef.current.clientHeight;
        setCanvasSize((prev) => {
          const next = { width: w, height: h };
          if (prev.width !== next.width || prev.height !== next.height) {
            if (process.env.NODE_ENV === "development" && (w > 0 || h > 0)) {
              console.debug("[Miro canvas] size:", next);
            }
            return next;
          }
          return prev;
        });
      }
    };

    updateCanvasSize();

    // If first measure was 0x0, re-measure after layout/paint (fixes race where
    // flex layout or parent size isn't ready yet; avoids "works only with DevTools open").
    const t1 = canvasContainerRef.current &&
      (canvasContainerRef.current.clientWidth <= 0 || canvasContainerRef.current.clientHeight <= 0)
      ? setTimeout(updateCanvasSize, 0)
      : undefined;
    const t2 = setTimeout(updateCanvasSize, 100);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateCanvasSize());
      if (canvasContainerRef.current) {
        ro.observe(canvasContainerRef.current);
      }
    }

    window.addEventListener("resize", updateCanvasSize);
    return () => {
      if (t1 !== undefined) clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", updateCanvasSize);
      ro?.disconnect();
    };
  }, []);

  // Debounced viewport save
  const viewportSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const saveViewport = useCallback(
    (newViewport: Viewport) => {
      if (viewportSaveTimeoutRef.current) {
        clearTimeout(viewportSaveTimeoutRef.current);
      }
      viewportSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await miroApi.updateBoard(boardId, {
            viewport: {
              x: newViewport.x,
              y: newViewport.y,
              zoom: newViewport.zoom,
            },
          });
        } catch (err) {
          console.error("Failed to save viewport:", err);
        }
      }, 500);
    },
    [boardId]
  );

  // Handle viewport changes
  useEffect(() => {
    if (board) {
      saveViewport(viewport);
    }
  }, [viewport, board, saveViewport]);

  const handleSaveBoard = useCallback(async () => {
    if (!boardId) return;
    setIsSavingBoard(true);
    try {
      const updatedBoard = await miroApi.updateBoard(boardId, {
        viewport: {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom,
        },
      });
      setBoard(updatedBoard);
    } catch (err) {
      console.error("Failed to save board:", err);
    } finally {
      setIsSavingBoard(false);
    }
  }, [boardId, viewport]);

  // Handle snapshots modal
  const handleSnapshotsClick = useCallback(() => {
    setIsSnapshotsModalOpen(true);
  }, []);

  // Handle preview modal
  const handlePreviewClick = useCallback(() => {
    setIsPreviewOpen(true);
  }, []);

  const handleRestoreSnapshot = useCallback(async () => {
    // Reload board and items after restore
    try {
      const boardData = await miroApi.getBoard(boardId);
      setBoard(boardData);
      // Update viewport from restored board
      if (boardData.viewport) {
        setViewport({
          x: boardData.viewport.x || 0,
          y: boardData.viewport.y || 0,
          zoom: boardData.viewport.zoom || 1,
        });
      }
      await loadItems();
    } catch (err) {
      console.error("Failed to reload board after restore:", err);
    }
  }, [boardId, loadItems, setViewport]);

  // Handle board title update
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (!board || newTitle === board.title) return;
      try {
        const updatedBoard = await miroApi.updateBoard(boardId, {
          title: newTitle,
        });
        setBoard(updatedBoard);
      } catch (err) {
        console.error("Failed to update board title:", err);
      }
    },
    [board, boardId]
  );

  const handleCreateBoard = useCallback(async (data: { title: string }) => {
    if (!board) return;
    setIsCreatingBoard(true);
    try {
      const created = await miroApi.createBoard({
        project_id: board.project_id,
        title: data.title,
        viewport: { x: 0, y: 0, zoom: 1 },
      });
      setIsCreateModalOpen(false);
      router.push(`/miro-v2/${created.id}`);
    } catch (err) {
      console.error("Failed to create board:", err);
    } finally {
      setIsCreatingBoard(false);
    }
  }, [board, router]);

  const handleDeleteBoardFromSidebar = useCallback(
    async (targetBoardId: string) => {
      if (!board) return;
      const target =
        projectBoards.find((b) => b.id === targetBoardId) ??
        (board.id === targetBoardId ? board : null);
      if (!target) {
        toast.error("Board not found");
        return;
      }
      if (target.is_archived) {
        toast.error("Cannot archive an already archived board");
        return;
      }
      const title = target.title?.trim() || "Untitled Board";
      if (
        !window.confirm(
          `Archive "${title}"? The board will move to Archived and can be restored later.`
        )
      ) {
        return;
      }
      setDeleteBoardLoadingId(targetBoardId);
      try {
        await miroApi.deleteBoard(targetBoardId);
        const allBoards = await miroApi.getBoards();
        const nextProjectBoards = allBoards.filter(
          (item) => item.project_id === board.project_id && !item.is_archived
        );
        setProjectBoards(nextProjectBoards);
        if (targetBoardId === boardId) {
          if (nextProjectBoards.length > 0) {
            router.push(`/miro-v2/${nextProjectBoards[0].id}`);
          } else {
            router.push("/miro-v2");
          }
        }
      } catch (err: any) {
        console.error("Failed to delete board:", err);
        if (err?.status === 401) {
          window.location.href = "/login";
          return;
        }
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to archive board"
        );
      } finally {
        setDeleteBoardLoadingId(null);
      }
    },
    [board, boardId, projectBoards, router]
  );

  // Handle item selection
  const handleItemSelect = useCallback((itemId: string | null, options?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => {
    if (!itemId) {
      setSelectedItemIds([]);
      return;
    }
    const additive = Boolean(options?.shiftKey || options?.metaKey || options?.ctrlKey);
    setSelectedItemIds((prev) => {
      if (!additive) return [itemId];
      if (prev.includes(itemId)) return prev.filter((id) => id !== itemId);
      return [...prev, itemId];
    });
  }, [setSelectedItemIds]);

  // Handle item update
  const handleItemUpdate = useCallback(
    async (itemId: string, updates: Partial<BoardItem>) => {
      try {
        // For content edits (typing), update UI immediately and persist in background.
        if (Object.prototype.hasOwnProperty.call(updates, "content")) {
          const before = items.filter((item) => item.id === itemId);
          const rollback = updateItemOptimistic(itemId, updates);
          updateItemAsync(itemId, updates, rollback).catch((err) => {
            console.error("Failed to persist item update (content):", err);
          });
          const after = before.map((item) => ({ ...item, ...updates }));
          push(buildUpdateEntry(before, after, async (snapshot) => {
            const target = snapshot[0];
            if (!target) return;
            await updateItem(target.id, target);
          }));
          return;
        }

        const prevItems = items;
        const beforeItem = prevItems.filter((item) => item.id === itemId);
        await updateItem(itemId, updates);

        const nextItems = applyConnectorLayouts(
          prevItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
        );
        const afterItem = nextItems.filter((item) => item.id === itemId);
        const changedConnectors = getChangedLinkedConnectors(prevItems, nextItems);

        const before = [
          ...beforeItem,
          ...changedConnectors.map((p) => p.before),
        ];
        const after = [
          ...afterItem,
          ...changedConnectors.map((p) => p.after),
        ];

        push(buildUpdateEntry(before, after, async (snapshot) => {
          const target = snapshot[0];
          if (!target) return;
          await updateItem(target.id, target);
        }));
      } catch (err) {
        console.error("Failed to update item:", err);
      }
    },
    [updateItem, updateItemOptimistic, updateItemAsync, items, push, buildUpdateEntry, getChangedLinkedConnectors]
  );

  // Handle item delete
  const handleItemDelete = useCallback(async () => {
    if (selectedItemIds.length === 0) return;
    let rollback: (() => void) | undefined;
    try {
      const deletingIds = selectedItemIds.slice();
      rollback = removeItemsOptimistic(deletingIds);
      await Promise.all(deletingIds.map((id) => deleteItem(id)));
      const redoDelete = async () => {
        await Promise.all(deletingIds.map((id) => deleteItem(id)));
      };
      const undoDelete = async () => {
        const restoreRollback = restoreItemsOptimistic(deletingIds);
        try {
          await Promise.all(deletingIds.map((id) => updateItem(id, { is_deleted: false })));
        } catch (err) {
          restoreRollback();
          throw err;
        }
      };
      push({ undo: undoDelete, redo: redoDelete });
      setSelectedItemIds([]);
    } catch (err) {
      rollback?.();
      console.error("Failed to delete item:", err);
    }
  }, [selectedItemIds, deleteItem, setSelectedItemIds, push, removeItemsOptimistic, restoreItemsOptimistic, updateItem]);

  const handleEraseItem = useCallback(
    async (itemId: string) => {
      let rollback: (() => void) | undefined;
      try {
        rollback = removeItemsOptimistic([itemId], ERASE_CONNECTOR_LAYOUT_OPTIONS);
        await deleteItem(itemId, ERASE_CONNECTOR_LAYOUT_OPTIONS);
        push({
          undo: async () => {
            const restoreRollback = restoreItemsOptimistic([itemId]);
            try {
              await updateItem(itemId, { is_deleted: false });
            } catch (err) {
              restoreRollback();
              throw err;
            }
          },
          redo: async () => {
            await deleteItem(itemId, ERASE_CONNECTOR_LAYOUT_OPTIONS);
          },
        });
        setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
      } catch (err) {
        rollback?.();
        console.error("Failed to erase item:", err);
      }
    },
    [deleteItem, push, removeItemsOptimistic, restoreItemsOptimistic, updateItem, setSelectedItemIds]
  );

  const resolveToolCreateSpec = useCallback(
    (toolType: ToolType, options?: ToolOptions): {
      resolvedType: BoardItem["type"];
      style: Record<string, any>;
    } => {
      const lv = options?.lineVariant ?? lineVariant;
      if (toolType === "line") {
        const strokeDasharray =
          lv === "straight_dashed" || lv === "arrow_dashed"
            ? "8,4"
            : lv === "straight_dotted"
              ? "2,4"
              : undefined;
        const resolvedType: BoardItem["type"] =
          lv === "arrow_solid" || lv === "arrow_dashed" ? "connector" : "line";
        return { resolvedType, style: { strokeColor: "#111827", strokeWidth: 4, strokeDasharray } };
      }

      if (toolType === "emoji") {
        return { resolvedType: "emoji", style: {} as Record<string, any> };
      }

      return { resolvedType: toolType as BoardItem["type"], style: {} as Record<string, any> };
    },
    [lineVariant]
  );

  // Handle item creation via drag-and-drop
  const handleItemCreate = useCallback(
    async (toolType: ToolType, worldX: number, worldY: number, options?: ToolOptions) => {
      if (toolType === "select" || toolType === "multi_select" || toolType === "connect") return;

      const defaultSizes: Record<string, { width: number; height: number }> = {
        text: { width: 200, height: 50 },
        shape: { width: 100, height: 100 },
        sticky_note: { width: 150, height: 150 },
        frame: { width: 300, height: 200 },
        line: { width: 200, height: 20 },
        connector: { width: 200, height: 20 },
        freehand: { width: 100, height: 100 },
        emoji: { width: 64, height: 64 },
      };

      const { resolvedType, style } = resolveToolCreateSpec(toolType, options);
      const size = defaultSizes[resolvedType] || { width: 100, height: 100 };

      const initialContent =
        toolType === "text" || toolType === "sticky_note"
          ? ""
          : toolType === "emoji"
            ? options?.emoji ?? "😀"
            : "";

      try {
        const created = await createItem({
          type: resolvedType,
          x: worldX,
          y: worldY,
          width: size.width,
          height: size.height,
          content: initialContent,
          style,
          z_index: 0,
        });
        push({
          undo: async () => {
            await updateItem(created.id, { is_deleted: true });
          },
          redo: async () => {
            await updateItem(created.id, { is_deleted: false });
          },
        });
        // Keep tool selected for potential repeated use
      } catch (err) {
        console.error("Failed to create item:", err);
      }
    },
    [createItem, resolveToolCreateSpec, push, updateItem]
  );

  const handleEmojiInsert = useCallback(
    async (emoji: string) => {
      let w = canvasSize.width;
      let h = canvasSize.height;
      if ((w <= 0 || h <= 0) && canvasContainerRef.current) {
        w = canvasContainerRef.current.clientWidth;
        h = canvasContainerRef.current.clientHeight;
      }
      if (w <= 0 || h <= 0) return;

      const size = { width: 64, height: 64 };
      const centerWorld = screenToWorld(w / 2, h / 2);
      const x = centerWorld.x - size.width / 2;
      const y = centerWorld.y - size.height / 2;

      try {
        const created = await createItem({
          type: "emoji",
          x,
          y,
          width: size.width,
          height: size.height,
          content: emoji,
          style: {},
          z_index: 0,
        });
        push({
          undo: async () => {
            await updateItem(created.id, { is_deleted: true });
          },
          redo: async () => {
            await updateItem(created.id, { is_deleted: false });
          },
        });
        setSelectedItemIds([created.id]);
      } catch (err) {
        console.error("Failed to create emoji:", err);
      }
    },
    [canvasSize.height, canvasSize.width, createItem, push, screenToWorld, updateItem, setSelectedItemIds]
  );

  const createAtViewportCenter = useCallback(
    async (toolType: ToolType, options?: ToolOptions) => {
      if (
        toolType === "select" ||
        toolType === "multi_select" ||
        toolType === "freehand" ||
        toolType === "emoji" ||
        toolType === "connect"
      ) {
        return;
      }

      // Use live ref dimensions when state is still 0 (e.g. before first layout effect runs).
      let w = canvasSize.width;
      let h = canvasSize.height;
      if (w <= 0 || h <= 0) {
        if (canvasContainerRef.current) {
          w = canvasContainerRef.current.clientWidth;
          h = canvasContainerRef.current.clientHeight;
          if (process.env.NODE_ENV === "development") {
            console.debug("[Miro canvas] createAtViewportCenter used ref dimensions:", { w, h });
          }
        }
        if (w <= 0 || h <= 0) return;
      }

      const defaultSizes: Record<string, { width: number; height: number }> = {
        text: { width: 200, height: 50 },
        shape: { width: 100, height: 100 },
        sticky_note: { width: 150, height: 150 },
        frame: { width: 300, height: 200 },
        line: { width: 200, height: 20 },
        connector: { width: 200, height: 20 },
        freehand: { width: 100, height: 100 },
        emoji: { width: 64, height: 64 },
      };

      const { resolvedType, style } = resolveToolCreateSpec(toolType, options);
      const size = defaultSizes[resolvedType] || { width: 100, height: 100 };
      const centerWorld = screenToWorld(w / 2, h / 2);
      const x = centerWorld.x - size.width / 2;
      const y = centerWorld.y - size.height / 2;

      try {
        const created = await createItem({
          type: resolvedType,
          x,
          y,
          width: size.width,
          height: size.height,
          content: toolType === "text" || toolType === "sticky_note" ? "" : "",
          style,
          z_index: 0,
        });
        push({
          undo: async () => {
            await updateItem(created.id, { is_deleted: true });
          },
          redo: async () => {
            await updateItem(created.id, { is_deleted: false });
          },
        });
      } catch (err) {
        console.error("Failed to create item:", err);
      } finally {
        setActiveTool("select");
      }
    },
    [canvasSize.height, canvasSize.width, createItem, resolveToolCreateSpec, screenToWorld, push, updateItem]
  );

  const handleInsertTemplate = useCallback(
    async (templateId: GraphTemplateId) => {
      // Use live ref dimensions when state is still 0 (e.g. before first layout effect runs).
      let w = canvasSize.width;
      let h = canvasSize.height;
      if (w <= 0 || h <= 0) {
        if (canvasContainerRef.current) {
          w = canvasContainerRef.current.clientWidth;
          h = canvasContainerRef.current.clientHeight;
        }
        if (w <= 0 || h <= 0) return;
      }

      const centerWorld = screenToWorld(w / 2, h / 2);

      try {
        const result = await insertGraphTemplate({
          templateId,
          origin: centerWorld,
          createItem,
        });

        const ids = result.createdItemIds.slice();
        push({
          undo: async () => {
            await Promise.all(ids.map((id) => updateItem(id, { is_deleted: true })));
          },
          redo: async () => {
            await Promise.all(ids.map((id) => updateItem(id, { is_deleted: false })));
          },
        });

        setSelectedItemIds([result.rootItemId]);
      } catch (err) {
        console.error("Failed to insert template:", err);
      }
    },
    [canvasSize.width, canvasSize.height, screenToWorld, createItem, push, updateItem, setSelectedItemIds]
  );

  // Handle freehand creation
  const handleLinkedConnectorCreate = useCallback(
    async (payload: {
      fromItemId: string;
      toItemId: string;
      fromAnchor: AnchorSide;
      toAnchor: AnchorSide;
    }) => {
      try {
        const created = await createItem({
          type: "connector",
          x: 0,
          y: 0,
          width: 120,
          height: 40,
          content: "",
          rotation: 0,
          style: {
            strokeColor: "#111827",
            strokeWidth: 4,
            connection: {
              fromItemId: payload.fromItemId,
              toItemId: payload.toItemId,
              fromAnchor: payload.fromAnchor,
              toAnchor: payload.toAnchor,
            },
          },
          z_index: 0,
        });
        push({
          undo: async () => {
            await updateItem(created.id, { is_deleted: true });
          },
          redo: async () => {
            await updateItem(created.id, { is_deleted: false });
          },
        });
        setSelectedItemIds([created.id]);
      } catch (err) {
        console.error("Failed to create linked connector:", err);
      }
    },
    [createItem, push, updateItem, setSelectedItemIds]
  );

  const handleFreehandCreate = useCallback(
    async (data: {
      x: number;
      y: number;
      width: number;
      height: number;
      style: { svgPath: string; strokeColor: string; strokeWidth: number };
    }) => {
      try {
        const created = await createItem({
          type: "freehand",
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          content: "",
          style: data.style,
          z_index: 0,
        });
        push({
          undo: async () => {
            await updateItem(created.id, { is_deleted: true });
          },
          redo: async () => {
            await updateItem(created.id, { is_deleted: false });
          },
        });
      } catch (err) {
        console.error("Failed to create freehand:", err);
      }
    },
    [createItem, push, updateItem]
  );


  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      zoomAtPoint(centerX, centerY, 0.2);
    }
  }, [zoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      zoomAtPoint(centerX, centerY, -0.2);
    }
  }, [zoomAtPoint]);

  const handleFitToScreen = useCallback(() => {
    if (items.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const visibleItems = items.filter((item) => !item.is_deleted);
    if (visibleItems.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    visibleItems.forEach((item) => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth === 0 || contentHeight === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const padding = 50;
    const zoomX = (canvasSize.width - padding * 2) / contentWidth;
    const zoomY = (canvasSize.height - padding * 2) / contentHeight;
    const zoomUnclamped = Math.min(zoomX, zoomY, 1);
    const zoom = Math.max(0.5, Math.min(3, zoomUnclamped));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const x = canvasSize.width / 2 - centerX * zoom;
    const y = canvasSize.height / 2 - centerY * zoom;

    setViewport({ x, y, zoom });
  }, [items, canvasSize, setViewport]);

  const isAnyItemVisibleInViewport = useCallback(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return true;
    const visibleItems = items.filter((item) => !item.is_deleted);
    if (visibleItems.length === 0) return true;

    const buffer = 100; // pixels
    const bufferWorld = buffer / viewport.zoom;

    const topLeft = {
      x: (0 - viewport.x) / viewport.zoom,
      y: (0 - viewport.y) / viewport.zoom,
    };
    const bottomRight = {
      x: (canvasSize.width - viewport.x) / viewport.zoom,
      y: (canvasSize.height - viewport.y) / viewport.zoom,
    };

    return visibleItems.some((item) => {
      return (
        item.x + item.width >= topLeft.x - bufferWorld &&
        item.x <= bottomRight.x + bufferWorld &&
        item.y + item.height >= topLeft.y - bufferWorld &&
        item.y <= bottomRight.y + bufferWorld
      );
    });
  }, [items, viewport, canvasSize]);

  // Auto-fit once on initial open if nothing is in view (items may be far away in world coords)
  useEffect(() => {
    if (autoFitDoneRef.current) return;
    if (!board) return;
    if (itemsLoading) return;
    if (items.length === 0) return;
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;

    const anyVisible = isAnyItemVisibleInViewport();
    if (!anyVisible) {
      handleFitToScreen();
      autoFitDoneRef.current = true;
    }
  }, [
    board,
    itemsLoading,
    items.length,
    canvasSize.width,
    canvasSize.height,
    isAnyItemVisibleInViewport,
    handleFitToScreen,
  ]);

  // Pan handlers
  const handlePanStart = useCallback(
    (x: number, y: number) => {
      startPan(x, y);
    },
    [startPan]
  );

  const handlePanUpdate = useCallback(
    (x: number, y: number) => {
      updatePan(x, y);
    },
    [updatePan]
  );

  const handlePanEnd = useCallback(() => {
    endPan();
  }, [endPan]);

  // Zoom handler
  const handleZoom = useCallback(
    (mouseX: number, mouseY: number, delta: number) => {
      zoomAtPoint(mouseX, mouseY, delta);
    },
    [zoomAtPoint]
  );

  const selectedItem = selectedItemIds.length === 1
    ? items.find((item) => item.id === selectedItemIds[0]) || null
    : null;

  const applySnapshot = useCallback(async (snapshot: BoardItem[]) => {
    await Promise.all(snapshot.map((item) => updateItem(item.id, item)));
  }, [updateItem]);

  const handleItemsBatchUpdate = useCallback(async (updates: Array<{ id: string } & Partial<BoardItem>>) => {
    const prevItems = items;
    const updateIds = new Set(updates.map((u) => u.id));
    const beforeItems = prevItems.filter((item) => updateIds.has(item.id));

    const nextItems = applyConnectorLayouts(
      prevItems.map((item) => {
        const update = updates.find((u) => u.id === item.id);
        return update ? { ...item, ...update } : item;
      })
    );
    const changedConnectors = getChangedLinkedConnectors(prevItems, nextItems);

    const before = [...beforeItems, ...changedConnectors.map((p) => p.before)];

    await batchUpdateItems(updates);

    const after = [
      ...nextItems.filter((item) => updateIds.has(item.id)),
      ...changedConnectors.map((p) => p.after),
    ];

    push(buildUpdateEntry(before, after, applySnapshot));
  }, [items, batchUpdateItems, push, buildUpdateEntry, applySnapshot, getChangedLinkedConnectors]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isPreviewOpen || isSnapshotsModalOpen) return;
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (key === "escape" && activeTool !== "select") {
        event.preventDefault();
        setActiveTool("select");
        return;
      }
      if ((key === "delete" || key === "backspace") && selectedItemIds.length > 0) {
        event.preventDefault();
        handleItemDelete();
        return;
      }
      if (key === "escape" && selectedItemIds.length > 0) {
        event.preventDefault();
        setSelectedItemIds([]);
        return;
      }
      if (mod && key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (!event.metaKey && event.ctrlKey && key === "y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItemIds, handleItemDelete, redo, undo, setSelectedItemIds, isPreviewOpen, isSnapshotsModalOpen, activeTool]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
    };

    const onContextMenu = (event: MouseEvent) => {
      if (isEditableTarget(event.target) || isPreviewOpen || isSnapshotsModalOpen) return;
      if (activeTool === "select") return;

      const el = canvasRef.current;
      const target = event.target as HTMLElement | null;
      if (!el || !target) return;

      if (el.contains(target)) {
        event.preventDefault();
        setActiveTool("select");
      }
    };

    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    return () => window.removeEventListener("contextmenu", onContextMenu, { capture: true } as any);
  }, [activeTool, isPreviewOpen, isSnapshotsModalOpen]);

  if (loading) {
    return (
      <DashboardLayout hideRightPanel>
        <div className="-m-5 flex h-[calc(100vh-3rem)] items-center justify-center bg-gray-50">
          <div className="text-sm text-gray-500">Loading board…</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !board) {
    return (
      <DashboardLayout hideRightPanel>
        <div className="-m-5 flex h-[calc(100vh-3rem)] flex-col items-center justify-center gap-3 bg-gray-50">
          <div className="text-sm text-rose-600">
            {error || "Board not found"}
          </div>
          <button
            onClick={() => router.push("/miro-v2")}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Back to Boards
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout hideRightPanel>
      <div className="-m-5 flex h-[calc(100vh-3rem)] flex-col bg-[#F3F4F7]">
        <BoardHeader
          title={board.title}
          onTitleChange={handleTitleChange}
          viewport={viewport}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToScreen={handleFitToScreen}
          onSave={handleSaveBoard}
          isSaving={isSavingBoard}
          shareToken={board.share_token}
          onSnapshotClick={handleSnapshotsClick}
          onPreviewClick={handlePreviewClick}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onBoardsToggle={() => setIsBoardsSidebarOpen((prev) => !prev)}
          onBack={() => router.push("/miro-v2")}
        />

        <div className="flex flex-1 overflow-hidden min-h-0">
          <BoardToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onToolPrimaryAction={createAtViewportCenter}
            onEmojiInsert={handleEmojiInsert}
            onInsertTemplate={handleInsertTemplate}
            lineVariant={lineVariant}
            onLineVariantChange={setLineVariant}
          />

          <div ref={canvasContainerRef} className="flex-1 relative min-h-0">
            <BoardCanvas
              viewport={viewport}
              items={items}
              selectedItemIds={selectedItemIds}
              activeTool={activeTool}
              onItemSelect={handleItemSelect}
              onItemUpdate={handleItemUpdate}
              onItemUpdateOptimistic={updateItemOptimistic}
              onItemUpdateAsync={updateItemAsync}
              onPanStart={handlePanStart}
              onPanUpdate={handlePanUpdate}
              onPanEnd={handlePanEnd}
              onZoom={handleZoom}
              onPanBy={panBy}
              onItemCreate={handleItemCreate}
              onFreehandCreate={handleFreehandCreate}
              onLinkedConnectorCreate={handleLinkedConnectorCreate}
              onItemsBatchUpdate={handleItemsBatchUpdate}
              onEraseItem={handleEraseItem}
              width={canvasSize.width}
              height={canvasSize.height}
              canvasRef={canvasRef}
              brushSettings={brushSettings}
            />
          </div>

          {(selectedItem || activeTool === "freehand") && (
            <BoardPropertiesPanel
              selectedItem={selectedItem}
              selectedItemsCount={selectedItemIds.length}
              activeTool={activeTool}
              brushSettings={brushSettings}
              onBrushSettingsChange={setBrushSettings}
              onUpdate={(updates) => {
                if (selectedItem) {
                  handleItemUpdate(selectedItem.id, updates);
                } else {
                  console.error("Cannot update item: selectedItem is null");
                }
              }}
              onDelete={handleItemDelete}
            />
          )}
        </div>

        {/* Snapshots Modal */}
        {board && (
          <BoardSnapshotsModal
            open={isSnapshotsModalOpen}
            boardId={boardId}
            currentViewport={viewport}
            currentItems={items}
            onClose={() => setIsSnapshotsModalOpen(false)}
            onRestore={handleRestoreSnapshot}
          />
        )}

        {/* Preview Modal */}
        <BoardPreviewModal
          open={isPreviewOpen}
          items={items}
          onClose={() => setIsPreviewOpen(false)}
        />

        <CreateBoardModal
          open={isCreateModalOpen}
          projectId={board?.project_id}
          isCreating={isCreatingBoard}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateBoard}
        />
      </div>
    </DashboardLayout>
  );
}

export default function MiroV2BoardPage() {
  return (
    <ProtectedRoute>
      <MiroBoardPage />
    </ProtectedRoute>
  );
}

