"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import BrandDialog from "@/components/tasks-v2/detail/BrandDialog";
import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import { getNote, setNote, setNoteBulk } from "./adActions";
import { thumbnailOrFallback } from "./metaAdsUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: number;
  ads: MetaAdPerformanceRow[];
}

export default function AddNoteDialog({
  open,
  onOpenChange,
  adAccountId,
  ads,
}: Props) {
  const isBulk = ads.length > 1;
  const [text, setText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const initialText = useMemo(() => {
    if (!open) return "";
    if (isBulk) return "";
    const ad = ads[0];
    if (!ad) return "";
    return getNote(adAccountId, ad.meta_ad_id);
  }, [open, isBulk, ads, adAccountId]);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, initialText]);

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const trimmed = text.trim();
      const adMetaIds = ads.map((a) => a.meta_ad_id);
      if (isBulk) {
        setNoteBulk(adAccountId, adMetaIds, trimmed);
        if (trimmed === "") {
          toast.success(`Cleared notes on ${ads.length} ads`);
        } else {
          toast.success(`Saved note on ${ads.length} ads`);
        }
      } else {
        const ad = ads[0];
        if (!ad) return;
        setNote(adAccountId, ad.meta_ad_id, trimmed);
        if (trimmed === "") {
          toast.success("Note cleared");
        } else {
          toast.success("Note saved");
        }
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const subtitle = isBulk
    ? `Apply the same note to ${ads.length} selected ads. Empty text clears every note.`
    : "Notes are stored locally in this browser. Empty text clears the note.";

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isBulk ? `Add note to ${ads.length} ads` : "Add note"}
      subtitle={subtitle}
    >
      <div className="space-y-4">
        {isBulk && ads.length > 0 && (
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/60 p-2">
            {ads.map((ad) => {
              const thumb = thumbnailOrFallback(
                ad.creative?.thumbnail_url ?? null
              );
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
        )}

        <div>
          <label
            htmlFor="ad-note-text"
            className="block text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Note
          </label>
          <textarea
            id="ad-note-text"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Add some context for this ad…"
            className="mt-1 w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
          />
        </div>

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
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </BrandDialog>
  );
}
