import { useCallback, useMemo, useState } from "react";
import { BoardItem } from "@/lib/api/miroApi";

type HistoryEntry = {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

export function useBoardItemHistory() {
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const canUndo = useMemo(() => undoStack.length > 0 && !isApplying, [undoStack.length, isApplying]);
  const canRedo = useMemo(() => redoStack.length > 0 && !isApplying, [redoStack.length, isApplying]);

  const push = useCallback((entry: HistoryEntry) => {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  }, []);

  const runWithLock = useCallback(async (fn: () => Promise<void>) => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      await fn();
    } finally {
      setIsApplying(false);
    }
  }, [isApplying]);

  const undo = useCallback(async () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry || isApplying) return;

    await runWithLock(async () => {
      await entry.undo();
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, entry]);
    });
  }, [undoStack, runWithLock, isApplying]);

  const redo = useCallback(async () => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry || isApplying) return;

    await runWithLock(async () => {
      await entry.redo();
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, entry]);
    });
  }, [redoStack, runWithLock, isApplying]);

  const buildUpdateEntry = useCallback(
    (
      before: BoardItem[],
      after: BoardItem[],
      applySnapshot: (items: BoardItem[]) => Promise<void>
    ) => {
      return {
        undo: async () => applySnapshot(before),
        redo: async () => applySnapshot(after),
      } satisfies HistoryEntry;
    },
    []
  );

  return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    isApplyingHistory: isApplying,
    buildUpdateEntry,
  };
}
