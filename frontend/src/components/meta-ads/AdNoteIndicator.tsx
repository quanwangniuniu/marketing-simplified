"use client";

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";

import {
  NOTE_CHANGE_EVENT_NAME,
  getNote,
  type NoteChangeDetail,
} from "./adActions";

interface Props {
  adAccountId: number;
  adMetaId: string;
}

export default function AdNoteIndicator({ adAccountId, adMetaId }: Props) {
  const [hasNote, setHasNote] = useState<boolean>(false);

  useEffect(() => {
    const refresh = () => {
      setHasNote(getNote(adAccountId, adMetaId).length > 0);
    };
    refresh();

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<NoteChangeDetail>).detail;
      if (!detail) return;
      if (detail.adAccountId !== adAccountId) return;
      if (!detail.adMetaIds.includes(adMetaId)) return;
      refresh();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (!event.key.startsWith(`meta-ads:notes:${adAccountId}:${adMetaId}`)) {
        return;
      }
      refresh();
    };

    window.addEventListener(NOTE_CHANGE_EVENT_NAME, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NOTE_CHANGE_EVENT_NAME, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [adAccountId, adMetaId]);

  if (!hasNote) return null;
  return (
    <StickyNote
      aria-label="Note attached"
      className="h-3.5 w-3.5 shrink-0 text-gray-700"
    />
  );
}
