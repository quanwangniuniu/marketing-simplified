"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import BrandDialog from "@/components/tasks-v2/detail/BrandDialog";
import { TaskAPI } from "@/lib/api/taskApi";
import type { CreateTaskData } from "@/types/task";
import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import { buildAdContextDescription } from "./adActions";
import { thumbnailOrFallback } from "./metaAdsUtils";

const DEFAULT_TASK_TYPE = "TASK";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ads: MetaAdPerformanceRow[];
  days: number;
  projectId: number | null;
}

export default function CreateTaskFromAdDialog({
  open,
  onOpenChange,
  ads,
  days,
  projectId,
}: Props) {
  const isBulk = ads.length > 1;
  const firstAd = ads[0];
  const [summary, setSummary] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const summaryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isBulk) {
      setSummary("Review ad performance");
      setDescription(
        ads
          .map((ad) => buildAdContextDescription(ad, days))
          .join("\n\n---\n\n")
      );
    } else if (firstAd) {
      setSummary(`${firstAd.name || firstAd.meta_ad_id} — review`);
      setDescription(buildAdContextDescription(firstAd, days));
    }
    const frame = requestAnimationFrame(() => {
      summaryRef.current?.focus();
      summaryRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, isBulk, firstAd, ads, days]);

  const canSubmit =
    !!projectId && summary.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !projectId) return;
    setSubmitting(true);
    const toastId = toast.loading(
      isBulk ? `Creating ${ads.length} tasks…` : "Creating task…"
    );
    try {
      const payloads: CreateTaskData[] = isBulk
        ? ads.map((ad) => ({
            project_id: projectId,
            type: DEFAULT_TASK_TYPE,
            summary:
              `${ad.name || ad.meta_ad_id} — review`.slice(0, 250),
            description: buildAdContextDescription(ad, days),
          }))
        : [
            {
              project_id: projectId,
              type: DEFAULT_TASK_TYPE,
              summary: summary.trim().slice(0, 250),
              description: description.trim() || undefined,
            },
          ];

      const results = await Promise.allSettled(
        payloads.map((p) => TaskAPI.createTask(p))
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      toast.dismiss(toastId);
      if (fail === 0) {
        toast.success(
          isBulk ? `Created ${ok} tasks` : "Created task"
        );
        onOpenChange(false);
      } else if (ok === 0) {
        toast.error(
          isBulk ? `Failed to create ${fail} tasks` : "Failed to create task"
        );
      } else {
        toast.error(`Created ${ok} of ${results.length} — ${fail} failed`);
        onOpenChange(false);
      }
    } catch (err) {
      toast.dismiss(toastId);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to create task: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isBulk ? `Create ${ads.length} tasks` : "Create task"}
      subtitle={
        isBulk
          ? "One task per selected ad, pre-filled with that ad's context."
          : "Pre-filled from the selected ad. Edit before submitting."
      }
    >
      {!projectId ? (
        <ProjectGate />
      ) : (
        <div className="space-y-4">
          {!isBulk && firstAd && <AdContextPanel ad={firstAd} />}
          {isBulk && <BulkAdsList ads={ads} />}

          {!isBulk && (
            <>
              <div>
                <label
                  htmlFor="task-summary"
                  className="block text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Summary
                </label>
                <input
                  id="task-summary"
                  ref={summaryRef}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="task-description"
                  className="block text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Description
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="mt-1 w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
            </>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-9 rounded-lg px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting
                ? isBulk
                  ? `Creating ${ads.length}…`
                  : "Creating…"
                : isBulk
                  ? `Create ${ads.length} tasks`
                  : "Create task"}
            </button>
          </div>
        </div>
      )}
    </BrandDialog>
  );
}

function ProjectGate() {
  return (
    <div className="space-y-3">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
        Select a project before creating tasks. Tasks need a project to live in.
      </p>
      <Link
        href="/select-project"
        className="inline-flex h-9 items-center rounded-lg bg-white px-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
      >
        Open project picker
      </Link>
    </div>
  );
}

function AdContextPanel({ ad }: { ad: MetaAdPerformanceRow }) {
  const thumb = thumbnailOrFallback(ad.creative?.thumbnail_url ?? null);
  return (
    <div className="flex gap-3 rounded-md bg-gray-50/60 p-3 ring-1 ring-gray-100">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {thumb ? (
          <img
            src={thumb}
            alt={ad.name || ad.meta_ad_id}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 text-xs text-gray-500">
        <div className="truncate text-sm font-medium text-gray-900">
          {ad.name || ad.meta_ad_id}
        </div>
        <div className="mt-0.5 truncate">
          {ad.campaign_name}
          {ad.adset_name ? ` · ${ad.adset_name}` : ""}
        </div>
        {ad.creative?.meta_creative_id && (
          <div className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
            creative {ad.creative.meta_creative_id}
          </div>
        )}
      </div>
    </div>
  );
}

function BulkAdsList({ ads }: { ads: MetaAdPerformanceRow[] }) {
  return (
    <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/60 p-2">
      {ads.map((ad) => {
        const thumb = thumbnailOrFallback(ad.creative?.thumbnail_url ?? null);
        return (
          <div
            key={ad.id}
            className="flex items-center gap-2 text-xs text-gray-500"
          >
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded border border-gray-200 bg-white">
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>
            <span className="truncate text-gray-700">
              {ad.name || ad.meta_ad_id}
            </span>
          </div>
        );
      })}
    </div>
  );
}
