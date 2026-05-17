"use client";

import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface CreateTaskCardProps {
  isOpen: boolean;
  // Kept for prop-compat with the legacy TaskCreatePanel; ignored by the new
  // centered-modal design. Pass through whatever the caller already passes.
  isExpanded?: boolean;
  title?: string;
  onClose: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // When true (default), clicking the backdrop does NOT close the modal — prevents
  // accidental data loss in a long form. Esc still closes.
  disableBackdropClose?: boolean;
}

const BRAND_GRADIENT = "linear-gradient(90deg, #3CCED7 0%, #A6E661 100%)";

export default function CreateTaskCard({
  isOpen,
  title = "Create task",
  onClose,
  children,
  footer,
  disableBackdropClose = true,
}: CreateTaskCardProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const card = useMemo(
    () => (
      <div
        data-testid="create-task-card"
        className="relative flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 sm:max-h-[calc(100vh-96px)] sm:w-[720px] sm:max-w-[95vw]"
      >
        <div
          className="h-[3px] w-full"
          style={{ background: BRAND_GRADIENT }}
          aria-hidden
        />

        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-7 sm:pt-6 sm:pb-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-6 text-gray-900">
              {title}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Required fields are marked with an asterisk *
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-7 sm:pb-6">
          {children}
        </div>

        {footer ? (
          <div className="flex flex-col items-stretch gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-7 [&_button]:w-full sm:[&_button]:w-auto">
            {footer}
          </div>
        ) : null}
      </div>
    ),
    [children, footer, onClose, title]
  );

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-2 py-2 sm:px-4 sm:py-8">
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={disableBackdropClose ? undefined : onClose}
      />
      <div className="relative z-10">{card}</div>
    </div>,
    document.body
  );
}
