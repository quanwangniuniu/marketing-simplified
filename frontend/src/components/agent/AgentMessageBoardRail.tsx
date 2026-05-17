'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MoreVertical, Pin, Plus, Search } from 'lucide-react';
import { AgentAPI } from '@/lib/api/agentApi';
import type { AgentSession } from '@/types/agent';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const MENU_W = 200;
const MENU_MAX_H = 320;

type ContextState = { sessionId: string; x: number; y: number };

/** Section labels — regular weight, ~13px, medium gray (sidebar reference). Horizontal inset comes from the list column wrapper. */
const SECTION_HEADING =
  'py-1.5 text-[13px] font-normal leading-tight text-[#808080]';

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function partitionSessions(sessions: AgentSession[]) {
  const pinned: AgentSession[] = [];
  const today: AgentSession[] = [];
  const previous: AgentSession[] = [];
  const archived: AgentSession[] = [];
  const dayStart = startOfLocalDay(new Date());

  for (const s of sessions) {
    if (s.status === 'archived') {
      archived.push(s);
      continue;
    }
    if (s.is_pinned) {
      pinned.push(s);
      continue;
    }
    const created = new Date(s.created_at).getTime();
    if (created >= dayStart) today.push(s);
    else previous.push(s);
  }
  return { pinned, today, previous, archived };
}

function dispatchSelectSession(sessionId: string) {
  sessionStorage.setItem('agent-session-id', sessionId);
  window.dispatchEvent(new CustomEvent('agent:load-session', { detail: { sessionId } }));
  window.dispatchEvent(new CustomEvent('agent:session-id', { detail: { sessionId } }));
  window.dispatchEvent(
    new CustomEvent('agent:session-state', { detail: { sessionId } }),
  );
}

function dispatchNewChat() {
  sessionStorage.removeItem('agent-session-id');
  window.dispatchEvent(new CustomEvent('agent:new-chat'));
  window.dispatchEvent(new CustomEvent('agent:session-id', { detail: { sessionId: null } }));
}

export interface AgentMessageBoardRailProps {
  isVisible: boolean;
  activeSessionId: string | null;
}

