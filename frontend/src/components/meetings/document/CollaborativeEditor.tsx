'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import {
  clientPointToEditorOverlay,
  computeOffsetTransform,
  ensureSelectionAnchoredInEditor,
  getCaretClientRect,
  getEditorPlainText,
  getLiveSelectionRects,
  getPlainTextOffsetBeforePosition,
  getPlainTextSelectionState,
  getSelectionOffsets,
  getSelectionRects,
  hashColorForUser,
  isNodeInsideEditor,
  restorePlainTextSelectionState,
  type SelectionRect,
} from './cursorGeometry';
import DocumentToolbar from './DocumentToolbar';
import PresenceCursors, { type RemoteCursor } from './PresenceCursors';
import {
  useDocumentSocket,
  type CursorUpdatedEvent,
  type DocumentSnapshotEvent,
  type DocumentUpdatedEvent,
  type WsState,
} from './useDocumentSocket';

export interface MemberLike {
  id: number;
  user: { id: number; username?: string; email?: string; name?: string };
}

export interface EditorHostState {
  wsState: WsState;
  closeCode: number | null;
  saving: boolean;
  lastSyncedAt: string | null;
  editorsOnline: number;
  activeUsers: Array<{ userId: number; username: string; color: string }>;
}

interface Props {
  projectId: number;
  meetingId: number;
  token: string | null;
  readOnly: boolean;
  members: MemberLike[];
  onStateChange: (state: EditorHostState) => void;
}

const CURSOR_BROADCAST_DEBOUNCE_MS = 25;
const CURSOR_HEARTBEAT_MS = 600;
const CURSOR_TTL_MS = 45000;
const WS_CONTENT_DEBOUNCE_MS = 20;
const POLL_INTERVAL_OFFLINE_MS = 8000;

function resolveUsername(
  userId: number,
  rawName: string | undefined,
  members: MemberLike[],
): string {
  if (rawName && rawName.trim() && !/^user\s+\d+$/i.test(rawName.trim())) {
    return rawName.trim();
  }
  const match = members.find((m) => m.user?.id === userId);
  if (match) {
    const u = match.user;
    return (u.name?.trim() || u.username?.trim() || u.email?.trim() || `User ${userId}`);
  }
  return `User ${userId}`;
}

function parseFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseOptionalInt(v: unknown): number | null {
  const n = parseFiniteNumber(v);
  if (n === null) return null;
  const r = Math.round(n);
  if (Math.abs(n - r) > 1e-9) return null;
  return r;
}

function isIncomingNewer(incoming: string | null | undefined, current: string | null): boolean {
  if (!incoming) return false;
  if (!current) return true;
  const i = new Date(incoming).getTime();
  const c = new Date(current).getTime();
  if (!Number.isFinite(i) || !Number.isFinite(c)) return incoming !== current;
  return i > c;
}

