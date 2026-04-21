"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";

// Action controls used by list rows and cards.
export type DraftActionsProps = {
  onEdit?: () => void;
  onSend?: () => void;
  onDelete?: () => void;
  editDisabled?: boolean;
  sendDisabled?: boolean;
  deleteDisabled?: boolean;
  deleteLoading?: boolean;
  size?: "sm" | "md";
  variant?: "buttons" | "icons" | "menu";
};

export function DraftActions({
  onEdit,
  onSend,
  onDelete,
  editDisabled = false,
  sendDisabled = false,
  deleteDisabled = false,
  deleteLoading = false,
  size = "md",
  variant = "icons",
}: DraftActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const base =
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const buttonClass = `rounded-md font-medium ${base}`;
  const iconButtonClass =
    size === "sm"
      ? "p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
      : "p-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50";

  if (variant === "buttons") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${buttonClass} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
          onClick={onEdit}
          disabled={editDisabled}
        >
          Edit
        </button>
        <button
          type="button"
          className={`${buttonClass} bg-white border border-red-200 text-red-600 hover:bg-red-50 ${
            deleteLoading || deleteDisabled ? "opacity-70 cursor-not-allowed" : ""
          }`}
          onClick={onDelete}
          disabled={deleteLoading || deleteDisabled}
          aria-busy={deleteLoading}
        >
          {deleteLoading ? "Deleting..." : "Delete"}
        </button>
        <button
          type="button"
          className={`${buttonClass} bg-[#3CCED7] text-white hover:bg-[#2AB5BD] ${
            sendDisabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
          onClick={onSend}
          disabled={sendDisabled}
        >
          Send
        </button>
      </div>
    );
  }

  if (variant === "menu") {
    return (
      <div className="relative inline-flex" ref={menuRef}>
        <button
          type="button"
          className={iconButtonClass}
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {open ? (
          <div
            className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-gray-200 bg-white shadow-lg"
            role="menu"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setOpen(false);
                onEdit?.();
              }}
              role="menuitem"
              disabled={!onEdit}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setOpen(false);
                onSend?.();
              }}
              role="menuitem"
              disabled={!onSend}
            >
              <Send className="h-4 w-4" />
              Send
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setOpen(false);
                onDelete?.();
              }}
              role="menuitem"
              disabled={!onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={iconButtonClass}
        onClick={onEdit}
        disabled={editDisabled}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={iconButtonClass}
        onClick={onDelete}
        disabled={deleteLoading || deleteDisabled}
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={`${iconButtonClass} bg-[#3CCED7] text-white hover:bg-[#2AB5BD] ${
          sendDisabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
        onClick={onSend}
        disabled={sendDisabled}
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}


