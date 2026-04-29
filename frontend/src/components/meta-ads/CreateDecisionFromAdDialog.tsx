"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import BrandDialog from "@/components/tasks-v2/detail/BrandDialog";
import { DecisionAPI } from "@/lib/api/decisionApi";
import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import { buildAdContextDescription } from "./adActions";
import { thumbnailOrFallback } from "./metaAdsUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ads: MetaAdPerformanceRow[];
  days: number;
  projectId: number | null;
}

export default function CreateDecisionFromAdDialog({
  open,
  onOpenChange,
  ads,
  days,
  projectId,
}: Props) {
  const isBulk = ads.length > 1;
  const firstAd = ads[0];
  const [title, setTitle] = useState<string>("");
  const [contextSummary, setContextSummary] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isBulk) {
      setTitle("Decisions on selected ads");
      setContextSummary(
        ads
          .map((ad) => buildAdContextDescription(ad, days))
          .join("\n\n---\n\n")
      );
    } else if (firstAd) {
      setTitle(`${firstAd.name || firstAd.meta_ad_id} — decision`);
      setContextSummary(buildAdContextDescription(firstAd, days));
    }
    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, isBulk, firstAd, ads, days]);

  const canSubmit = !!projectId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !projectId) return;
    setSubmitting(true);
    const toastId = toast.loading(
      isBulk ? `Creating ${ads.length} decisions…` : "Creating decision…"
    );
    try {
      const tasks = isBulk
        ? ads.map((ad) => ({
            title: `${ad.name || ad.meta_ad_id} — decision`.slice(0, 250),
            contextSummary: buildAdContextDescription(ad, days),
          }))
        : [
            {
              title: title.trim().slice(0, 250),
              contextSummary: contextSummary.trim(),
            },
          ];

      const results = await Promise.allSettled(
        tasks.map(async (payload) => {
          const draft = await DecisionAPI.createDraft(projectId);
          if (!draft.id) {
            throw new Error("createDraft returned no id");
          }
          await DecisionAPI.patchDraft(
            draft.id,
            {
              title: payload.title || null,
              contextSummary: payload.contextSummary || null,
            },
            projectId
          );
          return draft.id;
        })
      );

      const okIds = results
        .filter(
          (r): r is PromiseFulfilledResult<number> => r.status === "fulfilled"
        )
        .map((r) => r.value);
      const fail = results.length - okIds.length;
      toast.dismiss(toastId);

      if (typeof window !== "undefined") {
        for (const id of okIds) {
          window.open(`/decisions/${id}`, "_blank", "noopener");
        }
      }

      if (fail === 0) {
        toast.success(
          isBulk ? `Created ${okIds.length} decisions` : "Created decision"
        );
        onOpenChange(false);
      } else if (okIds.length === 0) {
        toast.error(
          isBulk
            ? `Failed to create ${fail} decisions`
            : "Failed to create decision"
        );
      } else {
        toast.error(
          `Created ${okIds.length} of ${results.length} — ${fail} failed`
        );
        onOpenChange(false);
      }
    } catch (err) {
      toast.dismiss(toastId);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to create decision: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isBulk ? `Create ${ads.length} decisions` : "Create decision"}
      subtitle={
        isBulk
          ? "One draft per selected ad. Each draft opens in a new tab after creation."
          : "Pre-fills a draft with the ad context, then opens it in a new tab."
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
                  htmlFor="decision-title"
                  className="block text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Title
                </label>
                <input
                  id="decision-title"
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="decision-context"
                  className="block text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Context summary
                </label>
                <textarea
                  id="decision-context"
                  value={contextSummary}
                  onChange={(e) => setContextSummary(e.target.value)}
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
                  ? `Create ${ads.length} decisions`
                  : "Create decision"}
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
        Select a project before creating decisions. Decisions need a project to live in.
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
