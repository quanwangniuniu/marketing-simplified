"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { facebookApi } from "@/lib/api/facebookApi";
import { useProjectStore } from "@/lib/projectStore";

export type ExportUnit = "ad" | "creative" | "campaign";

interface Props {
  unit: ExportUnit;
  selectedIds: number[];
  adAccountId: number;
  days: number;
}

const UNIT_TAB_LABEL: Record<ExportUnit, string> = {
  ad: "Ads",
  creative: "Creatives",
  campaign: "Campaigns",
};

function buildSpreadsheetName(unit: ExportUnit): string {
  const tab = UNIT_TAB_LABEL[unit];
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  return `Meta Ads · ${tab} · ${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ExportActionMenu({
  unit,
  selectedIds,
  adAccountId,
  days,
}: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const projectId = useProjectStore(
    (state) => state.activeProject?.id ?? null
  );
  const count = selectedIds.length;
  const disabled = count === 0;

  const onCsv = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    const toastId = toast.loading(`Exporting ${count} ${unit}s to CSV…`);
    try {
      const filters = { ids: selectedIds };
      let bundle: { blob: Blob; filename: string };
      if (unit === "ad") {
        bundle = await facebookApi.getMetaAdExportCsv(
          adAccountId,
          days,
          filters
        );
      } else if (unit === "creative") {
        bundle = await facebookApi.getMetaCreativePerformanceCsv(
          adAccountId,
          days,
          filters
        );
      } else {
        bundle = await facebookApi.getMetaCampaignPerformanceCsv(
          adAccountId,
          days,
          filters
        );
      }
      downloadBlob(bundle.blob, bundle.filename);
      toast.dismiss(toastId);
      toast.success(`Exported ${count} ${unit}s to CSV`);
    } catch (err) {
      toast.dismiss(toastId);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to export CSV: ${message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, count, selectedIds, unit, adAccountId, days]);

  const onSpreadsheet = useCallback(async () => {
    if (busy || disabled) return;
    if (!projectId) {
      toast.error(
        "Select a project before exporting to a spreadsheet."
      );
      return;
    }
    setBusy(true);
    const name = buildSpreadsheetName(unit);
    const toastId = toast.loading(
      `Creating spreadsheet for ${count} ${unit}s…`
    );
    try {
      const filters = { ids: selectedIds };
      let result: { id: number; name: string; url: string };
      if (unit === "ad") {
        result = await facebookApi.exportAdsToSpreadsheet(
          adAccountId,
          projectId,
          name,
          days,
          filters
        );
      } else if (unit === "creative") {
        result = await facebookApi.exportCreativesToSpreadsheet(
          adAccountId,
          projectId,
          name,
          days,
          filters
        );
      } else {
        result = await facebookApi.exportCampaignsToSpreadsheet(
          adAccountId,
          projectId,
          name,
          days,
          filters
        );
      }
      toast.dismiss(toastId);
      if (typeof window !== "undefined") {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
      toast.success(`Created spreadsheet: ${result.name}`);
    } catch (err) {
      toast.dismiss(toastId);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to create spreadsheet: ${message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, projectId, count, selectedIds, unit, adAccountId, days]);

  const triggerLabel = count > 0 ? `Export (${count})` : "Export";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? "Select rows to export" : undefined}
          className={
            disabled
              ? "inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-lg bg-white px-3 text-sm font-medium text-gray-400 ring-1 ring-gray-200"
              : "inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 data-[state=open]:bg-gray-50 data-[state=open]:ring-gray-300"
          }
          aria-label={`Export ${count} selected ${unit}s`}
        >
          {triggerLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-[220px] rounded-md bg-white p-1 shadow-lg ring-1 ring-gray-100"
      >
        <DropdownMenuItem
          disabled={busy || disabled}
          onSelect={(event) => {
            event.preventDefault();
            void onCsv();
          }}
          className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        >
          <Download className="h-4 w-4 text-gray-500" />
          <span className="flex-1">{`Export ${count} to CSV`}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || disabled}
          onSelect={(event) => {
            event.preventDefault();
            void onSpreadsheet();
          }}
          className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4 text-gray-500" />
          <span className="flex-1">{`Export ${count} to Spreadsheet`}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
