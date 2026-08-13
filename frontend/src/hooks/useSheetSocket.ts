'use client';

import { useEffect, useMemo, useRef } from 'react';
import { buildWsUrl } from '@/lib/ws';
import { useAuthStore } from '@/lib/authStore';
import { readPersistedAuthState } from '@/lib/api';
import { SpreadsheetAPI, setSheetCollabClientId } from '@/lib/api/spreadsheetApi';
import {
  getSheetRevision,
  setSheetRevision,
  SHEET_REVISION_CONFLICT_EVENT,
} from '@/lib/sheetRevisionStore';
import {
  selectRemotePresenceUsers,
  useSheetSocketStore,
  type SheetPresenceCursor,
  type SheetPresenceUser,
  type SheetWsState,
} from '@/lib/sheetSocketStore';

export type SheetCursorPayload = {
  row: number;
  col: number;
  start_row: number;
  end_row: number;
  start_col: number;
  end_col: number;
  is_active: boolean;
};

/** One committed cell from a cells_updated broadcast (same shape the batch REST response uses). */
export type RemoteCellUpdate = {
  row_position: number;
  column_position: number;
  value_type?: string;
  string_value?: string | null;
  number_value?: number | string | null;
  boolean_value?: boolean | null;
  formula_value?: string | null;
  raw_input?: string | null;
  computed_type?: string | null;
  computed_number?: number | string | null;
  computed_string?: string | null;
  error_code?: string | null;
  is_deleted?: boolean;
  updated_at?: string | null;
};

type Options = {
  /** Committed remote cell changes for this sheet (own echoes already filtered out). */
  onCellsUpdated?: (cells: RemoteCellUpdate[]) => void;
  /**
   * Sheet needs a full reload: a peer ran a structure op (insert/delete/sort/
   * resize/revert), an import finished, or this socket just reconnected after
   * dropping (missed broadcasts are not replayed — reason 'reconnected').
   */
  onRefreshRequired?: (reason: string) => void;
};

type Api = {
  wsState: SheetWsState;
  closeCode: number | null;
  clientId: string;
  remoteUsers: SheetPresenceUser[];
  sendCursorUpdate: (payload: SheetCursorPayload) => boolean;
};

const RECONNECT_BASE_DELAY_MS = 1500;
const RECONNECT_MAX_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const RESUME_RECONNECT_AFTER_MS = 20_000;
const CLIENT_RESUME_CLOSE_CODE = 4000;
const CLIENT_ID_SESSION_KEY = 'sheet-collab-client-id-v1';

function createClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sheet_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return createClientId();
  const clientWindow = window as typeof window & { __sheetCollabClientId?: string };
  if (clientWindow.__sheetCollabClientId) return clientWindow.__sheetCollabClientId;
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_SESSION_KEY)?.trim();
    const navigation = window.performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    // Reuse only for a real reload of this tab. A newly opened/duplicated tab
    // may inherit sessionStorage from its opener and still needs a distinct id.
    const clientId = navigation?.type === 'reload' && existing ? existing : createClientId();
    clientWindow.__sheetCollabClientId = clientId;
    window.sessionStorage.setItem(CLIENT_ID_SESSION_KEY, clientId);
    return clientId;
  } catch {
    const clientId = createClientId();
    clientWindow.__sheetCollabClientId = clientId;
    return clientId;
  }
}

