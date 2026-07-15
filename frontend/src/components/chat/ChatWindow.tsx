'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckSquare, Forward, Info, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/authStore';
import { useMessageData } from '@/hooks/useMessageData';
import { useForwardMessages } from '@/hooks/useForwardMessages';
import { useChatWebSocket, type ChatWsEvent, type ChatForcedDisconnectPayload, } from '@/hooks/useChatWebSocket';
import { useChatStore } from '@/lib/chatStore';
import { editMessage, deleteMessage, addReaction, removeReaction, getMessage, getChat, pinMessage, unpinMessage, saveMessage, unsaveMessage, listPins, listSavedMessages, createScheduledMessage, listScheduledMessages, updateChatDetails, updateNotificationSettings } from '@/lib/api/chatApi';
import { buildMessagesPath } from '@/lib/messages/messagesRoutes';
import { limitName, MAX_CHANNEL_NAME_LENGTH } from '@/lib/messages/nameLimits';
import type { Chat, Message } from '@/types/chat';
import type { ScheduledMessageRow } from '@/lib/api/chatApi';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';
import type { RichSendData, SlashCommand } from './ChatComposer';
import ForwardMessagesDialog from './ForwardMessagesDialog';
import TypingIndicator from './TypingIndicator';
import ThreadPanel from './ThreadPanel';
import ChannelDetailsDrawer from './ChannelDetailsDrawer';
import ReminderPickerSheet from './ReminderPickerSheet';

interface ChatWindowProps {
  chat: Chat;
  onBack: () => void;
  roleByUserId?: Record<number, string>;
  /**
   * When true, the back button hides on the md+ viewport. Use this for the
   * full-page Messages view where the sidebar is always visible on desktop.
   * Default false — preserves the floating-widget back behavior.
   */
  hideBackOnDesktop?: boolean;
  /** Set to { chatId, seq } to imperatively open the channel details panel for that chat. */
  openDetailsSignal?: { chatId: number; seq: number };
}

