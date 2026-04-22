'use client';

import { useEffect, useRef, useState } from 'react';
import { buildWsUrl } from '@/lib/ws';
import type { SelectionRect } from './cursorGeometry';

export type WsState = 'connecting' | 'connected' | 'reconnecting' | 'closed';

export type DocumentSnapshotEvent = {
  type: 'document_snapshot';
  meeting_id?: number;
  content: string;
  yjs_state?: string;
  updated_at: string;
};

export type DocumentUpdatedEvent = {
  type: 'document_updated';
  content: string;
  updated_by?: number | string | null;
  updated_at: string;
  client_id?: string;
};

export type CursorUpdatedEvent = {
  type: 'cursor_updated';
  user_id: number | string;
  username?: string;
  x?: number;
  y?: number;
  cursor_offset?: number;
  selection_start?: number | null;
  selection_end?: number | null;
  selection_rects?: SelectionRect[];
  selection_cleared?: boolean;
  is_active?: boolean;
  client_id?: string;
};

export type CursorPayload = {
  x: number;
  y: number;
  cursor_offset: number;
  selection_start: number | null;
  selection_end: number | null;
  selection_rects: SelectionRect[];
  is_active: boolean;
};

type Options = {
  meetingId: number;
  token: string | null;
  clientId: string;
  onSnapshot: (event: DocumentSnapshotEvent) => void;
  onDocumentUpdated: (event: DocumentUpdatedEvent) => void;
  onCursorUpdated: (event: CursorUpdatedEvent) => void;
};

type Api = {
  wsState: WsState;
  closeCode: number | null;
  sendDocumentUpdate: (content: string) => boolean;
  sendCursorUpdate: (payload: CursorPayload) => boolean;
};

const RECONNECT_DELAY_MS = 1500;

export function useDocumentSocket({
  meetingId,
  token,
  clientId,
  onSnapshot,
  onDocumentUpdated,
  onCursorUpdated,
}: Options): Api {
  const [wsState, setWsState] = useState<WsState>('connecting');
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const snapshotRef = useRef(onSnapshot);
  const docUpdatedRef = useRef(onDocumentUpdated);
  const cursorUpdatedRef = useRef(onCursorUpdated);

  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    docUpdatedRef.current = onDocumentUpdated;
  }, [onDocumentUpdated]);
  useEffect(() => {
    cursorUpdatedRef.current = onCursorUpdated;
  }, [onCursorUpdated]);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const createdSockets: WebSocket[] = [];

    const connect = () => {
      if (stopped) return;
      const url = buildWsUrl(`/ws/meetings/${meetingId}/document/`, { token });
      setWsState((prev) => (prev === 'closed' ? 'connecting' : prev === 'connected' ? 'connected' : 'connecting'));
      const ws = new WebSocket(url);
      createdSockets.push(ws);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped) return;
        setWsState('connected');
        setCloseCode(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message || typeof message.type !== 'string') return;
          if (message.type === 'document_snapshot') {
            snapshotRef.current(message as DocumentSnapshotEvent);
          } else if (message.type === 'document_updated') {
            docUpdatedRef.current(message as DocumentUpdatedEvent);
          } else if (message.type === 'cursor_updated') {
            cursorUpdatedRef.current(message as CursorUpdatedEvent);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = (ev) => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setCloseCode(ev.code);
        if (stopped) {
          setWsState('closed');
          return;
        }
        if (ev.code === 4001 || ev.code === 4003) {
          setWsState('closed');
          return;
        }
        setWsState('reconnecting');
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        /* onclose will fire */
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      createdSockets.forEach((s) => {
        try {
          s.close();
        } catch {
          /* ignore */
        }
      });
      wsRef.current = null;
    };
  }, [meetingId, token]);

  const sendDocumentUpdate = (content: string): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(
        JSON.stringify({
          type: 'document_update',
          content,
          client_id: clientId,
        }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const sendCursorUpdate = (payload: CursorPayload): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(
        JSON.stringify({
          type: 'cursor_update',
          ...payload,
          client_id: clientId,
        }),
      );
      return true;
    } catch {
      return false;
    }
  };

  return { wsState, closeCode, sendDocumentUpdate, sendCursorUpdate };
}