function parseRevision(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export function useSheetSocket(sheetId: number | null | undefined, options?: Options): Api {
  const storeToken = useAuthStore((s) => s.token);
  const storeUserId = useAuthStore((s) => s.user?.id ?? null);
  const persistedAuth = typeof window === 'undefined' ? null : readPersistedAuthState();
  const token = storeToken ?? persistedAuth?.state?.token ?? null;
  const rawLocalUserId = storeUserId ?? persistedAuth?.state?.user?.id ?? null;
  const parsedLocalUserId = rawLocalUserId == null ? null : Number(rawLocalUserId);
  const localUserId =
    parsedLocalUserId != null && Number.isFinite(parsedLocalUserId) ? parsedLocalUserId : null;
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const localUserIdRef = useRef(localUserId);
  localUserIdRef.current = localUserId;
  // Refs so new callback identities never tear down / reopen the socket effect.
  const onCellsUpdatedRef = useRef<Options['onCellsUpdated']>(options?.onCellsUpdated);
  onCellsUpdatedRef.current = options?.onCellsUpdated;
  const onRefreshRequiredRef = useRef<Options['onRefreshRequired']>(options?.onRefreshRequired);
  onRefreshRequiredRef.current = options?.onRefreshRequired;

  const wsState = useSheetSocketStore((s) => s.wsState);
  const closeCode = useSheetSocketStore((s) => s.closeCode);
  const usersByKey = useSheetSocketStore((s) => s.usersByKey);

  const remoteUsers = useMemo(
    () => selectRemotePresenceUsers(usersByKey, localUserId, clientIdRef.current),
    [usersByKey, localUserId]
  );

  useEffect(() => {
    if (!sheetId || !token) {
      useSheetSocketStore.getState().reset();
      return;
    }
    const activeSheetId = sheetId;

    let stopped = false;
    let hadConnection = false;
    let heartbeatTimer: number | null = null;
    let lastHeartbeatAt = Date.now();
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    let resumeReconnectPending = false;
    let connectionAttempt = 0;
    let reconnectFailureCount = 0;
    const createdSockets: WebSocket[] = [];
    setSheetCollabClientId(clientIdRef.current);
    useSheetSocketStore.getState().setSheetId(sheetId);
    useSheetSocketStore.getState().setWsState('connecting');
    useSheetSocketStore.getState().setCloseCode(null);

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const scheduleReconnect = (delayMs: number) => {
      if (stopped) return;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(connect, delayMs);
    };

    const nextReconnectDelay = () => {
      const exponent = Math.min(reconnectFailureCount, 5);
      const delay = Math.min(
        RECONNECT_MAX_DELAY_MS,
        RECONNECT_BASE_DELAY_MS * 2 ** exponent
      );
      reconnectFailureCount += 1;
      // ±25% jitter prevents many tabs from minting tickets in lockstep.
      return Math.round(delay * (0.75 + Math.random() * 0.5));
    };

    const forceResumeReconnect = () => {
      if (stopped || resumeReconnectPending || !hadConnection) return;
      resumeReconnectPending = true;
      connectionAttempt += 1;
      stopHeartbeat();
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      useSheetSocketStore.getState().applySnapshot([]);
      useSheetSocketStore.getState().setWsState('reconnecting');

      const ws = wsRef.current;
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        if (ws.readyState !== WebSocket.CLOSING) {
          try {
            ws.close(CLIENT_RESUME_CLOSE_CODE, 'client_resume');
          } catch {
            // Fall through to a fresh connection if the browser refuses close().
          }
        }
        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
          return;
        }
      }

      wsRef.current = null;
      resumeReconnectPending = false;
      scheduleReconnect(0);
    };

    async function connect() {
      if (stopped) return;
      reconnectTimerRef.current = null;
      const attempt = ++connectionAttempt;
      const prev = useSheetSocketStore.getState().wsState;
      useSheetSocketStore
        .getState()
        .setWsState(prev === 'connected' || prev === 'reconnecting' ? 'reconnecting' : 'connecting');

      let ticket: string;
      try {
        const response = await SpreadsheetAPI.createWebSocketTicket(
          activeSheetId,
          clientIdRef.current
        );
        ticket = response.ticket;
      } catch {
        if (!stopped && attempt === connectionAttempt) {
          useSheetSocketStore.getState().setWsState('reconnecting');
          scheduleReconnect(nextReconnectDelay());
        }
        return;
      }
      if (stopped || attempt !== connectionAttempt) return;
      const url = buildWsUrl(`/ws/spreadsheets/sheets/${sheetId}/`, {
        ticket,
        client_id: clientIdRef.current,
      });
      const ws = new WebSocket(url);
      createdSockets.push(ws);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped) return;
        stopHeartbeat();
        lastHeartbeatAt = Date.now();
        resumeReconnectPending = false;
        reconnectFailureCount = 0;
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const now = Date.now();
            // A long timer gap means the page/OS was suspended. The socket may
            // still report OPEN even though broadcasts and Presence were lost.
            if (now - lastHeartbeatAt >= RESUME_RECONNECT_AFTER_MS) {
              forceResumeReconnect();
              return;
            }
            lastHeartbeatAt = now;
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL_MS);
        useSheetSocketStore.getState().setWsState('connected');
        useSheetSocketStore.getState().setCloseCode(null);
        if (hadConnection) {
          // Broadcasts sent while we were disconnected are gone (no replay);
          // resync by reloading rather than trusting a stale grid.
          onRefreshRequiredRef.current?.('reconnected');
        }
        hadConnection = true;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message || typeof message.type !== 'string') return;
          if (
            message.sheet_id != null &&
            Number(message.sheet_id) !== Number(sheetId)
          ) {
            return;
          }
          const s = useSheetSocketStore.getState();
          if (message.type === 'presence_snapshot') {
            s.applySnapshot(Array.isArray(message.users) ? message.users : []);
          } else if (message.type === 'presence_join') {
            s.applyJoin(message);
          } else if (message.type === 'presence_leave') {
            s.applyLeave(message);
          } else if (message.type === 'cursor_updated') {
            if (
              message.client_id &&
              message.client_id === clientIdRef.current &&
              message.user_id === localUserIdRef.current
            ) {
              return;
            }
            s.applyCursor(message);
          } else if (message.type === 'cells_updated') {
            // Server already suppresses the origin tab's echo; this guard is belt-and-braces.
            if (message.origin_client_id && message.origin_client_id === clientIdRef.current) {
              return;
            }
            const eventRevision = parseRevision(message.revision);
            const currentRevision = getSheetRevision(activeSheetId);
            if (
              eventRevision != null &&
              currentRevision != null &&
              eventRevision < currentRevision
            ) {
              return;
            }
            if (
              eventRevision != null &&
              currentRevision != null &&
              eventRevision > currentRevision
            ) {
              setSheetRevision(activeSheetId, eventRevision);
              onRefreshRequiredRef.current?.('revision_gap');
              return;
            }
            if (eventRevision != null) {
              setSheetRevision(activeSheetId, eventRevision);
            }
            const cells = Array.isArray(message.cells) ? (message.cells as RemoteCellUpdate[]) : [];
            if (cells.length > 0) onCellsUpdatedRef.current?.(cells);
          } else if (message.type === 'sheet_refresh_required') {
            if (message.origin_client_id && message.origin_client_id === clientIdRef.current) {
              return;
            }
            const eventRevision = parseRevision(message.revision);
            const currentRevision = getSheetRevision(activeSheetId);
            if (
              eventRevision != null &&
              currentRevision != null &&
              eventRevision <= currentRevision
            ) {
              return;
            }
            const hasRevisionGap =
              eventRevision != null &&
              currentRevision != null &&
              eventRevision > currentRevision + 1;
            if (eventRevision != null) {
              setSheetRevision(activeSheetId, eventRevision);
            }
            onRefreshRequiredRef.current?.(
              hasRevisionGap
                ? 'revision_gap'
                : typeof message.reason === 'string'
                  ? message.reason
                  : 'unknown'
            );
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = (ev) => {
        stopHeartbeat();
        // Never display users from a dead connection while reconnecting. The
        // next authoritative presence_snapshot repopulates this state.
        useSheetSocketStore.getState().applySnapshot([]);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        useSheetSocketStore.getState().setCloseCode(ev.code);
        const reconnectImmediately = resumeReconnectPending;
        resumeReconnectPending = false;
        if (stopped) {
          useSheetSocketStore.getState().setWsState('closed');
          return;
        }
        if (ev.code === 4001 || ev.code === 4003) {
          useSheetSocketStore.getState().setWsState('closed');
          return;
        }
        useSheetSocketStore.getState().setWsState('reconnecting');
        scheduleReconnect(reconnectImmediately ? 0 : nextReconnectDelay());
      };

      ws.onerror = () => {
        /* onclose will fire */
      };
    }

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        hiddenAt = now;
        return;
      }
      const hiddenFor = hiddenAt == null ? 0 : now - hiddenAt;
      hiddenAt = null;
      if (hiddenFor >= RESUME_RECONNECT_AFTER_MS || now - lastHeartbeatAt >= RESUME_RECONNECT_AFTER_MS) {
        forceResumeReconnect();
      }
    };

    const handleWindowFocus = () => {
      if (Date.now() - lastHeartbeatAt >= RESUME_RECONNECT_AFTER_MS) {
        forceResumeReconnect();
      }
    };

    const handleOnline = () => {
      // A browser can retain OPEN through a network transition even though its
      // TCP path and room membership are no longer usable.
      forceResumeReconnect();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        forceResumeReconnect();
      }
    };

    const handleRevisionConflict = (event: Event) => {
      const detail = (event as CustomEvent<{ sheetId?: number }>).detail;
      if (Number(detail?.sheetId) === Number(sheetId)) {
        onRefreshRequiredRef.current?.('revision_conflict');
      }
    };

    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener(SHEET_REVISION_CONFLICT_EVENT, handleRevisionConflict);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener(SHEET_REVISION_CONFLICT_EVENT, handleRevisionConflict);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      stopHeartbeat();
      createdSockets.forEach((sock) => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      });
      wsRef.current = null;
      setSheetCollabClientId(null);
      useSheetSocketStore.getState().reset();
    };
  }, [sheetId, token]);

  const sendCursorUpdate = (payload: SheetCursorPayload): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(
        JSON.stringify({
          type: 'cursor_update',
          ...payload,
          client_id: clientIdRef.current,
        })
      );
      return true;
    } catch {
      return false;
    }
  };

  return {
    wsState,
    closeCode,
    clientId: clientIdRef.current,
    remoteUsers,
    sendCursorUpdate,
  };
}

export type { SheetPresenceCursor, SheetPresenceUser, SheetWsState };
