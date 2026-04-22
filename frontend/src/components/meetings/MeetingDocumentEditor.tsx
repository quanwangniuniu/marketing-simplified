'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Bold, Italic, Underline, List, ListOrdered, Quote, Undo2, Redo2, Heading1, Heading2 } from 'lucide-react';

import { MeetingsAPI } from '@/lib/api/meetingsApi';
import { buildWsUrl } from '@/lib/ws';
import { useAuthStore } from '@/lib/authStore';
import type { MeetingDocument } from '@/types/meeting';
import { Button } from '@/components/ui/button';

type Props = {
  projectId: number;
  meetingId: number;
};

type DocumentWsEvent = {
  type: string;
  content?: string;
  updated_at?: string;
  client_id?: string;
  user_id?: number;
  username?: string;
  x?: number;
  y?: number;
  cursor_offset?: number;
  selection_start?: number;
  selection_end?: number;
  selection_rects?: Array<{ left: number; top: number; width: number; height: number }>;
  is_active?: boolean;
};

type RemoteCursor = {
  presenceKey: string;
  userId: number;
  username: string;
  x: number;
  y: number;
  cursorOffset?: number;
  selectionStart?: number;
  selectionEnd?: number;
  selectionRects?: Array<{ left: number; top: number; width: number; height: number }>;
  color: string;
};

const WS_SYNC_DEBOUNCE_MS = 20;
const HTTP_FALLBACK_DEBOUNCE_MS = 500;
const CURSOR_BROADCAST_DEBOUNCE_MS = 25;
const CURSOR_HEARTBEAT_MS = 600;
const CURSOR_TTL_MS = 45000;

function remotePresenceKey(userId: number): string {
  return `u:${userId}`;
}

function getCaretClientRect(collapsedRange: Range, editor: HTMLDivElement): { left: number; top: number; height: number } | null {
  const r = collapsedRange.cloneRange();
  r.collapse(true);

  const rawRects = Array.from(r.getClientRects());
  const lineRects = rawRects.filter((cr) => cr.height > 0);
  if (lineRects.length >= 2) {
    const topmost = lineRects.reduce((a, b) => (a.top <= b.top ? a : b));
    return { left: topmost.left, top: topmost.top, height: topmost.height };
  }
  if (lineRects.length === 1) {
    const c = lineRects[0]!;
    return { left: c.left, top: c.top, height: c.height };
  }

  const br = r.getBoundingClientRect();
  const maxH = Math.max(editor.clientHeight * 0.5, 24);
  if (br.height > 0 && br.height <= maxH) {
    return { left: br.left, top: br.top, height: br.height };
  }

  const { startContainer, startOffset } = r;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    const tn = startContainer as Text;
    const text = tn.textContent ?? '';
    const expand = r.cloneRange();
    if (startOffset < text.length) {
      expand.setEnd(tn, startOffset + 1);
      const ers = Array.from(expand.getClientRects()).filter((cr) => cr.height > 0);
      if (ers.length > 0) {
        const lr = ers[ers.length - 1]!;
        return { left: lr.left, top: lr.top, height: lr.height };
      }
    }
    if (startOffset > 0) {
      expand.setStart(tn, startOffset - 1);
      expand.setEnd(tn, startOffset);
      const ers = Array.from(expand.getClientRects()).filter((cr) => cr.height > 0);
      if (ers.length > 0) {
        const lr = ers[ers.length - 1]!;
        return { left: lr.right, top: lr.top, height: lr.height };
      }
    }
  }

  if (br.height > 0) {
    return { left: br.left, top: br.top, height: br.height };
  }
  return null;
}

function clientPointToEditorOverlay(editor: HTMLDivElement, clientX: number, clientY: number) {
  const editorRect = editor.getBoundingClientRect();
  return {
    x: clientX - editorRect.left,
    y: clientY - editorRect.top,
  };
}

function getTotalPlainTextLength(editor: HTMLDivElement): number {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let total = 0;
  let n = walker.nextNode();
  while (n) {
    total += (n.textContent ?? '').length;
    n = walker.nextNode();
  }
  return total;
}

function getEditorPlainText(editor: HTMLDivElement): string {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let n = walker.nextNode();
  while (n) {
    parts.push(n.textContent ?? '');
    n = walker.nextNode();
  }
  return parts.join('');
}

