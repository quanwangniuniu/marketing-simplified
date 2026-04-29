"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import {
  CheckSquare,
  ChevronDown,
  Download,
  GitBranch,
  MoreVertical,
  StickyNote,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import AddNoteDialog from "./AddNoteDialog";
import CreateDecisionFromAdDialog from "./CreateDecisionFromAdDialog";
import CreateTaskFromAdDialog from "./CreateTaskFromAdDialog";
import { triggerCsvExport } from "./adActions";

type Mode = "row" | "bulk";

interface Props {
  mode: Mode;
  ads: MetaAdPerformanceRow[];
  adAccountId: number;
  days: number;
  projectId: number | null;
}

export default function AdActionMenu({
  mode,
  ads,
  adAccountId,
  days,
  projectId,
}: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState<boolean>(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState<boolean>(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const count = ads.length;
  const isBulk = mode === "bulk";
  const single = count === 1 ? ads[0] : null;
  const adLabel = single ? single.name || single.meta_ad_id : null;

  const onExport = useCallback(async () => {
    if (exporting) return;
    if (count === 0) return;
    setExporting(true);
    const toastId = toast.loading(
      count > 1 ? `Exporting ${count} ads…` : "Exporting CSV…"
    );
    try {
      await triggerCsvExport({
        adAccountId,
        days,
        ids: ads.map((a) => a.id),
      });
      toast.dismiss(toastId);
      toast.success(
        count > 1 ? `Exported ${count} ads` : "Exported CSV"
      );
    } catch (err) {
      toast.dismiss(toastId);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to export CSV: ${message}`);
    } finally {
      setExporting(false);
    }
  }, [ads, adAccountId, days, count, exporting]);

  const triggerClass = isBulk
    ? "inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 data-[state=open]:bg-gray-50 data-[state=open]:ring-gray-300"
    : "inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 data-[state=open]:bg-gray-50 data-[state=open]:text-gray-900";

  const bulkLabel =
    count > 1 ? `Actions (${count})` : "Actions";

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={triggerClass}
            aria-label={
              isBulk
                ? `Bulk actions for ${count} selected ads`
                : `Actions for ${adLabel ?? "ad"}`
            }
          >
            {isBulk ? (
              <>
                {bulkLabel}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className="min-w-[200px] rounded-md bg-white p-1 shadow-lg ring-1 ring-gray-100"
        >
          <ActionItem
            icon={<CheckSquare className="h-4 w-4 text-gray-500" />}
            label={count > 1 ? `Create ${count} tasks` : "Create task"}
            onSelect={() => setTaskDialogOpen(true)}
          />
          <ActionItem
            icon={<GitBranch className="h-4 w-4 text-gray-500" />}
            label={count > 1 ? `Create ${count} decisions` : "Create decision"}
            onSelect={() => setDecisionDialogOpen(true)}
          />
          <ActionItem
            icon={<Download className="h-4 w-4 text-gray-500" />}
            label={count > 1 ? `Export ${count} ads to CSV` : "Export CSV"}
            disabled={exporting}
            onSelect={() => {
              void onExport();
            }}
          />
          <ActionItem
            icon={<StickyNote className="h-4 w-4 text-gray-500" />}
            label={count > 1 ? `Add note (${count})` : "Add note"}
            onSelect={() => setNoteDialogOpen(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTaskFromAdDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        ads={ads}
        days={days}
        projectId={projectId}
      />
      <CreateDecisionFromAdDialog
        open={decisionDialogOpen}
        onOpenChange={setDecisionDialogOpen}
        ads={ads}
        days={days}
        projectId={projectId}
      />
      <AddNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        adAccountId={adAccountId}
        ads={ads}
      />
    </>
  );
}

function ActionItem({
  icon,
  label,
  disabled,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault();
        if (disabled) return;
        onSelect();
      }}
      className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
    >
      {icon}
      <span className="flex-1">{label}</span>
    </DropdownMenuItem>
  );
}
