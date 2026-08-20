'use client';

import { useEffect, useRef } from 'react';
import {
  useSheetSocket,
  type RemoteCellUpdate,
  type SheetCursorPayload,
} from '@/hooks/useSheetSocket';
import type { SheetPresenceUser } from '@/lib/sheetSocketStore';

export type SheetSelectionPayload = {
  row: number;
  col: number;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} | null;

type Api = {
  remoteUsers: SheetPresenceUser[];
  onSelectionChange: (selection: SheetSelectionPayload) => void;
  /** This tab's WS client id; pass to cell-save calls so the server can drop our echo. */
  clientId: string;
};

type Options = {
  /** Committed remote cell changes (own echoes filtered). */
  onCellsUpdated?: (cells: RemoteCellUpdate[]) => void;
  /** Peer structure op / import finished / reconnected: reload the sheet. */
  onRefreshRequired?: (reason: string) => void;
};

const CURSOR_THROTTLE_MS = 40;

/**
 * Connects the active sheet room and throttles selection → cursor_update broadcasts.
 */
export function useSheetPresenceBridge(sheetId: number | null | undefined, options?: Options): Api {
  const { remoteUsers, sendCursorUpdate, clientId } = useSheetSocket(sheetId, {
    onCellsUpdated: options?.onCellsUpdated,
    onRefreshRequired: options?.onRefreshRequired,
  });
  const lastSentRef = useRef(0);
  const pendingRef = useRef<SheetCursorPayload | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const flush = () => {
    timerRef.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    lastSentRef.current = Date.now();
    sendCursorUpdate(pending);
  };

  const onSelectionChange = (selection: SheetSelectionPayload) => {
    const payload: SheetCursorPayload = selection
      ? {
          row: selection.row,
          col: selection.col,
          start_row: selection.startRow,
          end_row: selection.endRow,
          start_col: selection.startCol,
          end_col: selection.endCol,
          is_active: true,
        }
      : {
          row: -1,
          col: -1,
          start_row: -1,
          end_row: -1,
          start_col: -1,
          end_col: -1,
          is_active: false,
        };

    const now = Date.now();
    const elapsed = now - lastSentRef.current;
    if (elapsed >= CURSOR_THROTTLE_MS) {
      pendingRef.current = null;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastSentRef.current = now;
      sendCursorUpdate(payload);
      return;
    }

    pendingRef.current = payload;
    if (!timerRef.current) {
      timerRef.current = window.setTimeout(flush, CURSOR_THROTTLE_MS - elapsed);
    }
  };

  return { remoteUsers, onSelectionChange, clientId };
}
