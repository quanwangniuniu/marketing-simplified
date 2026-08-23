'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Hash, Loader2, MessageSquare, X } from 'lucide-react';
import { format } from 'date-fns';
import { listSavedMessages, unsaveMessage } from '@/lib/api/chatApi';
import type { SavedMessageRow } from '@/lib/api/chatApi';

interface SavedItemsPanelProps {
  onClose: () => void;
  /**
   * Called when user clicks "Jump to message".
   * `parentMessageId` is set when the saved message is a thread reply — the
   * caller should open the thread for the parent and highlight the reply.
   */
  onJumpToMessage?: (
    messageId: number,
    chatId: number,
    parentMessageId?: number | null,
    projectId?: number | string | null,
  ) => void;
}

export default function SavedItemsPanel({ onClose, onJumpToMessage }: SavedItemsPanelProps) {
  const [items, setItems] = useState<SavedMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    listSavedMessages()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUnsave = useCallback(async (item: SavedMessageRow) => {
    setRemovingId(item.id);
    try {
      await unsaveMessage(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      /* silently ignore */
    } finally {
      setRemovingId(null);
    }
  }, []);

  return (
    <div className="flex h-full w-full flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Bookmark className="h-4 w-4 text-gray-500" />
        <span className="flex-1 text-sm font-semibold text-gray-800">Saved items</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close saved items"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="task-tab-scrollbar flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-gray-400">
            <Bookmark className="h-8 w-8 opacity-30" />
            <p className="text-sm">No saved messages yet.</p>
            <p className="text-xs">Save messages with the bookmark icon in any conversation.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const chatId = item.chat_id ?? (item.message as any).chat_id ?? (item.message as any).chat;
              const projectId = item.project_id ?? (item.message as any).project_id ?? null;
              return (
                <li key={item.id} className="group flex items-start hover:bg-gray-50">
                  {/* Amber left-accent bar — every item here is saved */}
                  <div className="w-0.5 self-stretch shrink-0 bg-amber-400" />
                  <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 flex items-center gap-1 flex-wrap text-[11px] text-gray-400">
                        <span>{item.message.sender?.username || item.message.sender?.email}</span>
                        <span>·</span>
                        {item.chat_name && (
                          <>
                            <span className="inline-flex items-center gap-0.5">
                              {item.chat_type === 'direct'
                                ? <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                                : <Hash className="h-2.5 w-2.5 shrink-0" />}
                              {item.chat_name}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        <span>{format(new Date(item.created_at), 'MMM d')}</span>
                      </p>
                      <p className="line-clamp-3 text-sm text-gray-700 [overflow-wrap:anywhere]">
                        {item.message.content || '(attachment)'}
                      </p>
                      {/* Saved label */}
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                        <Bookmark className="h-3 w-3 shrink-0 text-amber-500" />
                        Saved for later
                      </p>
                      {onJumpToMessage && chatId && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToMessage(
                              item.message.id,
                              Number(chatId),
                              item.message.parent_message_id ?? null,
                              projectId || null,
                            )
                          }
                          className="mt-0.5 text-[11px] text-teal-600 hover:underline"
                        >
                          Jump to message →
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUnsave(item)}
                      disabled={removingId === item.id}
                      className="mt-0.5 hidden shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:block disabled:opacity-50"
                      aria-label="Remove saved"
                    >
                      {removingId === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
