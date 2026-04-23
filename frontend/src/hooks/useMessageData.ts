'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useChatStore } from '@/lib/chatStore';
import { getMessages, sendMessage, markMessageAsRead, markChatAsRead } from '@/lib/api/chatApi';
import type { SendMessageRequest, Message } from '@/types/chat';
import toast from 'react-hot-toast';

// Empty array constant to avoid creating new references
const EMPTY_MESSAGES: Message[] = [];

interface UseMessageDataOptions {
  chatId?: number | null;
  autoFetch?: boolean;
  limit?: number;
}

export function useMessageData(options: UseMessageDataOptions = {}) {
  const { chatId, autoFetch = true, limit = 50 } = options;
  
  // Get messages for current chat - use stable selector
  const allMessages = useChatStore(state => state.messages);
  const currentMessages = useMemo(() => {
    if (!chatId) return EMPTY_MESSAGES;
    return allMessages[chatId] || EMPTY_MESSAGES;
  }, [chatId, allMessages]);
  
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingMessages = isFetchingMessages || isLoadingMoreMessages;

  // Fetch messages for current chat
  const fetchMessages = useCallback(async (chatIdToFetch?: number) => {
    const targetChatId = chatIdToFetch || chatId;
    if (!targetChatId) return;
    
    const { setMessages } = useChatStore.getState();
    
    try {
      setIsFetchingMessages(true);
      setError(null);

      const response = await getMessages({
        chat_id: targetChatId,
        limit,
      });
      
      setMessages(targetChatId, response.results);
      // prev_cursor indicates there are older messages available
      setHasMore(!!response.prev_cursor || response.results.length === limit);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Failed to load messages';
      setError(errorMsg);
      console.error('Error fetching messages:', err);
      toast.error(errorMsg);
    } finally {
      setIsFetchingMessages(false);
    }
  }, [chatId, limit]);

  // Load more (older) messages
  const loadMoreMessages = useCallback(async () => {
    if (!chatId || !hasMore || isLoadingMessages) return;
    
    const { prependMessages } = useChatStore.getState();
    
    try {
      setIsLoadingMoreMessages(true);
      setError(null);
      
      // Get the oldest message's timestamp for cursor-based pagination
      const oldestMessage = currentMessages.length > 0 ? currentMessages[0] : null;
      const beforeTimestamp = oldestMessage?.created_at;
      
      const response = await getMessages({
        chat_id: chatId,
        before: beforeTimestamp, // Use timestamp instead of ID
        limit,
      });
      
      if (response.results.length > 0) {
        prependMessages(chatId, response.results);
      }
      // Check if there are more messages (prev_cursor indicates more older messages)
      setHasMore(!!response.prev_cursor || response.results.length === limit);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Failed to load more messages';
      setError(errorMsg);
      console.error('Error loading more messages:', err);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [chatId, hasMore, isLoadingMessages, currentMessages, limit]);

  // Send new message
  const send = useCallback(async (content: string): Promise<Message | null> => {
    if (!chatId || !content.trim()) return null;
    
    const { addMessage } = useChatStore.getState();
    
    try {
      setIsSending(true);
      setError(null);
      
      const data: SendMessageRequest = {
        chat_id: chatId,
        content: content.trim(),
      };
      
      const newMessage = await sendMessage(data);
      
      // Add to store (if not already added by WebSocket)
      addMessage(chatId, newMessage);
      
      return newMessage;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Failed to send message';
      setError(errorMsg);
      console.error('Error sending message:', err);
      toast.error(errorMsg);
      return null;
    } finally {
      setIsSending(false);
    }
  }, [chatId]);

  // Send message with attachments
  const sendWithAttachments = useCallback(async (
    content: string, 
    attachmentIds: number[]
  ): Promise<Message | null> => {
    if (!chatId) return null;
    // Must have content OR attachments
    if (!content.trim() && attachmentIds.length === 0) return null;
    
    const { addMessage } = useChatStore.getState();
    
    try {
      setIsSending(true);
      setError(null);
      
      const data: SendMessageRequest = {
        chat_id: chatId,
        content: content.trim() || '', // Allow empty content if attachments exist
        attachment_ids: attachmentIds,
      };
      
      const newMessage = await sendMessage(data);
      
      // Add to store (if not already added by WebSocket)
      addMessage(chatId, newMessage);
      
      return newMessage;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Failed to send message';
      setError(errorMsg);
      console.error('Error sending message with attachments:', err);
      toast.error(errorMsg);
      return null;
    } finally {
      setIsSending(false);
    }
  }, [chatId]);

  // Mark message as read
  const markAsRead = useCallback(async (messageId: number) => {
    const { updateMessage } = useChatStore.getState();
    
    try {
      const updatedMessage = await markMessageAsRead(messageId);
      updateMessage(messageId, updatedMessage);
    } catch (err: any) {
      console.error('Error marking message as read:', err);
      // Don't show toast for read errors (not critical)
    }
  }, []);

  // Mark all messages in chat as read (uses efficient backend endpoint)
  const markAllAsRead = useCallback(async () => {
    if (!chatId) return;
    
    console.log('[useMessageData] markAllAsRead called for chat:', chatId);
    
    try {
      await markChatAsRead(chatId);
      console.log('[useMessageData] markAllAsRead success for chat:', chatId);
    } catch (err: any) {
      console.error('[useMessageData] Error marking chat as read:', chatId, err);
      // Don't show toast for read errors (not critical)
    }
  }, [chatId]);

  // Auto-fetch messages when chat changes
  useEffect(() => {
    if (autoFetch && chatId) {
      fetchMessages();
      setHasMore(true); // Reset pagination
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, chatId]); // Don't include fetchMessages to avoid infinite loop

  return {
    messages: currentMessages,
    isLoadingMessages,
    isLoadingMoreMessages,
    isSending,
    hasMore,
    error,
    fetchMessages,
    loadMoreMessages,
    send,
    sendWithAttachments,
    markAsRead,
    markAllAsRead,
  };
}
