"use client";

import React from "react";

// Presentation-only draft metadata card.
// Presentation-only card for draft metadata.
export type DraftCardStatus = "draft" | "scheduled" | "sent" | "error" | string;

export type DraftCardProps = {
  subject: string;
  onSubjectClick?: () => void;
  previewText?: string;
  fromName?: string;
  status?: DraftCardStatus;
  statusLabel?: string;
  menu?: React.ReactNode;
  sendTime?: string;
  recipients?: number;
  type?: string;
  helperText?: string;
  isLoading?: boolean;
  readOnly?: boolean;
};

// Shared badge styles for common states.
const statusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-[#3CCED7]/15 text-[#1a9ba3]",
  sent: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

// Default labels when no custom statusLabel is provided.
const statusLabels: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  error: "Error",
};

// Keep date formatting consistent with the list view.
const formatDate = (dateString?: string) => {
  if (!dateString) return "No send date";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "No send date";
  return date.toLocaleDateString();
};

export function DraftCard({
  subject,
  onSubjectClick,
  previewText,
  fromName,
  status = "draft",
  statusLabel,
  menu,
  sendTime,
  recipients,
  type,
  helperText,
  isLoading = false,
  readOnly = false,
}: DraftCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-40 rounded bg-gray-100" />
                <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
              </div>
              <div className="h-6 w-16 rounded-full bg-gray-100" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="h-3 w-20 rounded bg-gray-100" />
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const normalizedStatus = status.toLowerCase();
  const badgeClass =
    statusStyles[normalizedStatus] ?? "bg-gray-100 text-gray-600";
  const badgeLabel =
    statusLabel ?? statusLabels[normalizedStatus] ?? status.toString();

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm ${
        readOnly ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {onSubjectClick ? (
                  <button
                    type="button"
                    onClick={onSubjectClick}
                    className="min-w-0 flex-1 truncate text-left text-base font-semibold text-[#1a9ba3] hover:underline"
                  >
                    {subject}
                  </button>
                ) : (
                  <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[#1a9ba3]">
                    {subject}
                  </h3>
                )}
                <span className={`px-2 py-1 text-xs rounded-full ${badgeClass}`}>
                  {badgeLabel}
                </span>
              </div>
            </div>
            {menu ? <div className="flex-shrink-0">{menu}</div> : null}
          </div>
          {previewText ? (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {previewText}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>From: {fromName || "Unknown sender"}</span>
            <span>Type: {type || "Regular email"}</span>
            <span>Recipients: {recipients ?? 0}</span>
            <span>Send date: {formatDate(sendTime)}</span>
          </div>
          {helperText ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {helperText}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