export default function CollaborativeEditor({
  projectId,
  meetingId,
  token,
  readOnly,
  members,
  onStateChange,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [scrollTick, setScrollTick] = useState(0);

  const latestContentRef = useRef('');
  const lastSyncedAtRef = useRef<string | null>(null);
  const contentChangeTimerRef = useRef<number | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const cursorHeartbeatTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const suppressContentSyncRef = useRef(false);
  const localContentChangeRef = useRef(false);
  const cursorSeenAtRef = useRef<Record<string, number>>({});
  const lastOutgoingCursorRef = useRef<{
    offset: number;
    x: number;
    y: number;
    selectionStart?: number;
    selectionEnd?: number;
    selectionRects: SelectionRect[];
  } | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const clientId = useMemo(
    () => `doc-${meetingId}-${Math.random().toString(36).slice(2, 10)}`,
    [meetingId],
  );

  const bumpOverlay = useCallback(() => {
    queueMicrotask(() => setScrollTick((t) => t + 1));
    requestAnimationFrame(() => setScrollTick((t) => t + 1));
  }, []);

  useEffect(() => {
    lastSyncedAtRef.current = lastSyncedAt;
  }, [lastSyncedAt]);
  useEffect(() => {
    latestContentRef.current = content;
  }, [content]);

  const applyRemoteContent = useCallback(
    (next: string) => {
      if (next === latestContentRef.current) return;
      const editor = editorRef.current;
      const preserveSelection = editor !== null && document.activeElement === editor;
      const saved = preserveSelection && editor ? getPlainTextSelectionState(editor) : null;
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
        } catch {
          /* identity */
        }

        setRemoteCursors((prev) => {
          if (Object.keys(prev).length === 0) return prev;
          const adjusted: Record<string, RemoteCursor> = {};
          for (const [key, cursor] of Object.entries(prev)) {
            adjusted[key] = {
              ...cursor,
              cursorOffset:
                typeof cursor.cursorOffset === 'number'
                  ? transform(cursor.cursorOffset)
                  : cursor.cursorOffset,
              selectionStart:
                typeof cursor.selectionStart === 'number'
                  ? transform(cursor.selectionStart)
                  : cursor.selectionStart,
              selectionEnd:
                typeof cursor.selectionEnd === 'number'
                  ? transform(cursor.selectionEnd)
                  : cursor.selectionEnd,
            };
          }
          return adjusted;
        });

        const lastOut = lastOutgoingCursorRef.current;
        if (lastOut) {
          lastOutgoingCursorRef.current = {
            ...lastOut,
            offset: transform(lastOut.offset),
            selectionStart:
              typeof lastOut.selectionStart === 'number'
                ? transform(lastOut.selectionStart)
                : lastOut.selectionStart,
            selectionEnd:
              typeof lastOut.selectionEnd === 'number'
                ? transform(lastOut.selectionEnd)
                : lastOut.selectionEnd,
            selectionRects: [],
          };
        }

        bumpOverlay();

        if (saved) {
          const adjustedSaved = {
            anchor: transform(saved.anchor),
            focus: transform(saved.focus),
          };
          requestAnimationFrame(() => {
            if (editorRef.current !== editor) return;
            restorePlainTextSelectionState(editor, adjustedSaved);
            editor.focus();
            requestAnimationFrame(() => {
              ensureSelectionAnchoredInEditor(editor);
              bumpOverlay();
            });
          });
        }
      }
    },
    [bumpOverlay],
  );

  const handleSnapshot = useCallback(
    (event: DocumentSnapshotEvent) => {
      if (!isIncomingNewer(event.updated_at, lastSyncedAtRef.current)) {
        if (!lastSyncedAtRef.current) {
          applyRemoteContent(event.content ?? '');
          lastSyncedAtRef.current = event.updated_at;
          setLastSyncedAt(event.updated_at);
          setLoading(false);
        }
        return;
      }
      applyRemoteContent(event.content ?? '');
      lastSyncedAtRef.current = event.updated_at;
      setLastSyncedAt(event.updated_at);
      setLoading(false);
    },
    [applyRemoteContent],
  );

  const handleDocumentUpdated = useCallback(
    (event: DocumentUpdatedEvent) => {
      if (event.client_id && event.client_id === clientId) return;
      if (!isIncomingNewer(event.updated_at, lastSyncedAtRef.current)) return;
      applyRemoteContent(event.content ?? '');
      lastSyncedAtRef.current = event.updated_at;
      setLastSyncedAt(event.updated_at);
    },
    [applyRemoteContent, clientId],
  );

  const handleCursorUpdated = useCallback(
    (event: CursorUpdatedEvent) => {
      if (event.client_id === clientId) return;
      const userId = parseOptionalInt(event.user_id);
      if (userId === null || userId < 1) return;

      if (event.is_active === false) {
        setRemoteCursors((prev) => {
          const next = { ...prev };
          for (const pk of Object.keys(next)) {
            if (next[pk]?.userId === userId) {
              delete cursorSeenAtRef.current[pk];
              delete next[pk];
            }
          }
          return next;
        });
        return;
      }

      const xParsed = parseFiniteNumber(event.x);
      const yParsed = parseFiniteNumber(event.y);
      const offsetParsed = parseOptionalInt(event.cursor_offset);
      if (xParsed === null && yParsed === null && offsetParsed === null) return;

      const presenceKey = `u:${userId}`;
      const incomingSelectionRects: SelectionRect[] = Array.isArray(event.selection_rects)
        ? event.selection_rects
            .map((r) => {
              if (!r || typeof r !== 'object') return null;
              const o = r as Record<string, unknown>;
              const left = parseFiniteNumber(o.left);
              const top = parseFiniteNumber(o.top);
              const width = parseFiniteNumber(o.width);
              const height = parseFiniteNumber(o.height);
              if (left === null || top === null || width === null || height === null) return null;
              return { left, top, width, height };
            })
            .filter((r): r is SelectionRect => r !== null)
        : [];
      const incomingStart = parseOptionalInt(event.selection_start) ?? undefined;
      const incomingEnd = parseOptionalInt(event.selection_end) ?? undefined;
      const hasNumericRange =
        typeof incomingStart === 'number' &&
        typeof incomingEnd === 'number' &&
        incomingEnd > incomingStart;
      const rectsEmpty = incomingSelectionRects.length === 0;
      const collapsedOffsets =
        typeof incomingStart === 'number' &&
        typeof incomingEnd === 'number' &&
        incomingStart === incomingEnd;
      const peerHasNoSelection = rectsEmpty && (collapsedOffsets || !hasNumericRange);

      let storedStart: number | undefined;
      let storedEnd: number | undefined;
      let storedRects: SelectionRect[];
      if (peerHasNoSelection) {
        storedStart = undefined;
        storedEnd = undefined;
        storedRects = [];
      } else if (hasNumericRange) {
        storedStart = incomingStart;
        storedEnd = incomingEnd;
        storedRects = incomingSelectionRects;
      } else {
        storedStart = undefined;
        storedEnd = undefined;
        storedRects = incomingSelectionRects;
      }

      cursorSeenAtRef.current[presenceKey] = Date.now();
      const color = hashColorForUser(userId, presenceKey);
      const displayName = resolveUsername(userId, event.username, members);

      setRemoteCursors((prev) => {
        const existing = prev[presenceKey];
        const mergedX = xParsed ?? existing?.x ?? 0;
        const mergedY = yParsed ?? existing?.y ?? 0;
        const mergedOffset = offsetParsed ?? existing?.cursorOffset;
        return {
          ...prev,
          [presenceKey]: {
            presenceKey,
            userId,
            username: displayName,
            x: mergedX,
            y: mergedY,
            cursorOffset: mergedOffset,
            selectionStart: storedStart,
            selectionEnd: storedEnd,
            selectionRects: storedRects,
            color,
          },
        };
      });
    },
    [clientId, members],
  );

  const { wsState, closeCode, sendDocumentUpdate, sendCursorUpdate } = useDocumentSocket({
    meetingId,
    token,
    clientId,
    onSnapshot: handleSnapshot,
    onDocumentUpdated: handleDocumentUpdated,
    onCursorUpdated: handleCursorUpdated,
  });

  const sendCursorFromEditor = useCallback(
    (isActive = true) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (wsState !== 'connected') return;

      const selection = window.getSelection();
      let anchorInEditor = Boolean(
        selection && selection.rangeCount > 0 && isNodeInsideEditor(editor, selection.anchorNode),
      );
      if (document.activeElement === editor && !anchorInEditor) {
        ensureSelectionAnchoredInEditor(editor);
        const sel2 = window.getSelection();
        anchorInEditor = Boolean(
          sel2 && sel2.rangeCount > 0 && isNodeInsideEditor(editor, sel2.anchorNode),
        );
      }

      let x = 8 + editor.scrollLeft;
      let y = 8 + editor.scrollTop;
      let cursorOffset = 0;
      let selectionOffsets: { start: number; end: number } | null = null;
      let selectionRects: SelectionRect[] = [];

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
          offset: cursorOffset,
          x,
          y,
          selectionStart: collapsed ? undefined : selectionOffsets?.start,
          selectionEnd: collapsed ? undefined : selectionOffsets?.end,
          selectionRects: collapsed ? [] : selectionRects,
        };
      } else {
        const last = lastOutgoingCursorRef.current;
        if (last) {
          cursorOffset = last.offset;
          x = last.x;
          y = last.y;
          if (
            typeof last.selectionStart === 'number' &&
            typeof last.selectionEnd === 'number' &&
            last.selectionEnd > last.selectionStart
          ) {
            selectionOffsets = { start: last.selectionStart, end: last.selectionEnd };
            selectionRects = getSelectionRects(editor, last.selectionStart, last.selectionEnd);
            if (selectionRects.length === 0 && last.selectionRects.length > 0)
              selectionRects = last.selectionRects;
          }
        }
      }

      sendCursorUpdate({
        x,
        y,
        cursor_offset: cursorOffset,
        selection_start: selectionOffsets?.start ?? null,
        selection_end: selectionOffsets?.end ?? null,
        selection_rects: selectionRects,
        is_active: isActive,
      });
    },
    [sendCursorUpdate, wsState],
  );

  const scheduleContentSend = useCallback(() => {
    if (contentChangeTimerRef.current) window.clearTimeout(contentChangeTimerRef.current);
    contentChangeTimerRef.current = window.setTimeout(() => {
      const ok = sendDocumentUpdate(latestContentRef.current);
      if (!ok) {
        persistViaHttp(latestContentRef.current);
      }
    }, WS_CONTENT_DEBOUNCE_MS);
  }, [sendDocumentUpdate]);

  const persistViaHttp = useCallback(
    async (next: string) => {
      setSaving(true);
      try {
        const response = await MeetingsAPI.saveMeetingDocument(projectId, meetingId, {
          content: next,
        });
        if (response.updated_at) {
          lastSyncedAtRef.current = response.updated_at;
          setLastSyncedAt(response.updated_at);
        }
      } catch {
        toast.error('Failed to save meeting document');
      } finally {
        setSaving(false);
      }
    },
    [projectId, meetingId],
  );

  useEffect(() => {
    let cancelled = false;
    MeetingsAPI.getMeetingDocument(projectId, meetingId)
      .then((doc) => {
        if (cancelled) return;
        applyRemoteContent(doc.content ?? '');
        lastSyncedAtRef.current = doc.updated_at ?? null;
        setLastSyncedAt(doc.updated_at ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, meetingId, applyRemoteContent]);

  useEffect(() => {
    if (wsState !== 'connected') return;
    const id = window.setTimeout(() => sendCursorFromEditor(true), 0);
    return () => window.clearTimeout(id);
  }, [wsState, sendCursorFromEditor]);

  useEffect(() => {
    const handler = () => {
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => {
        sendCursorFromEditor(true);
      }, CURSOR_BROADCAST_DEBOUNCE_MS);
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [sendCursorFromEditor]);

  useEffect(() => {
    cursorHeartbeatTimerRef.current = window.setInterval(() => {
      if (!editorRef.current) return;
      sendCursorFromEditor(true);
    }, CURSOR_HEARTBEAT_MS);
    return () => {
      if (cursorHeartbeatTimerRef.current) {
        window.clearInterval(cursorHeartbeatTimerRef.current);
        cursorHeartbeatTimerRef.current = null;
      }
    };
  }, [sendCursorFromEditor]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        const next: Record<string, RemoteCursor> = {};
        let changed = false;
        for (const [key, cursor] of Object.entries(prev)) {
          const seenAt = cursorSeenAtRef.current[key] ?? 0;
          if (now - seenAt <= CURSOR_TTL_MS) {
            next[key] = cursor;
          } else {
            changed = true;
            delete cursorSeenAtRef.current[key];
          }
        }
        return changed ? next : prev;
      });
    }, 600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (wsState === 'connected') {
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const doc = await MeetingsAPI.getMeetingDocument(projectId, meetingId);
        if (cancelled) return;
        if (!doc.updated_at) return;
        if (!isIncomingNewer(doc.updated_at, lastSyncedAtRef.current)) return;
        applyRemoteContent(doc.content ?? '');
        lastSyncedAtRef.current = doc.updated_at;
        setLastSyncedAt(doc.updated_at);
      } catch {
        /* silent */
      }
    };
    const tick = () => {
      if (cancelled) return;
      pollingTimerRef.current = window.setTimeout(
        () => poll().finally(tick),
        POLL_INTERVAL_OFFLINE_MS,
      );
    };
    tick();
    return () => {
      cancelled = true;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [wsState, projectId, meetingId, applyRemoteContent]);

  useEffect(() => {
    if (suppressContentSyncRef.current) {
      suppressContentSyncRef.current = false;
      return;
    }
    if (localContentChangeRef.current) {
      localContentChangeRef.current = false;
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML === content) return;
    const preserveSelection = document.activeElement === editor;
    const saved = preserveSelection ? getPlainTextSelectionState(editor) : null;
    editor.innerHTML = content || '';
    bumpOverlay();
    if (saved) {
      requestAnimationFrame(() => {
        if (editorRef.current !== editor) return;
        restorePlainTextSelectionState(editor, saved);
        editor.focus();
      });
    }
  }, [content, bumpOverlay]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (loading) return;
    const pending = latestContentRef.current;
    if (!pending || editor.innerHTML === pending) return;
    editor.innerHTML = pending;
    bumpOverlay();
  }, [loading, bumpOverlay]);

  useEffect(() => {
    return () => {
      if (contentChangeTimerRef.current) window.clearTimeout(contentChangeTimerRef.current);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      if (pollingTimerRef.current) window.clearTimeout(pollingTimerRef.current);
    };
  }, []);

  const remoteCursorEntries = useMemo(() => Object.values(remoteCursors), [remoteCursors]);
  const editorsOnline = remoteCursorEntries.length + 1;
  const activeUsers = useMemo(
    () =>
      remoteCursorEntries.map((c) => ({
        userId: c.userId,
        username: c.username,
        color: c.color,
      })),
    [remoteCursorEntries],
  );

  useEffect(() => {
    onStateChangeRef.current({
      wsState,
      closeCode,
      saving,
      lastSyncedAt,
      editorsOnline,
      activeUsers,
    });
  }, [wsState, closeCode, saving, lastSyncedAt, editorsOnline, activeUsers]);

  const applyFormat = (command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      return;
    }
    const next = editor.innerHTML;
    latestContentRef.current = next;
    localContentChangeRef.current = true;
    setContent(next);
    scheduleContentSend();
  };

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    const next = (e.currentTarget as HTMLDivElement).innerHTML;
    latestContentRef.current = next;
    localContentChangeRef.current = true;
    setContent(next);
    scheduleContentSend();
    sendCursorFromEditor(true);
  };

  const onBlur = () => {
    if (wsState === 'connected') return;
    persistViaHttp(latestContentRef.current);
  };

  return (
    <div className="space-y-3">
      <DocumentToolbar disabled={readOnly || wsState !== 'connected'} onCommand={applyFormat} />

      <div className="relative isolate">
        {!content && !loading && (
          <div className="pointer-events-none absolute left-4 top-3 z-[1] text-sm text-gray-400">
            Start writing meeting notes…
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={onInput}
          onKeyUp={() => sendCursorFromEditor(true)}
          onMouseUp={() => sendCursorFromEditor(true)}
          onFocus={() => {
            const el = editorRef.current;
            if (!el) return;
            requestAnimationFrame(() => {
              ensureSelectionAnchoredInEditor(el);
              sendCursorFromEditor(true);
            });
          }}
          onScroll={() => setScrollTick((t) => t + 1)}
          onBlur={onBlur}
          className="relative z-0 min-h-[480px] w-full overflow-auto rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-700 [&_h1]:my-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-6"
          aria-label="Meeting document editor"
        />

        <PresenceCursors cursors={remoteCursorEntries} editorRef={editorRef} scrollTick={scrollTick} />
      </div>
    </div>
  );
}