export default function ChatWindow({ chat, onBack, roleByUserId, hideBackOnDesktop, openDetailsSignal }: ChatWindowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Use selector for stable reference
  const user = useAuthStore(state => state.user);
  const currentUserId = user?.id ? Number(user.id) : null;
  const myChatParticipant = currentUserId !== null
    ? chat.participants?.find((p) => p.user.id === currentUserId)
    : undefined;
  const canManageChannel = chat.type !== 'group'
    || Boolean(myChatParticipant?.is_manager || (chat.created_by_id && chat.created_by_id === currentUserId));
  const chatsByProject = useChatStore(state => state.chatsByProject);
  // Snapshot taken at click-time in setCurrentChat — immune to subsequent setChatsForProject resets
  const capturedUnreadCount = useChatStore(state => state.capturedUnreadCounts[chat.id] ?? 0);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [showSwitchLoadingSkeleton, setShowSwitchLoadingSkeleton] = useState(false);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
  // When a user jumps to a thread reply (e.g. from a pinned/saved entry), this
  // is the reply id we want ThreadPanel to highlight + scroll to. Cleared by
  // ThreadPanel itself after the highlight fades.
  const [threadHighlightMessageId, setThreadHighlightMessageId] = useState<number | null>(null);
  const [showChannelDetails, setShowChannelDetails] = useState(false);
  // Single owner of showChannelDetails: open when signal targets this chat, close otherwise.
  // Watching both deps means it fires correctly whether chat navigation and signal
  // land in the same render or in separate ones.
  useEffect(() => {
    if (openDetailsSignal && openDetailsSignal.chatId === chat.id) {
      setShowChannelDetails(true);
    } else if (!openDetailsSignal || openDetailsSignal.chatId !== chat.id) {
      setShowChannelDetails(false);
    }
  }, [chat.id, openDetailsSignal]);
  const [reminderMessageId, setReminderMessageId] = useState<number | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<number>>(new Set());
  const [pinRefreshKey, setPinRefreshKey] = useState(0);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<number>>(new Set());
  const [pendingScheduledCount, setPendingScheduledCount] = useState(0);
  const [lastScheduledMsg, setLastScheduledMsg] = useState<ScheduledMessageRow | null>(null);
  // First-time channel description banner: shown once per (user, channel) and
  // dismissed into localStorage so existing members never see it again.
  const [showDescriptionBanner, setShowDescriptionBanner] = useState(false);
  const unreadCapturedForChatRef = useRef<number | null>(null);

  // Reminder polling — check localStorage every 60 s and surface due reminders as toasts
  useEffect(() => {
    const check = () => {
      const key = 'ms_reminders';
      try {
        const all = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ messageId: number; time: number; chatId: number }>;
        const now = Date.now();
        const due = all.filter((r) => r.time <= now);
        const remaining = all.filter((r) => r.time > now);
        if (due.length > 0) {
          localStorage.setItem(key, JSON.stringify(remaining));
          due.forEach((r) => {
            toast(`⏰ Reminder: message #${r.messageId}`, { duration: 8000 });
          });
        }
      } catch { /* ignore */ }
    };
    check(); // run immediately on mount
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Refresh pending scheduled message count for badge display
  const refreshScheduledCount = useCallback(() => {
    listScheduledMessages(chat.id)
      .then((rows) => setPendingScheduledCount(rows.filter((r) => r.status === 'pending' || r.status === 'sending').length))
      .catch(() => {});
  }, [chat.id]);

  // Load pinned + saved IDs for this chat so we can show indicators on messages
  useEffect(() => {
    setPinnedMessageIds(new Set());
    setSavedMessageIds(new Set());
    setPendingScheduledCount(0);
    listPins(chat.id)
      .then((pins) => setPinnedMessageIds(new Set(pins.map((p) => p.message.id))))
      .catch(() => {});
    listSavedMessages()
      .then((saved) => setSavedMessageIds(new Set(saved.map((s) => s.message.id))))
      .catch(() => {});
    refreshScheduledCount();
  }, [chat.id, refreshScheduledCount]);

  const { forward, isForwarding } = useForwardMessages();

  const handleSocketChatMessage = useCallback((event: ChatWsEvent) => {
    if (!event.message) return;
    const rawChatId = event.message.chat_id ?? event.message.chat ?? event.chat_id;
    const messageChatId = typeof rawChatId === 'string' ? Number(rawChatId) : rawChatId;
    if (!messageChatId || Number.isNaN(messageChatId)) return;
    useChatStore.getState().addMessage(
      messageChatId,
      { ...event.message, chat_id: messageChatId },
      currentUserId ?? undefined
    );
  }, [currentUserId]);

  const handleSocketTypingIndicator = useCallback((event: ChatWsEvent) => {
    if (event.chat_id !== chat.id || !event.user_id || event.user_id === currentUserId) return;
    const { setTypingUser, clearTypingUser } = useChatStore.getState();
    if (event.is_typing) {
      setTypingUser(event.chat_id, event.user_id);
    } else {
      clearTypingUser(event.chat_id, event.user_id);
    }
  }, [chat.id, currentUserId]);

  const handleSocketMessageStatusUpdate = useCallback((event: ChatWsEvent) => {
    const messageId = Number(event.message_id);
    if (!Number.isFinite(messageId) || !event.message?.statuses) return;
    useChatStore.getState().updateMessage(messageId, {
      statuses: event.message.statuses,
    });
  }, []);

  const handleSocketReactionUpdate = useCallback((event: ChatWsEvent) => {
    const r = event.reaction;
    if (!r) return;
    useChatStore.getState().applyReactionUpdate(r.message_id, r.emoji, r.action, r.user, currentUserId);
  }, [currentUserId]);

  const handleSocketPresenceUpdate = useCallback((event: ChatWsEvent) => {
    const userId = Number(event.user_id);
    if (!Number.isFinite(userId) || typeof event.is_online !== 'boolean') return;
    useChatStore.getState().updateUserPresence(userId, event.is_online, event.version);
  }, []);

  const handleSocketPresenceSnapshot = useCallback((event: ChatWsEvent) => {
    if (!Array.isArray(event.users)) return;
    useChatStore.getState().setPresenceSnapshot(event.users);
  }, []);

  const handleSocketForcedDisconnect = useCallback((payload: ChatForcedDisconnectPayload) => {
    const chatId= Number(payload.chatId);
    if (!Number.isFinite(chatId)) return;

    const store = useChatStore.getState();
    const removedChat = Object.values(store.chatsByProject)
    .flat()
    .find((item) => Number(item.id) ===chatId);

    store.removeChat(chatId);

    if (removedChat?.type ==='group' && removedChat.name) {
      toast.error(`You were removed from #${removedChat.name}`);
    } else {
      toast.error('You were removed from this chat');
    }

    if (Number(chat.id) === chatId) {
      onBack();
    }
  }, [chat.id, onBack]);
  
  const { sendTypingStart, sendTypingStop } = useChatWebSocket(currentUserId, {
    onChatMessage: handleSocketChatMessage,
    onTypingIndicator: handleSocketTypingIndicator,
    onMessageStatusUpdate: handleSocketMessageStatusUpdate,
    onReactionUpdate: handleSocketReactionUpdate,
    onPresenceUpdate: handleSocketPresenceUpdate,
    onPresenceSnapshot: handleSocketPresenceSnapshot,
    onForcedDisconnect: handleSocketForcedDisconnect,
  });

  const {
    messages,
    isLoadingMessages,
    isLoadingMoreMessages,
    isSending,
    hasMore,
    hasFetchedInitially,
    sendRich,
    loadMoreMessages,
    markAllAsRead,
  } = useMessageData({ chatId: chat.id, autoFetch: true });
  
  // Track last message count to detect new messages
  const lastMessageCountRef = useRef<number>(0);
  const lastReadChatIdRef = useRef<number | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const jumpLoadAttemptsRef = useRef(0);
  const jumpedToMessageRef = useRef<string | null>(null);
  const resolvingMissingTargetRef = useRef<string | null>(null);
  const previousChatIdRef = useRef<number | null>(null);

  const chatProjectId = useMemo(() => {
    const rawProjectId = (chat as any).project_id ?? (chat as any).project;
    const parsed = Number(rawProjectId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [chat]);

  const availableTargetChats = useMemo(() => {
    if (!chatProjectId) return [];
    return (chatsByProject[chatProjectId] || []).filter((c) => c.id !== chat.id);
  }, [chatProjectId, chatsByProject, chat.id]);

  const mentionParticipants = useMemo(
    () => (chat.participants ?? []).filter((participant) => participant.user),
    [chat.participants],
  );

  useEffect(() => {
    setIsSelectMode(false);
    setSelectedMessageIds([]);
    setIsForwardDialogOpen(false);
    setFirstUnreadMessageId(null);
    setReplyingTo(null);
    setActiveThreadMessage(null);
    unreadCapturedForChatRef.current = null;
    jumpLoadAttemptsRef.current = 0;
    jumpedToMessageRef.current = null;
    resolvingMissingTargetRef.current = null;
  }, [chat.id]);

  // Show the channel-description banner once per (user, channel) — channels
  // only (DMs don't have descriptions), and only when a description exists.
  // Dismissed state lives in localStorage so existing members don't re-see it.
  useEffect(() => {
    setShowDescriptionBanner(false);
    if (chat.type !== 'group') return;
    const desc = chat.description?.trim();
    if (!desc) return;
    if (!currentUserId) return;
    try {
      const key = `mj:chat:descSeen:${currentUserId}:${chat.id}`;
      if (typeof window !== 'undefined' && window.localStorage.getItem(key)) return;
      setShowDescriptionBanner(true);
    } catch {
      // localStorage can throw in private mode — just show the banner.
      setShowDescriptionBanner(true);
    }
  }, [chat.id, chat.type, chat.description, currentUserId]);

  const dismissDescriptionBanner = useCallback(() => {
    setShowDescriptionBanner(false);
    if (!currentUserId) return;
    try {
      window.localStorage.setItem(
        `mj:chat:descSeen:${currentUserId}:${chat.id}`,
        '1',
      );
    } catch {
      // ignore — banner just won't persist as dismissed for this session
    }
  }, [chat.id, currentUserId]);

  useEffect(() => {
    const previousChatId = previousChatIdRef.current;
    if (previousChatId !== null && previousChatId !== chat.id) {
      setShowSwitchLoadingSkeleton(true);
    }
    previousChatIdRef.current = chat.id;
  }, [chat.id]);

  useEffect(() => {
    if (!isLoadingMessages) {
      setShowSwitchLoadingSkeleton(false);
    }
  }, [isLoadingMessages]);

  const targetMessageId = useMemo(() => {
    const raw = searchParams.get('messageId');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const targetChatId = useMemo(() => {
    const raw = searchParams.get('chatId');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const targetFileId = useMemo(() => {
    const raw = searchParams.get('fileId');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const targetJumpId = useMemo(() => {
    return searchParams.get('jumpId') || null;
  }, [searchParams]);

  // When the URL carries `threadMessageId`, it means the user jumped to a thread
  // reply from a different chat (saved/files/pinned cross-chat). `messageId` is
  // the parent root; this is the reply to highlight inside the ThreadPanel.
  const targetThreadMessageId = useMemo(() => {
    const raw = searchParams.get('threadMessageId');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const targetJumpKey = useMemo(() => {
    if (!targetMessageId) return null;
    return targetJumpId ?? `${chat.id}:${targetMessageId}:${targetFileId ?? 'message'}`;
  }, [chat.id, targetFileId, targetJumpId, targetMessageId]);

  const hasTargetMessage = useMemo(() => {
    if (!targetMessageId) return false;
    return messages.some((message) => Number(message.id) === targetMessageId);
  }, [messages, targetMessageId]);

  const jumpTarget = useMemo(() => {
    if (!targetMessageId || !targetJumpKey || !hasTargetMessage) return null;
    if (targetChatId && targetChatId !== chat.id) return null;
    if (!hasFetchedInitially || isLoadingMessages || showSwitchLoadingSkeleton) return null;
    return {
      messageId: targetMessageId,
      attachmentId: targetFileId ?? undefined,
      requestId: targetJumpKey,
    };
  }, [
    chat.id,
    hasFetchedInitially,
    hasTargetMessage,
    isLoadingMessages,
    showSwitchLoadingSkeleton,
    targetChatId,
    targetFileId,
    targetJumpKey,
    targetMessageId,
  ]);

  useEffect(() => {
    jumpLoadAttemptsRef.current = 0;
    jumpedToMessageRef.current = null;
    resolvingMissingTargetRef.current = null;
  }, [chat.id, targetMessageId, targetFileId, targetJumpId]);

  useEffect(() => {
    // If URL includes a messageId, load older history one page at a time until
    // the message exists in the rendered list, then ask MessageList to focus it.
    if (!targetMessageId) return;
    if (targetChatId && targetChatId !== chat.id) return;
    if (isLoadingMessages) return; // wait for initial load to complete
    if (showSwitchLoadingSkeleton) return; // wait until MessageList is rendering messages, not the switch skeleton

    // Don't declare "not found" until the initial fetch for this chat has completed.
    // Without this guard, stale store messages (from a previous load) can cause a false
    // "not found" result in the brief window before isFetchingMessages turns true.
    if (!hasFetchedInitially) return;

    const jumpKey = targetJumpKey ?? `${chat.id}:${targetMessageId}:${targetFileId ?? 'message'}`;

    if (hasTargetMessage) {
      if (jumpedToMessageRef.current === jumpKey) return;
      jumpedToMessageRef.current = jumpKey;
      return;
    }

    if (isLoadingMoreMessages) return;

    // Load real history pages first so deep links keep surrounding context.
    // Falling back to a single-message lookup can create a discontinuous list
    // where the target sits beside unrelated latest messages.
    if (hasMore && jumpLoadAttemptsRef.current < 20) {
      jumpLoadAttemptsRef.current += 1;
      void loadMoreMessages();
      return;
    }

    if (resolvingMissingTargetRef.current === jumpKey) return;
    resolvingMissingTargetRef.current = jumpKey;

    const clearStaleTarget = () => {
      if (jumpedToMessageRef.current === jumpKey) return;
      jumpedToMessageRef.current = jumpKey; // prevent repeated toasts on re-renders
      toast.error('Message not found — it may have been deleted.');
      const params = new URLSearchParams(searchParams.toString());
      params.delete('messageId');
      params.delete('threadMessageId');
      params.delete('fileId');
      params.delete('jumpId');
      router.replace(params.size ? `?${params.toString()}` : window.location.pathname);
    };

    // The target can be a thread reply from Files. Thread replies are not rendered in
    // the main timeline, so resolve old links to the root message before warning.
    void getMessage(targetMessageId)
      .then((target) => {
        if (target.is_revoked) {
          clearStaleTarget();
          return;
        }

        if (target.parent_message_id) {
          router.replace(
            buildMessagesPath(chat.slug, {
              messageId: target.parent_message_id,
              threadMessageId: targetMessageId,
            }),
            { scroll: false },
          );
          return;
        }

        const rawTargetChatId = target.chat_id ?? target.chat;
        const messageChatId = typeof rawTargetChatId === 'string' ? Number(rawTargetChatId) : rawTargetChatId;
        if (Number(messageChatId) !== Number(chat.id)) {
          clearStaleTarget();
          return;
        }

        useChatStore.getState().prependMessages(chat.id, [
          { ...target, chat_id: chat.id },
        ]);
      })
      .catch(clearStaleTarget);
  }, [
    chat.id,
    hasFetchedInitially,
    hasMore,
    hasTargetMessage,
    isLoadingMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    messages,
    router,
    searchParams,
    showSwitchLoadingSkeleton,
    targetChatId,
    targetFileId,
    targetJumpKey,
    targetJumpId,
    targetMessageId,
  ]);
  
  // When the URL carries `threadMessageId`, open the thread for the message at
  // `messageId` (the parent) and highlight the reply inside it. Drives the
  // cross-chat "Jump to message" from Saved/Files/Pinned for thread replies.
  useEffect(() => {
    if (!targetThreadMessageId || !targetMessageId) return;
    if (activeThreadMessage?.id === targetMessageId) {
      // Thread already open for the right parent — just set the highlight.
      if (threadHighlightMessageId !== targetThreadMessageId) {
        setThreadHighlightMessageId(targetThreadMessageId);
      }
      return;
    }
    let cancelled = false;
    void getMessage(targetMessageId)
      .then((parent) => {
        if (cancelled) return;
        setActiveThreadMessage(parent);
        setThreadHighlightMessageId(targetThreadMessageId);
        // Drop `threadMessageId` from the URL so closing the thread (or any
        // subsequent re-render) doesn't auto-re-open it.
        const params = new URLSearchParams(searchParams.toString());
        params.delete('threadMessageId');
        router.replace(params.size ? `?${params.toString()}` : window.location.pathname);
      })
      .catch(() => { /* fall through — at worst the parent jump still happens */ });

    return () => { cancelled = true; };
  }, [
    activeThreadMessage?.id,
    router,
    searchParams,
    targetMessageId,
    targetThreadMessageId,
    threadHighlightMessageId,
  ]);

  // Mark messages as read when viewing - both on open AND when new messages arrive
  useEffect(() => {
    if (!chat.id || messages.length === 0) return;

    const isOpeningChat = lastReadChatIdRef.current !== chat.id;
    if (isOpeningChat) lastReadChatIdRef.current = chat.id;

    // Get store actions
    const { updateChat, updateUnreadCount, fetchGlobalUnreadCount } = useChatStore.getState();

    // Always keep local unread count at 0 while viewing (optimistic update)
    updateChat(chat.id, { unread_count: 0 });
    updateUnreadCount(chat.id, 0);

    // Debounce the API call to avoid too many requests when messages stream in
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
    }

    // Always call the backend on first open, even if the message list came from
    // cache and its count did not grow. After that, only call when new messages arrive.
    if (isOpeningChat || messages.length > lastMessageCountRef.current) {
      markAsReadTimeoutRef.current = setTimeout(() => {
        markAllAsRead().then(() => {
          // Refetch global unread count from backend to ensure accuracy
          fetchGlobalUnreadCount();
          // Intentionally NOT clearing firstUnreadMessageId here — the divider
          // stays visible until the user closes and reopens the conversation.
        });
      }, 500); // Debounce 500ms
    }

    lastMessageCountRef.current = messages.length;
    
    // Cleanup timeout on unmount
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [chat.id, messages.length, markAllAsRead]);
  
  // When a fresh positive capturedUnreadCount arrives (e.g. setChatsForProject resolves
  // after a race, or account switch) and the divider is not currently showing, unlock
  // the capture ref so the effect below can re-run.  Must be defined BEFORE the
  // capture effect so it runs first within the same React commit.
  useEffect(() => {
    if (firstUnreadMessageId !== null) return; // Divider already visible — don't disturb it
    if (capturedUnreadCount > 0) {
      unreadCapturedForChatRef.current = null; // Unlock → let the capture effect fire
    }
  }, [chat.id, capturedUnreadCount, firstUnreadMessageId]);

  // Capture the first unread message once per chat open, before markAllAsRead fires.
  // Uses capturedUnreadCount (snapshotted at click-time in setCurrentChat, then
  // refreshed by setChatsForProject) rather than chat.unread_count.
  useEffect(() => {
    if (unreadCapturedForChatRef.current === chat.id) return;
    if (messages.length === 0) return;
    if (capturedUnreadCount > 0 && capturedUnreadCount <= messages.length) {
      const firstUnread = messages[messages.length - capturedUnreadCount];
      if (firstUnread) setFirstUnreadMessageId(firstUnread.id);
    }
    // Only lock the ref once we've seen real data (non-zero count, or confirmed 0
    // by having messages loaded — the unlock effect above will re-open it if needed).
    // Only lock once messages are actually loaded. If we locked on capturedUnreadCount > 0
    // alone (messages still empty), the effect would return early on the messages.length
    // guard above and then the ref would be locked before we could ever capture.
    if (messages.length > 0) {
      unreadCapturedForChatRef.current = chat.id;
    }
  }, [chat.id, capturedUnreadCount, messages]);

  const handleEditMessage = async (messageId: number, newContent: string) => {
    const { updateMessage } = useChatStore.getState();
    const original = messages.find((m) => m.id === messageId);
    updateMessage(messageId, { content: newContent, rich_body: null, mentioned_user_ids: [], is_edited: true });
    try {
      const updated = await editMessage(messageId, newContent, null, []);
      updateMessage(messageId, {
        content: updated.content,
        rich_body: updated.rich_body ?? null,
        mentioned_user_ids: updated.mentioned_user_ids ?? [],
        is_edited: updated.is_edited ?? true,
      });
    } catch {
      updateMessage(messageId, {
        content: original?.content ?? newContent,
        rich_body: original?.rich_body ?? null,
        mentioned_user_ids: original?.mentioned_user_ids ?? [],
        is_edited: original?.is_edited ?? false,
      });
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    const original = messages.find((message) => message.id === messageId);
    const { updateMessage, triggerFilesRefresh } = useChatStore.getState();
    updateMessage(messageId, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      content: '',
      rich_body: null,
      attachments: [],
      has_attachments: false,
      attachment_count: 0,
      reactions: [],
      mentioned_user_ids: [],
      missing_forwarded_attachments: [],
      reply_to: null,
      forwarded_from: null,
      is_edited: false,
      can_revoke: false,
    });
    try {
      const response = await deleteMessage(messageId);
      updateMessage(messageId, response.message);
      // Refresh Files tab after the backend confirms attachments should no longer be listed.
      triggerFilesRefresh();
    } catch {
      if (original) updateMessage(messageId, original);
    }
  };

  const handleReactionAdd = useCallback(async (messageId: number, emoji: string) => {
    if (!currentUserId) return;
    const { applyReactionUpdate, updateMessage } = useChatStore.getState();
    const actor = { id: currentUserId, username: user?.username ?? '' };
    applyReactionUpdate(messageId, emoji, 'added', actor, currentUserId);
    try {
      const response = await addReaction(messageId, emoji);
      updateMessage(messageId, { reactions: response.message.reactions ?? [] });
    } catch {
      applyReactionUpdate(messageId, emoji, 'removed', actor, currentUserId);
    }
  }, [currentUserId, user]);

  const handleReactionRemove = useCallback(async (messageId: number, emoji: string) => {
    if (!currentUserId) return;
    const { applyReactionUpdate, updateMessage } = useChatStore.getState();
    const actor = { id: currentUserId, username: user?.username ?? '' };
    applyReactionUpdate(messageId, emoji, 'removed', actor, currentUserId);
    try {
      const response = await removeReaction(messageId, emoji);
      updateMessage(messageId, { reactions: response.message.reactions ?? [] });
    } catch {
      applyReactionUpdate(messageId, emoji, 'added', actor, currentUserId);
    }
  }, [currentUserId, user]);

  const handleQuoteReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleForwardSingle = useCallback((messageId: number) => {
    setIsSelectMode(true);
    setSelectedMessageIds([messageId]);
    setIsForwardDialogOpen(true);
  }, []);

  const handleSendRich = async (data: RichSendData) => {
    await sendRich(
      data.content,
      data.rich_body,
      data.mention_ids,
      data.attachment_ids,
      data.reply_to_id,
    );
    setReplyingTo(null);
  };

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedMessageIds([]);
      setIsForwardDialogOpen(false);
      return;
    }
    setIsSelectMode(true);
  };

  const handleToggleSelectMessage = (messageId: number) => {
    if (!isSelectMode) return;
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  const handleOpenForwardDialog = () => {
    if (selectedMessageIds.length === 0 || isForwarding) return;
    setIsForwardDialogOpen(true);
  };

  const handleForwardSubmit = async (targetChatIds: number[], targetUserIds: number[]) => {
    if (!chatProjectId || selectedMessageIds.length === 0) return;

    const response = await forward({
      source_chat_id: chat.id,
      source_message_ids: selectedMessageIds,
      target_chat_ids: targetChatIds,
      target_user_ids: targetUserIds,
    });

    if (!response) return;

    setIsForwardDialogOpen(false);
    setSelectedMessageIds([]);
    setIsSelectMode(false);
  };

  // Get the other participant (not current user) for private chats
  const getOtherParticipant = () => {
    if (chat.type === 'group' || !chat.participants) return null;
    // Ensure numeric comparison to avoid type mismatch (user.id can be string | number | undefined)
    if (currentUserId === null) return null;
    return chat.participants.find(p => p.user.id !== currentUserId);
  };

  const otherParticipant = getOtherParticipant();
  const otherParticipantRole =
    chat.type === 'private' && otherParticipant?.user?.id
      ? roleByUserId?.[otherParticipant.user.id]
      : undefined;
  const chatName = chat.type === 'group' 
    ? limitName(chat.name || 'Group Chat', MAX_CHANNEL_NAME_LENGTH)
    : (otherParticipant?.user?.username || 'Chat');
  const handleOpenThread = useCallback((message: Message) => {
    setActiveThreadMessage((prev) => (prev?.id === message.id ? null : message));
  }, []);

  const handleChatUpdated = useCallback((updated: Chat) => {
    const updates: Partial<Chat> = {
      name: updated.name,
      topic: updated.topic,
      description: updated.description,
      visibility: updated.visibility,
    };
    if (updated.participants) {
      updates.participants = updated.participants;
    }
    useChatStore.getState().updateChat(updated.id, updates);
  }, []);

  const handlePinMessage = useCallback(async (messageId: number) => {
    const alreadyPinned = pinnedMessageIds.has(messageId);
    try {
      if (alreadyPinned) {
        await unpinMessage(chat.id, messageId);
        setPinnedMessageIds((prev) => { const next = new Set(prev); next.delete(messageId); return next; });
        setPinRefreshKey((prev) => prev + 1);
        toast.success('Message unpinned');
      } else {
        await pinMessage(chat.id, messageId);
        setPinnedMessageIds((prev) => new Set([...prev, messageId]));
        setPinRefreshKey((prev) => prev + 1);
        toast.success('Message pinned');
      }
    } catch {
      toast.error(alreadyPinned ? 'Failed to unpin message' : 'Failed to pin message');
    }
  }, [chat.id, pinnedMessageIds]);

  const handleSaveMessage = useCallback(async (messageId: number) => {
    const alreadySaved = savedMessageIds.has(messageId);
    try {
      if (alreadySaved) {
        // Find the saved record id — not stored locally; just refresh the list
        await listSavedMessages().then((saved) => {
          const record = saved.find((s) => s.message.id === messageId);
          if (record) return unsaveMessage(record.id);
        });
        setSavedMessageIds((prev) => { const next = new Set(prev); next.delete(messageId); return next; });
        toast.success('Removed from saved');
      } else {
        await saveMessage(messageId);
        setSavedMessageIds((prev) => new Set([...prev, messageId]));
        toast.success('Saved for later');
      }
    } catch {
      toast.error(alreadySaved ? 'Failed to remove saved' : 'Failed to save message');
    }
  }, [savedMessageIds]);

  const handleRemindMessage = useCallback((messageId: number) => {
    setReminderMessageId(messageId);
  }, []);

  const handleReminderConfirm = useCallback((time: Date) => {
    if (!reminderMessageId) return;
    // Store reminder in localStorage — a polling effect surfaces it as a toast
    const key = 'ms_reminders';
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ messageId: number; time: number; chatId: number }>;
      existing.push({ messageId: reminderMessageId, time: time.getTime(), chatId: chat.id });
      localStorage.setItem(key, JSON.stringify(existing));
      toast.success(`Reminder set for ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      toast.error('Failed to set reminder');
    }
    setReminderMessageId(null);
  }, [reminderMessageId, chat.id]);

  const handleScheduleSend = useCallback(async (data: RichSendData, scheduledAt: Date) => {
    if (!chatProjectId) return;
    try {
      const newMsg = await createScheduledMessage({
        chat_id: chat.id,
        content: data.content,
        rich_body: data.rich_body as object,
        mention_ids: data.mention_ids,
        attachment_ids: data.attachment_ids ?? [],
        reply_to_id: data.reply_to_id ?? null,
        scheduled_at: scheduledAt.toISOString(),
      });
      toast.success(`Message scheduled for ${scheduledAt.toLocaleString()}`);
      setLastScheduledMsg(newMsg);
      refreshScheduledCount();
    } catch (err: unknown) {
      // Surface the API validation message when available, otherwise fall back.
      const apiData = (err as any)?.response?.data;
      const apiMsg: string | undefined =
        typeof apiData?.detail === 'string' ? apiData.detail :
        typeof apiData?.scheduled_at?.[0] === 'string' ? apiData.scheduled_at[0] :
        typeof apiData?.non_field_errors?.[0] === 'string' ? apiData.non_field_errors[0] :
        typeof apiData === 'string' ? apiData :
        undefined;
      toast.error(apiMsg ?? 'Failed to schedule message');
    }
  }, [chat.id, chatProjectId, refreshScheduledCount]);

  const handleTypingStart = useCallback(() => {
    sendTypingStart(chat.id);
  }, [chat.id, sendTypingStart]);

  const handleTypingStop = useCallback(() => {
    sendTypingStop(chat.id);
  }, [chat.id, sendTypingStop]);

  // Slash commands wired for this chat
  const slashCommands = useMemo<SlashCommand[]>(() => [
    {
      name: 'topic',
      description: 'Set the channel topic  /topic <new topic>',
      onExecute: (args, clearEditor) => {
        if (!args) { toast.error('Usage: /topic <new topic>'); return; }
        updateChatDetails(chat.id, { topic: args })
          .then((updated) => {
            useChatStore.getState().updateChat(chat.id, { topic: updated.topic });
            toast.success('Topic updated');
            clearEditor();
          })
          .catch(() => toast.error('Failed to update topic'));
      },
    },
    {
      name: 'mute',
      description: 'Mute notifications for this channel',
      onExecute: (_args, clearEditor) => {
        updateNotificationSettings(chat.id, { is_muted: true })
          .then(() => { toast.success('Channel muted'); clearEditor(); })
          .catch(() => toast.error('Failed to mute channel'));
      },
    },
    {
      name: 'unmute',
      description: 'Unmute notifications for this channel',
      onExecute: (_args, clearEditor) => {
        updateNotificationSettings(chat.id, { is_muted: false })
          .then(() => { toast.success('Channel unmuted'); clearEditor(); })
          .catch(() => toast.error('Failed to unmute channel'));
      },
    },
  ], [chat.id, chatProjectId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Chat Header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <button
          onClick={onBack}
          className={[
            'rounded p-1 transition-colors hover:bg-gray-100',
            hideBackOnDesktop ? 'md:hidden' : '',
          ].join(' ')}
          aria-label="Back to chat list"
          title="Back to chat list"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3
              className="max-w-[min(42rem,55vw)] truncate font-semibold text-gray-900"
              title={chat.type === 'group' ? chat.name || 'Group Chat' : chatName}
            >
              {chatName}
            </h3>
            {chat.type === 'private' && otherParticipantRole && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex-shrink-0">
                {otherParticipantRole}
              </span>
            )}
          </div>
          {chat.type === 'group' && chat.participants && (
            <p className="truncate text-xs leading-tight text-gray-400" title={chat.topic || undefined}>
              {chat.participants.length} member{chat.participants.length !== 1 ? 's' : ''}
              {chat.topic ? ` · ${chat.topic}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Channel details toggle */}
          <button
            onClick={() => setShowChannelDetails((v) => !v)}
            className={[
              'inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition sm:px-2.5',
              showChannelDetails
                ? 'border-teal-300 bg-teal-50 text-teal-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50',
            ].join(' ')}
            aria-label="Channel details"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden min-[380px]:inline">Details</span>
          </button>

          {!isSelectMode ? (
            <button
              onClick={toggleSelectMode}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:px-2.5"
              aria-label="Select messages"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden min-[380px]:inline">Select</span>
            </button>
          ) : (
            <>
              <span className="hidden text-xs text-gray-600 min-[380px]:inline">
                {selectedMessageIds.length} selected
              </span>
              <button
                onClick={handleOpenForwardDialog}
                disabled={selectedMessageIds.length === 0 || isForwarding}
                className="inline-flex items-center gap-1 rounded-md bg-[#3CCED7] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#2AB5BD] disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5"
                aria-label="Forward selected messages"
              >
                <Forward className="w-3.5 h-3.5" />
                <span className="hidden min-[380px]:inline">Forward</span>
              </button>
              <button
                onClick={toggleSelectMode}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:px-2.5"
                aria-label="Cancel message selection"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden min-[380px]:inline">Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main area: timeline + optional thread panel side-by-side */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Timeline column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showDescriptionBanner && chat.description && (
            <div className="flex shrink-0 items-start gap-3 border-b border-[#3CCED7]/30 bg-[#3CCED7]/5 px-4 py-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3CCED7]/15 text-[#3CCED7]">
                <Info className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3CCED7]">
                  Welcome to #{chat.name || 'this channel'}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800 [overflow-wrap:anywhere]">
                  {chat.description}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissDescriptionBanner}
                className="rounded p-1 text-gray-400 transition hover:bg-white hover:text-gray-600"
                aria-label="Dismiss"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <MessageList
              key={`${chat.id}:${currentUserId ?? 'anonymous'}`}
              chatSlug={chat.slug}
              messages={messages}
              currentUserId={currentUserId ?? 0}
              onLoadMore={loadMoreMessages}
              hasMore={hasMore}
              isLoading={isLoadingMessages}
              isLoadingMoreMessages={isLoadingMoreMessages}
              showSwitchLoadingSkeleton={showSwitchLoadingSkeleton}
              roleByUserId={roleByUserId}
              isGroupChat={chat.type === 'group'}
              isSelectMode={isSelectMode}
              selectedMessageIds={selectedMessageIds}
              onToggleSelectMessage={handleToggleSelectMessage}
              firstUnreadMessageId={firstUnreadMessageId}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onReactionAdd={handleReactionAdd}
              onReactionRemove={handleReactionRemove}
              onQuoteReply={handleQuoteReply}
              onForwardSingle={handleForwardSingle}
              onEnterSelectMode={toggleSelectMode}
              onOpenThread={handleOpenThread}
              activeThreadMessageId={activeThreadMessage?.id ?? null}
              jumpTarget={jumpTarget}
              onPinMessage={canManageChannel ? handlePinMessage : undefined}
              onSaveMessage={handleSaveMessage}
              onRemindMessage={handleRemindMessage}
              pinnedMessageIds={pinnedMessageIds}
              savedMessageIds={savedMessageIds}
            />
          </div>

          {/* Typing indicator */}
          <TypingIndicator chat={chat} currentUserId={currentUserId} />

          {/* Message Composer */}
          <div className="flex-shrink-0">
            <ChatComposer
              onSendRich={handleSendRich}
              onScheduleSend={chatProjectId ? handleScheduleSend : undefined}
              scheduledCount={pendingScheduledCount}
              slashCommands={slashCommands}
              disabled={isSending || isSelectMode || isForwarding}
              chatId={chat.id}
              projectId={chatProjectId}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              replyingTo={replyingTo}
              onClearReply={() => setReplyingTo(null)}
              participants={mentionParticipants}
            />
          </div>
        </div>

        {/* Thread panel */}
        {activeThreadMessage && (
          <div className="hidden w-80 shrink-0 md:flex md:flex-col xl:w-96">
            <ThreadPanel
              rootMessage={activeThreadMessage}
              participants={mentionParticipants}
              currentUserId={currentUserId ?? undefined}
              onClose={() => {
                setActiveThreadMessage(null);
                setThreadHighlightMessageId(null);
              }}
              onForwardMessage={handleForwardSingle}
              onPinMessage={canManageChannel ? handlePinMessage : undefined}
              onSaveMessage={handleSaveMessage}
              pinnedMessageIds={pinnedMessageIds}
              savedMessageIds={savedMessageIds}
              highlightMessageId={threadHighlightMessageId}
              onHighlightCleared={() => setThreadHighlightMessageId(null)}
            />
          </div>
        )}

        {/* Channel details drawer */}
        {showChannelDetails && (
          <div className="hidden w-72 shrink-0 md:flex md:flex-col xl:w-80">
            <ChannelDetailsDrawer
              chat={chat}
              currentUserId={currentUserId ?? 0}
              onClose={() => setShowChannelDetails(false)}
              onChatUpdated={handleChatUpdated}
              onLeft={(chatId) => {
                // Drop the channel from the store (clears currentChatId if active)
                // and return to the list view.
                useChatStore.getState().removeChat(chatId);
                setShowChannelDetails(false);
                onBack();
              }}
              lastScheduledMsg={lastScheduledMsg}
              pinRefreshKey={pinRefreshKey}
              onPinRemoved={(messageId) => {
                setPinnedMessageIds((prev) => {
                  const next = new Set(prev);
                  next.delete(messageId);
                  return next;
                });
                setPinRefreshKey((prev) => prev + 1);
              }}
              onJumpToMessage={(msgId, parentMsgId) => {
                // Close the drawer so the message is visible, then fire the jump event.
                // The custom event path appends Date.now() to the requestId so every
                // click is treated as a fresh jump — avoids the completedJumpRequestRef
                // de-dup that silently skips re-jumps to the same message.
                setShowChannelDetails(false);
                if (parentMsgId) {
                  // Pinned message is a thread reply — open the thread for the
                  // parent and highlight the reply inside it. Also jump the main
                  // timeline to the parent so the user sees the source message.
                  void getMessage(parentMsgId)
                    .then((parent) => {
                      setActiveThreadMessage(parent);
                      setThreadHighlightMessageId(msgId);
                      window.dispatchEvent(
                        new CustomEvent('mj:chat:jumpToMessage', {
                          detail: { messageId: parentMsgId },
                        }),
                      );
                    })
                    .catch(() => {
                      // Fall back to jumping to the reply id directly if parent fetch fails.
                      window.dispatchEvent(
                        new CustomEvent('mj:chat:jumpToMessage', { detail: { messageId: msgId } }),
                      );
                    });
                  return;
                }
                window.dispatchEvent(
                  new CustomEvent('mj:chat:jumpToMessage', { detail: { messageId: msgId } })
                );
              }}
            />
          </div>
        )}
      </div>

      <ForwardMessagesDialog
        isOpen={isForwardDialogOpen}
        onClose={() => setIsForwardDialogOpen(false)}
        projectId={chatProjectId ? String(chatProjectId) : ''}
        availableChats={availableTargetChats}
        currentUserId={currentUserId ?? 0}
        selectedMessageCount={selectedMessageIds.length}
        isForwarding={isForwarding}
        onSubmit={handleForwardSubmit}
      />


      <ReminderPickerSheet
        open={reminderMessageId !== null}
        onOpenChange={(open) => { if (!open) setReminderMessageId(null); }}
        onConfirm={handleReminderConfirm}
      />
    </div>
  );
}
