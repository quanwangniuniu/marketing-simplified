'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, Paperclip, Pin, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { PinnedMessageRow } from '@/lib/api/chatApi';

interface PinnedMessagesDrawerProps {
  pins: PinnedMessageRow[];
  canManageChannel: boolean;
  onClose: () => void;
  onJumpToMessage: (messageId: number, parentMessageId?: number | null) => void;
  onUnpin: (messageId: number) => Promise<void>;
}

import { avatarColor } from './avatarColor';

function senderName(pin: PinnedMessageRow) {
  return pin.message.sender?.username || pin.message.sender?.email || 'Unknown';
}

function compactRelativeTime(iso: string) {
  const date = parseISO(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return format(date, 'MMM d');
}

const EXIT_ANIMATION_MS = 340;

export default function PinnedMessagesDrawer({
  pins,
  canManageChannel,
  onClose,
  onJumpToMessage,
  onUnpin,
}: PinnedMessagesDrawerProps) {
  const [unpinningMessageId, setUnpinningMessageId] = useState<number | null>(null);
  // Rows cached through their own removal from `pins` so the card can play a
  // dissolve + height-collapse exit instead of vanishing on the next render.
  const [exitCache, setExitCache] = useState<PinnedMessageRow[]>([]);
  const exitTimersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  const displayPins = useMemo(() => {
    const liveIds = new Set(pins.map((pin) => pin.id));
    const ghosts = exitCache.filter((row) => !liveIds.has(row.id));
    if (ghosts.length === 0) return pins.map((pin) => ({ pin, exiting: false }));
    // Ghosts keep their old slot: the list is sorted newest-pinned first.
    return [
      ...pins.map((pin) => ({ pin, exiting: false })),
      ...ghosts.map((pin) => ({ pin, exiting: true })),
    ].sort((a, b) => (a.pin.created_at < b.pin.created_at ? 1 : -1));
  }, [pins, exitCache]);

  const handleUnpin = async (pin: PinnedMessageRow) => {
    setUnpinningMessageId(pin.message.id);
    // Cache before awaiting: the parent removes the row from `pins` on success.
    setExitCache((rows) => (rows.some((row) => row.id === pin.id) ? rows : [...rows, pin]));
    try {
      await onUnpin(pin.message.id);
      const timer = window.setTimeout(() => {
        exitTimersRef.current.delete(pin.id);
        setExitCache((rows) => rows.filter((row) => row.id !== pin.id));
      }, EXIT_ANIMATION_MS);
      exitTimersRef.current.set(pin.id, timer);
    } catch {
      // Failed: the row is still pinned, drop the cache so no exit plays.
      setExitCache((rows) => rows.filter((row) => row.id !== pin.id));
    } finally {
      setUnpinningMessageId(null);
    }
  };

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-gray-200 bg-gray-50/60"
      data-testid="pinned-messages-drawer"
      aria-label="Pinned messages"
    >
      <header className="relative z-10 flex shrink-0 items-center gap-2.5 border-b border-gray-200/80 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <span className="pin-grad-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white">
          <Pin className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight text-gray-900">Pinned messages</h3>
          <p className="text-[11px] text-gray-400">
            {pins.length} pin{pins.length === 1 ? '' : 's'} · newest first
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close pinned messages"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="task-tab-scrollbar flex-1 overflow-y-auto">
        {displayPins.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-5 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Pin className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-gray-700">No pinned messages yet</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Channel managers can pin important updates for everyone.
            </p>
          </div>
        ) : (
          <ol className="px-3 pb-3 pt-0.5" data-testid="pinned-drawer-list">
            {displayPins.map(({ pin, exiting }, index) => {
              const name = senderName(pin);
              return (
                <li
                  key={pin.id}
                  className={[
                    'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                    exiting ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                  ].join(' ')}
                  data-testid="pinned-drawer-item"
                  aria-hidden={exiting || undefined}
                >
                  {/* overflow-hidden only while collapsing so hover shadows stay unclipped */}
                  <div className={exiting ? 'min-h-0 overflow-hidden' : 'min-h-0'}>
                    <div className="pt-2.5">
                      <article
                        className={[
                          'group rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_4px_12px_rgba(16,24,40,0.10)]',
                          exiting ? 'pin-card-exit' : 'pin-card-enter',
                        ].join(' ')}
                        style={exiting ? undefined : { animationDelay: `${Math.min(index, 8) * 50}ms` }}
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToMessage(pin.message.id, pin.message.parent_message_id ?? null)}
                          className="block w-full px-3 pt-3 text-left"
                          title="Jump to message"
                          aria-label={`Jump to pinned message: ${pin.message.content || 'attachment'}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(pin.message.sender?.id)}`}>
                              {name.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">
                              {name}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                              {compactRelativeTime(pin.message.created_at)}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover:text-teal-600" />
                          </span>
                          {pin.message.content ? (
                            <span className="mt-2 line-clamp-2 block whitespace-pre-wrap text-[13px] leading-5 text-gray-700 [overflow-wrap:anywhere]">
                              {pin.message.content}
                            </span>
                          ) : (
                            <span className="mt-2 flex items-center gap-1.5 text-[13px] italic leading-5 text-gray-400">
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              Attachment
                            </span>
                          )}
                        </button>

                        <div className="mx-3 mt-2.5 flex items-center gap-1.5 border-t border-gray-100 pb-2.5 pt-2 text-[10px] text-gray-400">
                          <Pin className="h-3 w-3 shrink-0 text-teal-500" />
                          <span className="min-w-0 flex-1 truncate">
                            {pin.pinned_by
                              ? `Pinned by ${pin.pinned_by.username || pin.pinned_by.email} · `
                              : 'Pinned · '}
                            {format(parseISO(pin.created_at), 'MMM d, yyyy · h:mm a')}
                          </span>
                          {canManageChannel && (
                            <button
                              type="button"
                              onClick={() => void handleUnpin(pin)}
                              disabled={exiting || unpinningMessageId === pin.message.id}
                              className="flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              aria-label={`Unpin message: ${pin.message.content || 'attachment'}`}
                              title="Unpin from channel"
                            >
                              {unpinningMessageId === pin.message.id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              Unpin
                            </button>
                          )}
                        </div>
                      </article>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
