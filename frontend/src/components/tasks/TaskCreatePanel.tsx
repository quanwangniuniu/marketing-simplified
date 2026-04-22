"use client";

import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";

interface TaskCreatePanelProps {
  isOpen: boolean;
  isExpanded: boolean;
  title?: string;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function TaskCreatePanel({
  isOpen,
  isExpanded,
  title = "Create Task",
  onClose,
  onExpand,
  onCollapse,
  children,
  footer,
}: TaskCreatePanelProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isExpanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen, isExpanded]);

  const panel = useMemo(() => {
    const sizeClass = isExpanded
      ? "w-[860px] max-w-[95vw] max-h-[90vh]"
      : "w-[420px] max-w-[95vw] max-h-[75vh]";

    return (
      <div
        data-testid="task-create-panel"
        className={`relative flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] ${sizeClass}`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2 text-gray-900">
            <span className="flex h-6 w-6 items-center justify-center rounded border border-[#3CCED7]/30 bg-[#3CCED7]/10 text-[#3CCED7]">
              <Icon name="check" size="sm" />
            </span>
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <button
                type="button"
                onClick={onCollapse}
                className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                aria-label="Minimize create panel"
              >
                <Icon name="chevron-down" size="sm" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onExpand}
                className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                aria-label="Expand create panel"
              >
                <Icon name="chevron-up" size="sm" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label="Close create panel"
            >
              <Icon name="x" size="sm" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-3 text-xs text-gray-500">
          Required fields are marked with an asterisk *
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
          {children}
        </div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    );
  }, [children, footer, isExpanded, onClose, onCollapse, onExpand, title]);

  if (!isOpen || typeof document === "undefined") return null;

  if (isExpanded) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
        />
        <div className="relative z-10">{panel}</div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed bottom-6 left-6 right-6 z-50 flex justify-end sm:left-auto">
      {panel}
    </div>,
    document.body
  );
}
