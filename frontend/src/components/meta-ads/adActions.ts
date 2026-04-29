import { facebookApi } from "@/lib/api/facebookApi";
import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";

const NOTE_KEY_PREFIX = "meta-ads:notes";
const NOTE_CHANGE_EVENT = "meta-ads:note-changed";

export interface AdActionContext {
  ad: MetaAdPerformanceRow;
  adAccountId: number;
  days: number;
  currency: string;
  projectId: number | null;
}

export interface BulkAdActionContext {
  ads: MetaAdPerformanceRow[];
  adAccountId: number;
  days: number;
  currency: string;
  projectId: number | null;
}

export interface CsvExportBundle {
  blob: Blob;
  filename: string;
}

export interface NoteChangeDetail {
  adAccountId: number;
  adMetaIds: string[];
}

function noteKey(adAccountId: number, adMetaId: string): string {
  return `${NOTE_KEY_PREFIX}:${adAccountId}:${adMetaId}`;
}

export function getNote(adAccountId: number, adMetaId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(noteKey(adAccountId, adMetaId)) ?? "";
  } catch {
    return "";
  }
}

export function setNote(
  adAccountId: number,
  adMetaId: string,
  text: string
): void {
  if (typeof window === "undefined") return;
  const key = noteKey(adAccountId, adMetaId);
  const trimmed = text.trim();
  try {
    if (trimmed === "") {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, trimmed);
    }
  } catch {
    return;
  }
  emitNoteChange({ adAccountId, adMetaIds: [adMetaId] });
}

export function setNoteBulk(
  adAccountId: number,
  adMetaIds: string[],
  text: string
): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  for (const adMetaId of adMetaIds) {
    const key = noteKey(adAccountId, adMetaId);
    try {
      if (trimmed === "") {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, trimmed);
      }
    } catch {
      // Quota exceeded or storage disabled — best-effort only.
      continue;
    }
  }
  emitNoteChange({ adAccountId, adMetaIds });
}

function emitNoteChange(detail: NoteChangeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTE_CHANGE_EVENT, { detail }));
}

export const NOTE_CHANGE_EVENT_NAME = NOTE_CHANGE_EVENT;

export async function triggerCsvExport(args: {
  adAccountId: number;
  days: number;
  ids?: number[];
}): Promise<void> {
  const filters = args.ids && args.ids.length > 0 ? { ids: args.ids } : undefined;
  const { blob, filename } = await facebookApi.getMetaAdExportCsv(
    args.adAccountId,
    args.days,
    filters
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function buildAdContextDescription(
  ad: MetaAdPerformanceRow,
  days: number
): string {
  const lines: string[] = [];
  lines.push(`Ad: ${ad.name || ad.meta_ad_id}`);
  if (ad.campaign_name) lines.push(`Campaign: ${ad.campaign_name}`);
  if (ad.adset_name) lines.push(`Ad set: ${ad.adset_name}`);
  if (ad.creative?.meta_creative_id) {
    lines.push(`Creative: ${ad.creative.meta_creative_id}`);
  }
  lines.push(`Window: last ${days} days`);
  return lines.join("\n");
}
