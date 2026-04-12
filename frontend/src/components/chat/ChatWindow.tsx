'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckSquare, Forward, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import { useMessageData } from '@/hooks/useMessageData';
import { useForwardMessages } from '@/hooks/useForwardMessages';
import { useChatStore } from '@/lib/chatStore';
import type { Chat } from '@/types/chat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ForwardMessagesDialog from './ForwardMessagesDialog';

interface ChatWindowProps {
  chat: Chat;
  onBack: () => void;
  roleByUserId?: Record<number, string>;
}

export default function ChatWindow({ chat, onBack, roleByUserId }: ChatWindowProps) {
  const searchParams = useSearchParams();
  // Use selector for stable reference
  const user = useAuthStore(state => state.user);
  const chatsByProject = useChatStore(state => state.chatsByProject);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const { forward, isForwarding } = useForwardMessages();

  const {
    messages,
    isLoadingMessages,
    isSending,
    hasMore,
    send,
    sendWithAttachments,
    loadMoreMessages,
    markAllAsRead,
  } = useMessageData({ chatId: chat.id, autoFetch: true });
  
  // Track last message count to detect new messages
  const lastMessageCountRef = useRef<number>(0);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const jumpInFlightRef = useRef(false);

  const chatProjectId = useMemo(() => {
    const rawProjectId = (chat as any).project_id ?? (chat as any).project;
    const parsed = Number(rawProjectId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [chat]);

  const availableTargetChats = useMemo(() => {
    if (!chatProjectId) return [];
    return (chatsByProject[chatProjectId] || []).filter((c) => c.id !== chat.id);
  }, [chatProjectId, chatsByProject, chat.id]);

  useEffect(() => {
    setIsSelectMode(false);
    setSelectedMessageIds([]);
    setIsForwardDialogOpen(false);
  }, [chat.id]);

  useEffect(() => {
    // If URL includes a messageId, try to load history until it exists, then scroll + highlight it.
    const raw = searchParams.get('messageId');
    const targetMessageId = raw ? Number(raw) : NaN;
    if (!Number.isFinite(targetMessageId) || targetMessageId <= 0) return;
    if (jumpInFlightRef.current) return;

    jumpInFlightRef.current = true;
    const maxPages = 12; // safety cap: 12 * 50 = 600 messages
    let cancelled = false;

    (async () => {
      try {
        // Give initial fetch a moment to populate, then iteratively load older pages if needed.
        for (let i = 0; i < maxPages && !cancelled; i++) {
          const exists = useChatStore.getState().messages?.[chat.id]?.some((m) => m.id === targetMessageId);
          if (exists) break;
          if (!hasMore) break;
          // eslint-disable-next-line no-await-in-loop
          await loadMoreMessages();
        }

        if (cancelled) return;
        const exists = useChatStore.getState().messages?.[chat.id]?.some((m) => m.id === targetMessageId);
        if (!exists) return;

        window.dispatchEvent(
          new CustomEvent('mj:chat:jumpToMessage', { detail: { messageId: targetMessageId } })
        );
      } finally {
        jumpInFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      jumpInFlightRef.current = false;
    };
  }, [chat.id, searchParams, hasMore, loadMoreMessages]);
  
  // Mark messages as read when viewing - both on open AND when new messages arrive
  useEffect(() => {
    if (!chat.id || messages.length === 0) return;
      
    // Get store actions
    const { updateChat, updateUnreadCount, fetchGlobalUnreadCount } = useChatStore.getState();
    
    // Always keep local unread count at 0 while viewing (optimistic update)
    updateChat(chat.id, { unread_count: 0 });
    updateUnreadCount(chat.id, 0);
    
    // Debounce the API call to avoid too many requests when messages stream in
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
    }
    
    // Only call API if this is initial load OR new messages arrived
    if (messages.length > lastMessageCountRef.current) {
      console.log('[ChatWindow] New messages detected, scheduling markAllAsRead:', {
        chatId: chat.id,
        previousCount: lastMessageCountRef.current,
        newCount: messages.length,
      });
      
      markAsReadTimeoutRef.current = setTimeout(() => {
        markAllAsRead().then(() => {
          console.log('[ChatWindow] markAllAsRead completed for chat:', chat.id);
          // Refetch global unread count from backend to ensure accuracy
          fetchGlobalUnreadCount();
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
  
  const handleSendMessage = async (content: string) => {
    await send(content);
  };

  const handleSendWithAttachments = async (content: string, attachmentIds: number[]) => {
    await sendWithAttachments(content, attachmentIds);
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
    const currentUserId = user?.id ? Number(user.id) : null;
    if (currentUserId === null) return null;
    return chat.participants.find(p => p.user.id !== currentUserId);
  };

  const otherParticipant = getOtherParticipant();
  const otherParticipantRole =
    chat.type === 'private' && otherParticipant?.user?.id
      ? roleByUserId?.[otherParticipant.user.id]
      : undefined;
  const chatName = chat.type === 'group' 
    ? (chat.name || 'Group Chat')
    : (otherParticipant?.user?.username || 'Chat');

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0 bg-white">
        <button
          onClick={onBack}
          className="hover:bg-gray-100 rounded p-1 transition-colors"
          aria-label="Back to chat list"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {chatName}
            </h3>
            {chat.type === 'private' && otherParticipantRole && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex-shrink-0">
                {otherParticipantRole}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isSelectMode ? (
            <button
              onClick={toggleSelectMode}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Select
            </button>
          ) : (
            <>
              <span className="text-xs text-gray-600">{selectedMessageIds.length} selected</span>
              <button
                onClick={handleOpenForwardDialog}
                disabled={selectedMessageIds.length === 0 || isForwarding}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Forward className="w-3.5 h-3.5" />
                Forward
              </button>
              <button
                onClick={toggleSelectMode}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          currentUserId={user?.id ? Number(user.id) : 0}
          onLoadMore={loadMoreMessages}
          hasMore={hasMore}
          isLoading={isLoadingMessages}
          roleByUserId={roleByUserId}
          isGroupChat={chat.type === 'group'}
          isSelectMode={isSelectMode}
          selectedMessageIds={selectedMessageIds}
          onToggleSelectMessage={handleToggleSelectMessage}
        />
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0">
        <MessageInput 
          onSend={handleSendMessage} 
          onSendWithAttachments={handleSendWithAttachments}
          disabled={isSending || isSelectMode || isForwarding}
        />
      </div>

      <ForwardMessagesDialog
        isOpen={isForwardDialogOpen}
        onClose={() => setIsForwardDialogOpen(false)}
        projectId={chatProjectId ? String(chatProjectId) : ''}
        availableChats={availableTargetChats}
        currentUserId={user?.id ? Number(user.id) : 0}
        selectedMessageCount={selectedMessageIds.length}
        isForwarding={isForwarding}
        onSubmit={handleForwardSubmit}
      />
    </div>
  );
}