export function AgentMessageBoardRail({ isVisible, activeSessionId }: AgentMessageBoardRailProps) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [ctx, setCtx] = useState<ContextState | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!isVisible) return;
    setLoading(true);
    try {
      const list = await AgentAPI.listSessions();
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [isVisible]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const displayedSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || '').toLowerCase().includes(q));
  }, [sessions, search]);

  const { pinned, today, previous, archived } = useMemo(
    () => partitionSessions(displayedSessions),
    [displayedSessions],
  );

  useEffect(() => {
    const onChanged = () => void loadSessions();
    window.addEventListener('agent:sessions-changed', onChanged);
    return () => window.removeEventListener('agent:sessions-changed', onChanged);
  }, [loadSessions]);

  const closeCtx = useCallback(() => setCtx(null), []);

  useEffect(() => {
    if (!ctx) return;
    const onDoc = () => setTimeout(() => setCtx(null), 0);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [ctx]);

  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx]);

  const openCtx = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth) x = e.clientX - MENU_W;
    if (y + MENU_MAX_H > window.innerHeight) y = e.clientY - MENU_MAX_H;
    setCtx({ sessionId, x, y });
  };

  const ctxSession = useMemo(
    () => (ctx ? sessions.find((s) => String(s.id) === ctx.sessionId) : null),
    [ctx, sessions],
  );

  const handleNewBoard = async () => {
    if (creating) return;
    setCreating(true);
    dispatchNewChat();
    try {
      const session = await AgentAPI.createSession({});
      const sid = String(session.id);
      sessionStorage.setItem('agent-session-id', sid);
      dispatchSelectSession(sid);
      window.dispatchEvent(new CustomEvent('agent:sessions-changed'));
    } catch {
      // leave welcome state
    } finally {
      setCreating(false);
    }
  };

  const patchSession = async (id: string, body: Parameters<typeof AgentAPI.updateSession>[1]) => {
    await AgentAPI.updateSession(id, body);
    window.dispatchEvent(new CustomEvent('agent:sessions-changed'));
    closeCtx();
  };

  const runCtx = async (fn: () => Promise<void>) => {
    if (!ctx) return;
    try {
      await fn();
    } catch {
      // ignore
    }
    closeCtx();
  };

  const startRename = () => {
    if (!ctxSession) return;
    setRenameId(String(ctxSession.id));
    setRenameTitle(ctxSession.title?.trim() || 'Untitled');
    setRenameOpen(true);
    closeCtx();
  };

  const confirmRename = async () => {
    if (!renameId || !renameTitle.trim()) {
      setRenameOpen(false);
      return;
    }
    try {
      await AgentAPI.updateSession(renameId, { title: renameTitle.trim() });
      window.dispatchEvent(new CustomEvent('agent:sessions-changed'));
    } catch {
      // ignore
    }
    setRenameOpen(false);
    setRenameId(null);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await AgentAPI.deleteSession(deleteId);
      if (activeSessionId === deleteId) {
        dispatchNewChat();
      }
      window.dispatchEvent(new CustomEvent('agent:sessions-changed'));
    } catch {
      // ignore
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
      setDeleteId(null);
    }
  };

  if (!isVisible) return null;

  const renderBoardRow = (s: AgentSession) => {
    const id = String(s.id);
    const label = s.title?.trim() || 'Untitled';
    const active = activeSessionId === id;
    const isArchived = s.status === 'archived';
    return (
      <li key={id}>
        <div
          className={cn(
            'group flex w-full items-stretch rounded-lg border text-xs transition-colors',
            active
              ? 'border-[#3CCED7] bg-[#3CCED7]/10 text-gray-900 ring-1 ring-[#3CCED7]/25'
              : 'border-transparent bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50',
            isArchived && 'opacity-70',
          )}
        >
          <button
            type="button"
            onClick={() => dispatchSelectSession(id)}
            onContextMenu={(e) => openCtx(e, id)}
            className="flex min-w-0 flex-1 items-start gap-1.5 rounded-l-lg px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/50 focus-visible:ring-offset-1"
          >
            {s.has_unread && (
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#3CCED7]"
                title="Unread messages"
                aria-hidden
              />
            )}
            {s.is_pinned && (
              <span className="mt-0.5 inline-flex shrink-0" title="Pinned">
                <Pin className="h-3 w-3 text-gray-400" strokeWidth={2} aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
          </button>
          <button
            type="button"
            aria-label="Message board actions"
            aria-haspopup="menu"
            aria-expanded={ctx?.sessionId === id}
            className={cn(
              'flex shrink-0 items-start justify-center rounded-r-lg px-1 py-2 text-gray-500 outline-none transition-[color,opacity] focus-visible:ring-2 focus-visible:ring-[#3CCED7]/50 focus-visible:ring-offset-1',
              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              ctx?.sessionId === id && 'opacity-100',
              active ? 'hover:text-gray-800' : 'hover:bg-gray-100/80 hover:text-gray-700',
            )}
            onClick={(e) => openCtx(e, id)}
            onContextMenu={(e) => openCtx(e, id)}
          >
            <MoreVertical className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>
      </li>
    );
  };

  const hasAnyBoards = pinned.length + today.length + previous.length + archived.length > 0;

  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-gray-200 bg-gray-50/80 min-h-0">
      <div className="shrink-0 space-y-2 border-b border-gray-200 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search boards…"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7]/40"
            aria-label="Search message boards"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleNewBoard()}
          disabled={creating}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#3CCED7] bg-white py-2 text-xs font-semibold text-[#1a9ba3] shadow-sm hover:bg-[#3CCED7]/10 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New Agent
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !hasAnyBoards ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            <p className="px-1 text-center text-xs text-gray-500">
              {sessions.length === 0 ? 'No message boards yet.' : 'No boards match your search.'}
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0">
              <div className={SECTION_HEADING}>Pinned</div>
              <div className="max-h-[32vh] overflow-y-auto pb-2 pt-0.5">
                <ul className="flex flex-col gap-1">{pinned.map(renderBoardRow)}</ul>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <div className={SECTION_HEADING}>Today</div>
              <ul className="mt-0.5 flex flex-col gap-1">{today.map(renderBoardRow)}</ul>
              <div className={cn(SECTION_HEADING, 'mt-3')}>Previous</div>
              <ul className="mt-0.5 flex flex-col gap-1">{previous.map(renderBoardRow)}</ul>
            </div>

            <div className="shrink-0">
              <div className={SECTION_HEADING}>Archived</div>
              <div className="max-h-[32vh] overflow-y-auto pb-2 pt-0.5">
                <ul className="flex flex-col gap-1">{archived.map(renderBoardRow)}</ul>
              </div>
            </div>
          </>
        )}
      </div>

      {ctx && ctxSession && (
        <div
          className="fixed z-[200] min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            onClick={() =>
              void runCtx(() =>
                patchSession(ctx.sessionId, { is_pinned: !ctxSession.is_pinned }),
              )
            }
          >
            {ctxSession.is_pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            onClick={() =>
              void runCtx(() =>
                patchSession(ctx.sessionId, {
                  status: ctxSession.status === 'archived' ? 'active' : 'archived',
                }),
              )
            }
          >
            {ctxSession.status === 'archived' ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            onClick={startRename}
          >
            Rename…
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            onClick={() =>
              void runCtx(async () => {
                await AgentAPI.updateSession(ctx.sessionId, {
                  last_read_at: ctxSession.has_unread ? new Date().toISOString() : null,
                });
                window.dispatchEvent(new CustomEvent('agent:sessions-changed'));
              })
            }
          >
            {ctxSession.has_unread ? 'Mark read' : 'Mark unread'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setDeleteId(ctx.sessionId);
              setDeleteOpen(true);
              closeCtx();
            }}
          >
            Delete…
          </button>
        </div>
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename message board</DialogTitle>
          </DialogHeader>
          <input
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmRename();
            }}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-[#1a9ba3] px-3 py-1.5 text-sm text-white hover:bg-[#158a92]"
              onClick={() => void confirmRename()}
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete message board?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This removes the board from your list. You cannot undo this from the UI.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-60"
              onClick={() => void confirmDelete()}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