function computeOffsetTransform(oldPlain: string, newPlain: string): (offset: number) => number {
  if (oldPlain === newPlain) return (o) => o;

  let prefixLen = 0;
  const minLen = Math.min(oldPlain.length, newPlain.length);
  while (prefixLen < minLen && oldPlain[prefixLen] === newPlain[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldPlain[oldPlain.length - 1 - suffixLen] === newPlain[newPlain.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldEditEnd = oldPlain.length - suffixLen;
  const newEditEnd = newPlain.length - suffixLen;
  const delta = newEditEnd - oldEditEnd;

  return (offset: number): number => {
    // fix: < instead of <=, so cursors exactly at the edit position are also pushed forward
    if (offset < prefixLen) return offset;
    if (offset >= oldEditEnd) return offset + delta;
    return newEditEnd;
  };
}

function getPlainTextOffsetBeforePosition(editor: HTMLDivElement, container: Node, offset: number): number {
  const endPoint = document.createRange();
  try {
    endPoint.setStart(container, offset);
    endPoint.collapse(true);
  } catch {
    return 0;
  }

  let total = 0;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode() as Text | null;

  while (textNode) {
    const len = (textNode.textContent ?? '').length;
    const nodeStart = document.createRange();
    nodeStart.setStart(textNode, 0);
    nodeStart.collapse(true);
    const nodeEnd = document.createRange();
    nodeEnd.setStart(textNode, len);
    nodeEnd.collapse(true);

    if (endPoint.compareBoundaryPoints(Range.START_TO_START, nodeEnd) > 0) {
      total += len;
      textNode = walker.nextNode() as Text | null;
      continue;
    }

    if (endPoint.compareBoundaryPoints(Range.START_TO_START, nodeStart) <= 0) {
      break;
    }

    if (container === textNode) {
      total += Math.max(0, Math.min(offset, len));
      break;
    }

    const measure = document.createRange();
    measure.setStart(textNode, 0);
    measure.setEnd(container, offset);
    total += measure.toString().length;
    break;
  }

  return total;
}

function resolveTextNodeAtOffset(editor: HTMLDivElement, targetOffset: number): { node: Node; offset: number } | null {
  const target = Math.max(0, targetOffset);
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let textNode = walker.nextNode();

  while (textNode) {
    const text = textNode.textContent ?? '';
    const nextConsumed = consumed + text.length;
    if (target <= nextConsumed) {
      return { node: textNode, offset: Math.max(0, Math.min(target - consumed, text.length)) };
    }
    consumed = nextConsumed;
    textNode = walker.nextNode();
  }

  if (editor.lastChild) {
    const fallbackOffset =
      editor.lastChild.nodeType === Node.TEXT_NODE
        ? (editor.lastChild.textContent ?? '').length
        : editor.lastChild.childNodes.length;
    return { node: editor.lastChild, offset: fallbackOffset };
  }

  return { node: editor, offset: 0 };
}

type PlainTextSelectionState = { anchor: number; focus: number };

function getPlainTextSelectionState(editor: HTMLDivElement): PlainTextSelectionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  if (!sel.anchorNode || !sel.focusNode) return null;
  if (!editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)) return null;
  try {
    const anchor = getPlainTextOffsetBeforePosition(editor, sel.anchorNode, sel.anchorOffset);
    const focus = getPlainTextOffsetBeforePosition(editor, sel.focusNode, sel.focusOffset);
    return { anchor, focus };
  } catch {
    return null;
  }
}

function restorePlainTextSelectionState(editor: HTMLDivElement, state: PlainTextSelectionState): void {
  const sel = window.getSelection();
  if (!sel) return;
  const total = getTotalPlainTextLength(editor);
  const clamp = (n: number) => Math.max(0, Math.min(n, total));
  const a = clamp(state.anchor);
  const f = clamp(state.focus);
  const start = Math.min(a, f);
  const end = Math.max(a, f);
  const startPos = resolveTextNodeAtOffset(editor, start);
  const endPos = resolveTextNodeAtOffset(editor, end);
  if (!startPos || !endPos) return;
  const range = document.createRange();
  try {
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // ignore
  }
}

function parseWsFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseWsUserId(value: unknown): number | null {
  const n = parseWsFiniteNumber(value);
  if (n === null || !Number.isInteger(n) || n < 1) return null;
  return n;
}

function parseWsOptionalInt(value: unknown): number | null {
  const n = parseWsFiniteNumber(value);
  if (n === null) return null;
  const r = Math.round(n);
  if (Math.abs(n - r) > 1e-9) return null;
  return r;
}

function cursorColorForUser(userId: number, presenceKey: string): string {
  let hash = userId >>> 0;
  for (let i = 0; i < presenceKey.length; i += 1) {
    hash = (hash * 31 + presenceKey.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const sat = 58 + (hash % 22);
  const light = 40 + (hash % 12);
  return hslToHex(hue, sat, light);
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const sf = Math.max(0, Math.min(100, s)) / 100;
  const lf = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lf - 1)) * sf;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = lf - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(255, (v + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function selectionHighlightBackground(hexColor: string): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hexColor.trim());
  if (!m) return `${hexColor}33`;
  const rr = parseInt(m[1], 16);
  const gg = parseInt(m[2], 16);
  const bb = parseInt(m[3], 16);
  return `rgba(${rr},${gg},${bb},0.2)`;
}

function isNodeInsideEditor(editor: HTMLDivElement, n: Node | null): boolean {
  return Boolean(n && (n === editor || editor.contains(n)));
}

function ensureSelectionAnchoredInEditor(editor: HTMLDivElement): void {
  if (document.activeElement !== editor) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount > 0 && isNodeInsideEditor(editor, sel.anchorNode)) return;

  const total = getTotalPlainTextLength(editor);
  const pos = resolveTextNodeAtOffset(editor, total);
  try {
    if (pos) {
      const range = document.createRange();
      range.setStart(pos.node, pos.offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    try { editor.focus(); } catch { /* ignore */ }
  }
}

type LastOutgoingCursor = {
  offset: number;
  x: number;
  y: number;
  selectionStart?: number;
  selectionEnd?: number;
  selectionRects: Array<{ left: number; top: number; width: number; height: number }>;
};

export function MeetingDocumentEditor({ projectId, meetingId }: Props) {
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastSyncedAtRef = useRef<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const httpPersistTimerRef = useRef<number | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const cursorHeartbeatTimerRef = useRef<number | null>(null);
  const latestContentRef = useRef('');
  const clientIdRef = useRef(`doc-${meetingId}-${Math.random().toString(36).slice(2, 10)}`);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isUnmountedRef = useRef(false);
  const cursorSeenAtRef = useRef<Record<string, number>>({});
  const [scrollLayoutTick, setScrollLayoutTick] = useState(0);
  const sendCursorUpdateRef = useRef<(isActive?: boolean) => void>(() => {});
  const lastOutgoingCursorRef = useRef<LastOutgoingCursor | null>(null);
  const remoteCaretLayoutCacheRef = useRef<Record<number, { left: number; top: number }>>({});
  const suppressContentSyncRef = useRef(false);
  const localContentChangeRef = useRef(false);
  const connectedRef = useRef(false);

  const wsPath = useMemo(() => `/ws/meetings/${meetingId}/document/`, [meetingId]);

  const bumpRemoteCursorOverlay = () => {
    queueMicrotask(() => setScrollLayoutTick((t) => t + 1));
    requestAnimationFrame(() => setScrollLayoutTick((t) => t + 1));
  };

  useEffect(() => { lastSyncedAtRef.current = lastSyncedAt; }, [lastSyncedAt]);
  useEffect(() => { latestContentRef.current = content; }, [content]);

  const applyRemoteContent = (next: string) => {
    if (next === latestContentRef.current) return;

    const editor = editorRef.current;
    const preserveSelection = editor !== null && document.activeElement === editor;
    const saved = preserveSelection ? getPlainTextSelectionState(editor) : null;
    const oldPlain = editor ? getEditorPlainText(editor) : '';

    latestContentRef.current = next;
    setContent(next);

    if (editor && editor.innerHTML !== next) {
      suppressContentSyncRef.current = true;
      editor.innerHTML = next;

      let transform: (offset: number) => number = (o) => o;
      try {
        const newPlain = getEditorPlainText(editor);
        transform = computeOffsetTransform(oldPlain, newPlain);
      } catch { /* identity */ }

      setRemoteCursors((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        const adjusted: Record<string, RemoteCursor> = {};
        for (const [key, cursor] of Object.entries(prev)) {
          adjusted[key] = {
            ...cursor,
            cursorOffset: typeof cursor.cursorOffset === 'number' ? transform(cursor.cursorOffset) : cursor.cursorOffset,
            selectionStart: typeof cursor.selectionStart === 'number' ? transform(cursor.selectionStart) : cursor.selectionStart,
            selectionEnd: typeof cursor.selectionEnd === 'number' ? transform(cursor.selectionEnd) : cursor.selectionEnd,
          };
        }
        return adjusted;
      });

      const lastOut = lastOutgoingCursorRef.current;
      if (lastOut) {
        lastOutgoingCursorRef.current = {
          ...lastOut,
          offset: transform(lastOut.offset),
          selectionStart: typeof lastOut.selectionStart === 'number' ? transform(lastOut.selectionStart) : lastOut.selectionStart,
          selectionEnd: typeof lastOut.selectionEnd === 'number' ? transform(lastOut.selectionEnd) : lastOut.selectionEnd,
          selectionRects: [],
        };
      }

      remoteCaretLayoutCacheRef.current = {};
      bumpRemoteCursorOverlay();

      if (saved) {
        const adjustedSaved: PlainTextSelectionState = {
          anchor: transform(saved.anchor),
          focus: transform(saved.focus),
        };
        requestAnimationFrame(() => {
          if (editorRef.current !== editor) return;
          restorePlainTextSelectionState(editor, adjustedSaved);
          editor.focus();
          requestAnimationFrame(() => {
            ensureSelectionAnchoredInEditor(editor);
            sendCursorUpdateRef.current(true);
            bumpRemoteCursorOverlay();
          });
        });
      }
    }
  };

  const isIncomingNewer = (incoming?: string | null, current?: string | null) => {
    if (!incoming) return false;
    if (!current) return true;
    const i = new Date(incoming).getTime();
    const c = new Date(current).getTime();
    if (!Number.isFinite(i) || !Number.isFinite(c)) return incoming !== current;
    return i > c;
  };

  useEffect(() => {
    if (suppressContentSyncRef.current) { suppressContentSyncRef.current = false; return; }
    if (localContentChangeRef.current) { localContentChangeRef.current = false; return; }
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML === content) return;
    const preserveSelection = document.activeElement === editor;
    const saved = preserveSelection ? getPlainTextSelectionState(editor) : null;
    remoteCaretLayoutCacheRef.current = {};
    editor.innerHTML = content || '';
    bumpRemoteCursorOverlay();
    if (saved) {
      requestAnimationFrame(() => {
        if (editorRef.current !== editor) return;
        restorePlainTextSelectionState(editor, saved);
        editor.focus();
        requestAnimationFrame(() => {
          ensureSelectionAnchoredInEditor(editor);
          sendCursorUpdateRef.current(true);
          bumpRemoteCursorOverlay();
        });
      });
    }
  }, [content]);

  useEffect(() => {
    if (loading) return;
    const editor = editorRef.current;
    if (!editor) return;
    const pending = latestContentRef.current;
    if (!pending || editor.innerHTML === pending) return;
    editor.innerHTML = pending;
    bumpRemoteCursorOverlay();
    requestAnimationFrame(() => { sendCursorUpdateRef.current(true); });
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    if (!hasHydrated) return;
    if (!token) { setLoading(false); return; }

    const fetchData = async () => {
      try {
        const doc: MeetingDocument = await MeetingsAPI.getMeetingDocument(projectId, meetingId);
        if (cancelled) return;
        applyRemoteContent(doc.content ?? '');
        setLastSyncedAt(doc.updated_at ?? null);
        setLoading(false);
        return;
      } catch { /* retry */ }

      try {
        const doc: MeetingDocument = await MeetingsAPI.getMeetingDocument(projectId, meetingId);
        if (cancelled) return;
        applyRemoteContent(doc.content ?? '');
        setLastSyncedAt(doc.updated_at ?? null);
      } catch {
        if (!cancelled) toast.error('Failed to load meeting document');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [projectId, meetingId, hasHydrated, token]);

  useEffect(() => {
    let stopped = false;
    const createdSockets: WebSocket[] = [];

    const connect = () => {
      if (stopped) return;
      const wsUrl = buildWsUrl(wsPath, token ? { token } : undefined);
      const ws = new WebSocket(wsUrl);
      createdSockets.push(ws);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        connectedRef.current = true;
        window.setTimeout(() => sendCursorUpdateRef.current(true), 0);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as DocumentWsEvent;
          if (message.type === 'document_snapshot' || message.type === 'document_updated') {
            if (message.client_id && message.client_id === clientIdRef.current) return;
            if (!isIncomingNewer(message.updated_at, lastSyncedAtRef.current)) return;
            if (typeof message.content === 'string') {
              applyRemoteContent(message.content);
            }
            if (message.updated_at) {
              lastSyncedAtRef.current = message.updated_at;
              setLastSyncedAt(message.updated_at);
            }
          }
          if (message.type === 'cursor_updated') {
            if (message.client_id === clientIdRef.current) return;
            const wsUserId = parseWsUserId(message.user_id);
            if (wsUserId === null) return;
            if (message.is_active === false) {
              const uid = wsUserId;
              delete remoteCaretLayoutCacheRef.current[uid];
              setRemoteCursors((prev) => {
                const next = { ...prev };
                for (const pk of Object.keys(next)) {
                  if (next[pk]?.userId === uid) {
                    delete cursorSeenAtRef.current[pk];
                    delete next[pk];
                  }
                }
                return next;
              });
              return;
            }
            const xParsed = parseWsFiniteNumber(message.x);
            const yParsed = parseWsFiniteNumber(message.y);
            const offsetParsed = parseWsOptionalInt(message.cursor_offset);
            const xOk = xParsed !== null;
            const yOk = yParsed !== null;
            const offsetOk = offsetParsed !== null;
            if (!offsetOk && !xOk && !yOk) return;
            const x = xOk ? xParsed! : 0;
            const y = yOk ? yParsed! : 0;
            const userId = wsUserId;
            const presenceKey = remotePresenceKey(userId);
            const rectNum = (v: unknown) => parseWsFiniteNumber(v);
            const incomingSelectionRects = Array.isArray(message.selection_rects)
              ? message.selection_rects
                  .map((r) => {
                    if (!r || typeof r !== 'object') return null;
                    const o = r as Record<string, unknown>;
                    const left = rectNum(o.left);
                    const top = rectNum(o.top);
                    const width = rectNum(o.width);
                    const height = rectNum(o.height);
                    if (left === null || top === null || width === null || height === null) return null;
                    return { left, top, width, height };
                  })
                  .filter((r): r is { left: number; top: number; width: number; height: number } => r !== null)
              : [];
            const incomingSelectionStart = parseWsOptionalInt(message.selection_start) ?? undefined;
            const incomingSelectionEnd = parseWsOptionalInt(message.selection_end) ?? undefined;
            const hasNumericRange =
              typeof incomingSelectionStart === 'number' &&
              typeof incomingSelectionEnd === 'number' &&
              incomingSelectionEnd > incomingSelectionStart;
            const rectsEmpty = incomingSelectionRects.length === 0;
            const collapsedOffsets =
              typeof incomingSelectionStart === 'number' &&
              typeof incomingSelectionEnd === 'number' &&
              incomingSelectionStart === incomingSelectionEnd;
            const peerHasNoSelection = rectsEmpty && (collapsedOffsets || !hasNumericRange);
            let storedSelectionStart: number | undefined;
            let storedSelectionEnd: number | undefined;
            let storedSelectionRects: typeof incomingSelectionRects;
            if (peerHasNoSelection) {
              storedSelectionStart = undefined;
              storedSelectionEnd = undefined;
              storedSelectionRects = [];
            } else if (hasNumericRange) {
              storedSelectionStart = incomingSelectionStart;
              storedSelectionEnd = incomingSelectionEnd;
              storedSelectionRects = incomingSelectionRects;
            } else {
              storedSelectionStart = undefined;
              storedSelectionEnd = undefined;
              storedSelectionRects = incomingSelectionRects;
            }
            cursorSeenAtRef.current[presenceKey] = Date.now();
            setRemoteCursors((prev) => {
              const next: Record<string, RemoteCursor> = { ...prev };
              for (const pk of Object.keys(next)) {
                if (next[pk]?.userId === userId && pk !== presenceKey) {
                  delete cursorSeenAtRef.current[pk];
                  delete next[pk];
                }
              }
              const existing = next[presenceKey];
              const mergedOffset = offsetOk ? offsetParsed! : existing?.cursorOffset;
              const mergedX = xOk ? xParsed! : (existing?.x ?? x);
              const mergedY = yOk ? yParsed! : (existing?.y ?? y);
              const mergedUsername =
                (typeof message.username === 'string' && message.username.trim()) || existing?.username || `User ${userId}`;
              next[presenceKey] = {
                presenceKey,
                userId,
                username: mergedUsername,
                x: mergedX,
                y: mergedY,
                cursorOffset: mergedOffset,
                selectionStart: storedSelectionStart,
                selectionEnd: storedSelectionEnd,
                selectionRects: storedSelectionRects,
                color: cursorColorForUser(userId, presenceKey),
              };
              return next;
            });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        connectedRef.current = false;
        // fix: only clear if the closed ws is the one stored in the ref
        // in React Strict Mode, the first WS close event after mounting may trigger after the second mount establishes a new connection
        // if we set it to null unconditionally, it will also clear the second connection
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!stopped) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500);
        }
      };
    };

    // track all WS instances created by this effect (including reconnects) - createdSockets is defined at the top of the effect
    connect();
    return () => {
      stopped = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      // close all WS instances created by this effect
      createdSockets.forEach((s) => {
        try { s.close(); } catch { /* ignore */ }
      });
    };
  }, [wsPath, token]);

  useEffect(() => {
    if (!connected || loading) return;
    const id = window.setTimeout(() => sendCursorUpdateRef.current(true), 0);
    return () => window.clearTimeout(id);
  }, [connected, loading]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (httpPersistTimerRef.current) window.clearTimeout(httpPersistTimerRef.current);
      if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      if (cursorHeartbeatTimerRef.current) window.clearInterval(cursorHeartbeatTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    const POLL_INTERVAL_WS = 8000;
    const POLL_INTERVAL_NO_WS = 2000;
    const poll = async () => {
      try {
        const doc = await MeetingsAPI.getMeetingDocument(projectId, meetingId);
        if (isUnmountedRef.current) return;
        const incomingUpdatedAt = doc.updated_at ?? '';
        const currentUpdatedAt = lastSyncedAtRef.current ?? '';
        if (!incomingUpdatedAt || incomingUpdatedAt === currentUpdatedAt) return;
        if (!isIncomingNewer(incomingUpdatedAt, currentUpdatedAt)) return;
        applyRemoteContent(doc.content ?? '');
        lastSyncedAtRef.current = incomingUpdatedAt;
        setLastSyncedAt(incomingUpdatedAt);
      } catch { /* silent */ }
    };
    const scheduleNext = () => {
      if (isUnmountedRef.current) return;
      const interval = connectedRef.current ? POLL_INTERVAL_WS : POLL_INTERVAL_NO_WS;
      pollingTimerRef.current = window.setTimeout(() => { void poll().finally(scheduleNext); }, interval);
    };
    scheduleNext();
    return () => { if (pollingTimerRef.current) { window.clearTimeout(pollingTimerRef.current); pollingTimerRef.current = null; } };
  }, [projectId, meetingId, hasHydrated, token]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => { sendCursorUpdateRef.current(true); }, CURSOR_BROADCAST_DEBOUNCE_MS);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => { document.removeEventListener('selectionchange', onSelectionChange); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        const next: Record<string, RemoteCursor> = {};
        let changed = false;
        for (const [key, cursor] of Object.entries(prev)) {
          const seenAt = cursorSeenAtRef.current[key] ?? 0;
          if (now - seenAt <= CURSOR_TTL_MS) { next[key] = cursor; }
          else { changed = true; delete cursorSeenAtRef.current[key]; }
        }
        return changed ? next : prev;
      });
    }, 600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cursorHeartbeatTimerRef.current) window.clearInterval(cursorHeartbeatTimerRef.current);
    cursorHeartbeatTimerRef.current = window.setInterval(() => {
      if (!editorRef.current) return;
      sendCursorUpdateRef.current(true);
    }, CURSOR_HEARTBEAT_MS);
    return () => {
      if (cursorHeartbeatTimerRef.current) { window.clearInterval(cursorHeartbeatTimerRef.current); cursorHeartbeatTimerRef.current = null; }
    };
  }, []);

  const persistViaHttp = async (nextContent: string) => {
    setSaving(true);
    try {
      const response = await MeetingsAPI.saveMeetingDocument(projectId, meetingId, { content: nextContent });
      setLastSyncedAt(response.updated_at ?? null);
    } catch { toast.error('Failed to save meeting document'); }
    finally { setSaving(false); }
  };

  const scheduleSave = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (httpPersistTimerRef.current) window.clearTimeout(httpPersistTimerRef.current);
        ws.send(JSON.stringify({ type: 'document_update', content: latestContentRef.current, client_id: clientIdRef.current }));
        sendCursorUpdateRef.current(true);
        httpPersistTimerRef.current = window.setTimeout(() => { void persistViaHttp(latestContentRef.current); }, HTTP_FALLBACK_DEBOUNCE_MS);
      } else {
        if (httpPersistTimerRef.current) window.clearTimeout(httpPersistTimerRef.current);
        httpPersistTimerRef.current = window.setTimeout(() => { void persistViaHttp(latestContentRef.current); }, HTTP_FALLBACK_DEBOUNCE_MS);
      }
    }, WS_SYNC_DEBOUNCE_MS);
  };

  const sendCursorUpdate = (isActive = true) => {
    const ws = wsRef.current;
    const editor = editorRef.current;
    
    
    if (!ws || ws.readyState !== WebSocket.OPEN || !editor) return;

    const selection = window.getSelection();
    let anchorInEditor = Boolean(selection && selection.rangeCount > 0 && isNodeInsideEditor(editor, selection.anchorNode));
    if (document.activeElement === editor && !anchorInEditor) {
      ensureSelectionAnchoredInEditor(editor);
      const sel2 = window.getSelection();
      anchorInEditor = Boolean(sel2 && sel2.rangeCount > 0 && isNodeInsideEditor(editor, sel2.anchorNode));
    }

    
    let x = 8 + editor.scrollLeft;
    let y = 8 + editor.scrollTop;
    let cursorOffset = 0;
    let selectionOffsets: { start: number; end: number } | null = null;
    let selectionRects: Array<{ left: number; top: number; width: number; height: number }> = [];

    if (anchorInEditor) {
      const range = selection!.getRangeAt(0).cloneRange();
      range.collapse(true);
      const caret = getCaretClientRect(range, editor);
      if (caret) {
        const pos = clientPointToEditorOverlay(editor, caret.left, caret.top);
        x = pos.x;
        y = pos.y;
      }
      cursorOffset = getPlainTextOffsetBeforePosition(editor, range.endContainer, range.endOffset);
      selectionOffsets = getSelectionOffsets(editor);
      selectionRects = getLiveSelectionRects(editor);
      const collapsed = !selectionOffsets || selectionOffsets.start === selectionOffsets.end;
      lastOutgoingCursorRef.current = {
        offset: cursorOffset, x, y,
        selectionStart: collapsed ? undefined : selectionOffsets?.start,
        selectionEnd: collapsed ? undefined : selectionOffsets?.end,
        selectionRects: collapsed ? [] : selectionRects,
      };
    } else {
      const last = lastOutgoingCursorRef.current;
      if (last) {
        cursorOffset = last.offset;
        const fromOffset = getCursorXYFromOffset(editor, last.offset);
        if (fromOffset) { x = fromOffset.x; y = fromOffset.y; }
        else { x = last.x; y = last.y; }
        if (typeof last.selectionStart === 'number' && typeof last.selectionEnd === 'number' && last.selectionEnd > last.selectionStart) {
          selectionOffsets = { start: last.selectionStart, end: last.selectionEnd };
          selectionRects = getSelectionRects(editor, last.selectionStart, last.selectionEnd);
          if (selectionRects.length === 0 && last.selectionRects.length > 0) selectionRects = last.selectionRects;
        }
      }
    }

    ws.send(JSON.stringify({
      type: 'cursor_update', x, y, cursor_offset: cursorOffset,
      selection_start: selectionOffsets?.start ?? null, selection_end: selectionOffsets?.end ?? null,
      selection_rects: selectionRects, is_active: isActive, client_id: clientIdRef.current,
    }));
  };

  sendCursorUpdateRef.current = sendCursorUpdate;

  const getSelectionOffsets = (editor: HTMLDivElement): { start: number; end: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    if (!isNodeInsideEditor(editor, selection.anchorNode) || !isNodeInsideEditor(editor, selection.focusNode)) return null;
    const range = selection.getRangeAt(0).cloneRange();
    const startRange = range.cloneRange(); startRange.collapse(true);
    const endRange = range.cloneRange(); endRange.collapse(false);
    const start = getPlainTextOffsetBeforePosition(editor, startRange.endContainer, startRange.endOffset);
    const end = getPlainTextOffsetBeforePosition(editor, endRange.endContainer, endRange.endOffset);
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const getLiveSelectionRects = (editor: HTMLDivElement): Array<{ left: number; top: number; width: number; height: number }> => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];
    if (!isNodeInsideEditor(editor, selection.anchorNode) || !isNodeInsideEditor(editor, selection.focusNode)) return [];
    const range = selection.getRangeAt(0);
    if (range.collapsed) return [];
    const editorRect = editor.getBoundingClientRect();
    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left - editorRect.left, top: rect.top - editorRect.top, width: rect.width, height: rect.height }));
  };

  const getSelectionRects = (editor: HTMLDivElement, start: number, end: number): Array<{ left: number; top: number; width: number; height: number }> => {
    if (end <= start) return [];
    const startPos = resolveTextNodeAtOffset(editor, start);
    const endPos = resolveTextNodeAtOffset(editor, end);
    if (!startPos || !endPos) return [];
    const range = document.createRange();
    try { range.setStart(startPos.node, startPos.offset); range.setEnd(endPos.node, endPos.offset); }
    catch { return []; }
    const editorRect = editor.getBoundingClientRect();
    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left - editorRect.left, top: rect.top - editorRect.top, width: rect.width, height: rect.height }));
  };

  const getCursorXYFromOffset = (editor: HTMLDivElement, offset: number): { x: number; y: number } | null => {
    const total = getTotalPlainTextLength(editor);
    const clamped = Math.max(0, Math.min(Math.trunc(offset), total));
    const resolved = resolveTextNodeAtOffset(editor, clamped);
    if (!resolved) return null;
    const range = document.createRange();
    try { range.setStart(resolved.node, resolved.offset); range.setEnd(resolved.node, resolved.offset); }
    catch { return null; }
    const caret = getCaretClientRect(range, editor);
    if (!caret) return null;
    return clientPointToEditorOverlay(editor, caret.left, caret.top);
  };

  const resolveRemoteCursorPosition = (cursor: RemoteCursor): { left: number; top: number } => {
    void scrollLayoutTick;
    const editor = editorRef.current;
    if (!editor) return { left: Math.max(cursor.x, 0), top: Math.max(cursor.y, 0) };
    if (typeof cursor.cursorOffset === 'number') {
      const pos = getCursorXYFromOffset(editor, cursor.cursorOffset);
      if (pos) {
        const p = { left: Math.max(pos.x, 0), top: Math.max(pos.y, 0) };
        remoteCaretLayoutCacheRef.current[cursor.userId] = p;
        return p;
      }
      const cached = remoteCaretLayoutCacheRef.current[cursor.userId];
      if (cached) return cached;
    }
    return { left: Math.max(cursor.x, 0), top: Math.max(cursor.y, 0) };
  };

  const applyFormat = (command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    const next = editor.innerHTML;
    latestContentRef.current = next;
    localContentChangeRef.current = true;
    setContent(next);
    scheduleSave();
  };

  if (loading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading document...</div>;
  }

  
  const remoteCursorEntries = Object.values(remoteCursors);


  const activeEditorsCount = remoteCursorEntries.length + 1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Meeting document</h3>
          <p className="text-xs text-gray-500">Real-time collaborative editing is enabled.</p>
          <p className="text-[11px] text-gray-500">Editing now: {activeEditorsCount}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={connected ? 'text-green-600' : 'text-amber-600'}>
            {connected ? 'Realtime connected' : 'Realtime reconnecting...'}
          </span>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1" onMouseDown={(e) => e.preventDefault()}>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('bold')}><Bold className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('italic')}><Italic className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('underline')}><Underline className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('formatBlock', 'H1')}><Heading1 className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('formatBlock', 'H2')}><Heading2 className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('insertUnorderedList')}><List className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('insertOrderedList')}><ListOrdered className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('formatBlock', 'BLOCKQUOTE')}><Quote className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('undo')}><Undo2 className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => applyFormat('redo')}><Redo2 className="h-4 w-4" /></Button>
      </div>

        {/* ====== key: editor + cursor overlay ====== */}
      <div className="relative isolate">
        {!content && (
          <div className="pointer-events-none absolute left-3 top-2 z-[1] text-sm text-gray-400">
            Start writing meeting notes...
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => {
            const next = (e.currentTarget as HTMLDivElement).innerHTML;
            latestContentRef.current = next;
            localContentChangeRef.current = true;
            setContent(next);
            scheduleSave();
            sendCursorUpdate(true);
          }}
          onKeyUp={() => sendCursorUpdate(true)}
          onMouseUp={() => sendCursorUpdate(true)}
          onFocus={() => {
            const el = editorRef.current;
            if (!el) return;
            requestAnimationFrame(() => {
              ensureSelectionAnchoredInEditor(el);
              sendCursorUpdate(true);
            });
          }}
          onScroll={() => setScrollLayoutTick((t) => t + 1)}
          onBlur={() => { void persistViaHttp(latestContentRef.current); }}
          className="relative z-0 min-h-[420px] w-full overflow-auto rounded-md border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7] [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-700 [&_p]:my-1"
        />
        
        <div className="pointer-events-none absolute inset-0 z-[100] overflow-visible" aria-hidden>
          {remoteCursorEntries.map((cursor) => {
            void scrollLayoutTick;
            const position = resolveRemoteCursorPosition(cursor);
            const editor = editorRef.current;
            const hasOffsetRange =
              typeof cursor.selectionStart === 'number' &&
              typeof cursor.selectionEnd === 'number' &&
              cursor.selectionEnd > cursor.selectionStart;
            let selectionRectsFromOffset: Array<{ left: number; top: number; width: number; height: number }> = [];
            if (hasOffsetRange && editor) {
              try { selectionRectsFromOffset = getSelectionRects(editor, cursor.selectionStart!, cursor.selectionEnd!); }
              catch { selectionRectsFromOffset = []; }
            }
            const normalizePayloadRect = (rect: { left: number; top: number; width: number; height: number }) => {
              if (!editor) return rect;
              const maxDim = Math.max(editor.clientWidth, editor.clientHeight) * 3;
              let { left, top } = rect;
              if (left > maxDim || top > maxDim) {
                left = Math.max(0, left - editor.scrollLeft);
                top = Math.max(0, top - editor.scrollTop);
              }
              return { ...rect, left, top };
            };
            const payloadRects = cursor.selectionRects ?? [];
            const selectionRectsFromPayload = payloadRects.map((r) =>
              normalizePayloadRect({ left: Math.max(r.left, 0), top: Math.max(r.top, 0), width: r.width, height: r.height })
            );
            const selectionRects = selectionRectsFromOffset.length > 0 ? selectionRectsFromOffset : selectionRectsFromPayload;
            const highlightBg = selectionHighlightBackground(cursor.color);
            const nameLabelTop = position.top >= 22 ? position.top - 20 : position.top + 6;
            return (
              <div key={cursor.presenceKey}>
                {/* selection highlight */}
                {selectionRects.map((rect, idx) => (
                  <div
                    key={`sel-${cursor.presenceKey}-${idx}`}
                    className="pointer-events-none absolute rounded-[2px]"
                    style={{
                      left: `${Math.max(rect.left, 0)}px`,
                      top: `${Math.max(rect.top, 0)}px`,
                      width: `${rect.width}px`,
                      height: `${rect.height}px`,
                      backgroundColor: highlightBg,
                    }}
                  />
                ))}
                {/* username label */}
                <div
                  className="pointer-events-none absolute z-[1] max-w-[200px] truncate whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                  style={{
                    left: `${Math.max(position.left, 0)}px`,
                    top: `${Math.max(0, nameLabelTop)}px`,
                    backgroundColor: cursor.color,
                  }}
                >
                  {cursor.username}
                </div>
                {/* cursor vertical line */}
                <div
                  className="pointer-events-none absolute"
                  style={{ left: `${position.left}px`, top: `${position.top}px` }}
                >
                  <div className="h-5 w-0.5" style={{ backgroundColor: cursor.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not synced yet'}
      </div>
      {remoteCursorEntries.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
          {remoteCursorEntries.map((cursor) => (
            <span key={`badge-${cursor.presenceKey}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cursor.color }} />
              {cursor.username}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
