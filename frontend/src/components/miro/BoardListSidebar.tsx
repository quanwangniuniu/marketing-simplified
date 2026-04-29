"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { MiroBoard } from "@/lib/api/miroApi";
import { boardNameToAcronym } from "@/components/miro/utils/boardNameAcronym";

interface BoardListSidebarProps {
  isOpen: boolean;
  boards: MiroBoard[];
  activeBoardId: string;
  /** Shown in collapsed rail / acronym when the active board is not yet in `boards`. */
  activeBoardTitle?: string;
  loading?: boolean;
  onToggle: () => void;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  /** Right-click on a board → delete (archives on server). */
  onDeleteBoard?: (boardId: string) => void | Promise<void>;
  deleteLoadingBoardId?: string | null;
}

const cardBase =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-600 shadow-sm transition-colors";
const cardInactive = "hover:border-gray-300 hover:bg-gray-50/80";
const cardActive = "border-[#3CCED7] bg-[#3CCED7]/10/60 text-gray-800 ring-1 ring-[#3CCED7]/30/60";

const railBtnBase =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-semibold uppercase leading-none tracking-tight shadow-sm transition-colors";
const railInactive =
  "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50";
const railActive = `${cardActive} text-gray-800`;

const CONTEXT_MENU_W = 160;
const CONTEXT_MENU_H = 48;

export default function BoardListSidebar({
  isOpen,
  boards,
  activeBoardId,
  activeBoardTitle,
  loading = false,
  onToggle,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  deleteLoadingBoardId = null,
}: BoardListSidebarProps) {
  const [boardContextMenu, setBoardContextMenu] = useState<{
    boardId: string;
    x: number;
    y: number;
  } | null>(null);

  const closeBoardContextMenu = useCallback(() => setBoardContextMenu(null), []);

  useEffect(() => {
    if (!boardContextMenu) return;
    const onDocClick = () => {
      setTimeout(() => setBoardContextMenu(null), 0);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [boardContextMenu]);

  useEffect(() => {
    if (!boardContextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBoardContextMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardContextMenu]);

  const openBoardContextMenu = (e: React.MouseEvent, boardId: string) => {
    if (!onDeleteBoard) return;
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;
    if (x + CONTEXT_MENU_W > window.innerWidth) {
      x = e.clientX - CONTEXT_MENU_W;
    }
    if (y + CONTEXT_MENU_H > window.innerHeight) {
      y = e.clientY - CONTEXT_MENU_H;
    }
    setBoardContextMenu({ boardId, x, y });
  };

  const handleContextDelete = () => {
    if (!boardContextMenu || !onDeleteBoard) return;
    const id = boardContextMenu.boardId;
    closeBoardContextMenu();
    void onDeleteBoard(id);
  };

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const activeTitle =
    activeBoard?.title?.trim() || activeBoardTitle?.trim() || "Untitled Board";

  /** Rows for collapsed rail: include current board if the list has not loaded it yet. */
  const boardRows = useMemo(() => {
    const rows = boards.map((b) => ({
      id: b.id,
      label: b.title?.trim() || "Untitled Board",
    }));
    if (!rows.some((r) => r.id === activeBoardId)) {
      return [{ id: activeBoardId, label: activeTitle }, ...rows];
    }
    return rows;
  }, [boards, activeBoardId, activeTitle]);

  return (
    <div
      className={`relative flex min-h-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        isOpen ? "w-72" : "w-14"
      }`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-2">
        <button
          type="button"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          onClick={onToggle}
          title={isOpen ? "Collapse boards" : "Expand boards"}
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {isOpen && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xl border border-[#3CCED7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3CCED7] shadow-sm hover:bg-[#3CCED7]/10"
            onClick={onCreateBoard}
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        )}
      </div>

      {!isOpen && (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden px-1.5 pb-2 pt-3">
          {loading ? (
            <p className="px-0.5 text-center text-[10px] text-gray-400">…</p>
          ) : boardRows.length === 0 ? (
            <p className="px-0.5 text-center text-[10px] text-gray-400">—</p>
          ) : (
            boardRows.map((row) => {
              const isActive = row.id === activeBoardId;
              const acronym = boardNameToAcronym(row.label);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectBoard(row.id)}
                  onContextMenu={(e) => openBoardContextMenu(e, row.id)}
                  title={row.label}
                  className={`${railBtnBase} ${isActive ? railActive : railInactive}`}
                >
                  {acronym}
                </button>
              );
            })
          )}
        </div>
      )}

      {isOpen && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="px-1 py-3 text-xs text-gray-500">Loading boards...</p>
          ) : boards.length === 0 ? (
            <p className="px-1 py-3 text-xs text-gray-500">No boards in this project yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {boards.map((board) => {
                const label = board.title?.trim() || "Untitled Board";
                const isActive = board.id === activeBoardId;
                return (
                  <li key={board.id}>
                    <button
                      type="button"
                      onClick={() => onSelectBoard(board.id)}
                      onContextMenu={(e) => openBoardContextMenu(e, board.id)}
                      className={`${cardBase} ${isActive ? cardActive : cardInactive}`}
                    >
                      <span className="block truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {boardContextMenu && onDeleteBoard && (
        <div
          className="fixed z-[100] min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: boardContextMenu.x, top: boardContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            disabled={deleteLoadingBoardId === boardContextMenu.boardId}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleContextDelete}
          >
            {deleteLoadingBoardId === boardContextMenu.boardId ? "Deleting…" : "Delete board"}
          </button>
        </div>
      )}
    </div>
  );
}
