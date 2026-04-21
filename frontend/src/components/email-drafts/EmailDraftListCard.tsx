"use client";

import React from "react";
import { Mail } from "lucide-react";
import { DraftActions } from "./DraftActions";

// List/table row presentation for a single draft.
export type EmailDraftListCardProps = {
  title?: string;
  status?: string;
  statusLabel?: string;
  statusClassName?: string;
  typeLabel?: string;
  date?: string;
  dateLabel?: string;
  recipients?: number;
  audienceLabel?: string;
  onTitleClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSend?: () => void;
  showCheckbox?: boolean;
  showActions?: boolean;
};

const statusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-[#3CCED7]/15 text-[#1a9ba3]",
  sent: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  locked: "bg-gray-200 text-gray-700",
  archived: "bg-purple-100 text-purple-700",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  error: "Error",
  locked: "Locked",
  archived: "Archived",
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "No send date";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "No send date";
    return date.toLocaleDateString();
  } catch {
    return "No send date";
  }
};

export function EmailDraftListCard({
  title = "Untitled Email",
  status = "draft",
  statusLabel,
  statusClassName,
  typeLabel,
  date,
  dateLabel,
  recipients,
  audienceLabel,
  onTitleClick,
  onEdit,
  onDelete,
  onSend,
  showCheckbox = true,
  showActions = true,
}: EmailDraftListCardProps) {
  const normalizedStatus = status.toLowerCase();
  const statusDisplay =
    statusLabel ?? statusLabels[normalizedStatus] ?? status;
  const statusColor =
    statusClassName ??
    statusStyles[normalizedStatus] ??
    "bg-gray-100 text-gray-600";
  const displayDate = dateLabel ?? formatDate(date);
  const displayAudience =
    audienceLabel ?? `${recipients ?? 0} recipients`;

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="py-1 px-3 w-[52px]">
        {showCheckbox ? (
          <input type="checkbox" className="accent-blue-600" />
        ) : null}
      </td>

      <td className="py-1 px-3 w-[90%]">
        <div
          className={`font-medium text-[#1a9ba3] ${
            onTitleClick ? "hover:underline cursor-pointer" : ""
          }`}
          onClick={onTitleClick}
          role={onTitleClick ? "button" : undefined}
          tabIndex={onTitleClick ? 0 : undefined}
          onKeyDown={(event) => {
            if (!onTitleClick) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onTitleClick();
            }
          }}
        >
          {title}
        </div>
        <div className="text-gray-500 text-xs flex items-center space-x-1">
          <Mail className="h-4" />
          <span>{typeLabel || "Regular email"}</span>
        </div>
        <div className="text-gray-400 text-xs">{displayDate}</div>
      </td>

      <td className="py-1 px-3 w-[56px]">
        <span className={`px-2 py-1 text-xs rounded-full ${statusColor}`}>
          {statusDisplay}
        </span>
      </td>

      <td className="py-1 px-3 w-[56px] text-gray-500">{displayAudience}</td>

      <td className="py-1 px-3 w-[140px] text-right">
        <div className="flex items-center justify-end gap-2">
          {showActions ? (
            <DraftActions
              onEdit={onEdit}
              onDelete={onDelete}
              onSend={onSend}
              size="sm"
              variant="icons"
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}


