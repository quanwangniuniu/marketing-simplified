'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import type { MessageListProps } from '@/types/chat';
import { Skeleton } from '@/components/ui/skeleton';
import MessageItem from './MessageItem';

const LOADING_GROUPS = [
  {
    align: 'left',
    lines: [
      ['w-28', 'w-24', 'w-20', 'w-32'],
      ['w-32', 'w-28', 'w-24'],
    ],
  },
  {
    align: 'right',
    lines: [
      ['w-20', 'w-36', 'w-24', 'w-16', 'w-28'],
      ['w-24', 'w-32', 'w-20'],
    ],
    media: true,
  },
  {
    align: 'left',
    lines: [
      ['w-24', 'w-20', 'w-28', 'w-16', 'w-24'],
      ['w-36', 'w-24', 'w-20', 'w-28'],
    ],
  },
  {
    align: 'right',
    lines: [
      ['w-16', 'w-24', 'w-20', 'w-32'],
      ['w-28', 'w-20', 'w-24'],
    ],
  },
];

function LoadingBrickRow({
  widths,
  align = 'left',
}: {
  widths: string[];
  align?: 'left' | 'right';
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
      {widths.map((width, index) => (
        <Skeleton
          key={`${width}-${index}`}
          className={`h-7 rounded-xl ${width}`}
        />
      ))}
    </div>
  );
}

function MessageListLoadingSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const groups = compact ? LOADING_GROUPS.slice(0, 1) : LOADING_GROUPS;

  return (
    <div className={compact ? 'space-y-3 pb-3' : 'flex-1 overflow-y-auto p-4 space-y-6'}>
      {groups.map((group, groupIndex) => (
        <div
          key={`message-loading-group-${groupIndex}`}
          className="space-y-3"
        >
          {group.lines.map((line, lineIndex) => (
            <LoadingBrickRow
              key={`message-loading-line-${groupIndex}-${lineIndex}`}
              widths={line}
              align={group.align}
            />
          ))}
          {group.media ? (
            <div className={`pt-1 ${group.align === 'right' ? 'flex justify-end' : ''}`}>
              <Skeleton className="h-40 w-40 rounded-2xl" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function MessageList({
  messages,
  currentUserId,
  onLoadMore,
  hasMore,
  isLoading,
  isLoadingMoreMessages = false,
  showSwitchLoadingSkeleton = false,
  roleByUserId,
  isGroupChat = false,
  isSelectMode = false,
  selectedMessageIds = [],
  onToggleSelectMessage,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightMessageId, setHighlightMessageId] = useState<number | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const lastMessageIdRef = useRef<number | null>(null); // Track LAST message ID (newest) instead of first
  const isLoadingMoreRef = useRef(false); // Track if we're loading more (older) messages
  const scrollPositionBeforeLoadRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  useEffect(() => {
    // Listen for cross-component "jump to message" events.
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ messageId?: number }>;
      const messageId = ce.detail?.messageId;
      if (!messageId || !Number.isFinite(messageId)) return;
      setHighlightMessageId(messageId);
    };
    window.addEventListener('mj:chat:jumpToMessage', handler as EventListener);
    return () => window.removeEventListener('mj:chat:jumpToMessage', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!highlightMessageId) return;
    const el = document.getElementById(`message-${highlightMessageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = window.setTimeout(() => setHighlightMessageId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightMessageId, messages]);

  // Auto-scroll to bottom when chat changes or on initial load
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      const lastMessageId = messages[messages.length - 1]?.id;
      
      // Detect if this is a new chat by checking if the LAST (newest) message ID changed significantly
      // A new chat means we're viewing a different conversation
      const isNewChat = lastMessageIdRef.current !== null && 
                        lastMessageIdRef.current !== lastMessageId &&
                        !isLoadingMoreRef.current; // Don't scroll if we're loading more
      const isInitialLoad = lastMessageIdRef.current === null;
      
      if (isInitialLoad || isNewChat) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 50);
      }
      
      lastMessageIdRef.current = lastMessageId;
    }
  }, [messages]);

  // Maintain scroll position after loading older messages
  useEffect(() => {
    if (isLoadingMoreRef.current && scrollPositionBeforeLoadRef.current && scrollRef.current) {
      const { scrollHeight: oldScrollHeight, scrollTop: oldScrollTop } = scrollPositionBeforeLoadRef.current;
      const newScrollHeight = scrollRef.current.scrollHeight;
      const heightDiff = newScrollHeight - oldScrollHeight;
      
      // Adjust scroll position to maintain the same view
      scrollRef.current.scrollTop = oldScrollTop + heightDiff;
      
      // Reset refs
      scrollPositionBeforeLoadRef.current = null;
      isLoadingMoreRef.current = false;
    }
  }, [messages]);

  // Auto-scroll to bottom on NEW messages (if user is at bottom)
  useEffect(() => {
    const isNewMessage = messages.length > previousMessageCountRef.current;
    const wasLoadingMore = isLoadingMoreRef.current;
    previousMessageCountRef.current = messages.length;

    // Only auto-scroll for new messages at bottom, not when loading history
    if (isNewMessage && isAtBottom && scrollRef.current && !wasLoadingMore) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isAtBottom]);

  // Handle loading more (older) messages
  const handleLoadMore = useCallback(() => {
    if (scrollRef.current) {
      // Save current scroll position before loading
      scrollPositionBeforeLoadRef.current = {
        scrollHeight: scrollRef.current.scrollHeight,
        scrollTop: scrollRef.current.scrollTop,
      };
      isLoadingMoreRef.current = true;
    }
    onLoadMore();
  }, [onLoadMore]);

  // Check if user is at bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = 50;
    const isBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    setIsAtBottom(isBottom);

    // Load more when scrolled to top
    if (target.scrollTop < 100 && hasMore && !isLoading && !isLoadingMoreRef.current) {
      handleLoadMore();
    }
  };

  // Group messages by date (memoized to prevent infinite loops)
  const messageGroups = useMemo(() => {
    const groups: { date: string; messages: typeof messages }[] = [];
    
    messages.forEach((message) => {
      const messageDate = new Date(message.created_at);
      const dateStr = format(messageDate, 'yyyy-MM-dd');
      
      const existingGroup = groups.find((g) => g.date === dateStr);
      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({ date: dateStr, messages: [message] });
      }
    });
    
    return groups;
  }, [messages]);

  // Format date header
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    
    if (isSameDay(date, today)) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, yesterday)) {
      return 'Yesterday';
    }
    
    return format(date, 'MMMM d, yyyy');
  };

  const shouldShowFullSwitchSkeleton = showSwitchLoadingSkeleton && !isLoadingMoreMessages;

  return (
    <div className="h-full flex flex-col">
      {shouldShowFullSwitchSkeleton ? (
        <MessageListLoadingSkeleton />
      ) : (
        <>
      {/* Loading indicator at top */}
      {isLoadingMoreMessages && hasMore && messages.length > 0 && (
        <div className="px-4 pt-3">
          <MessageListLoadingSkeleton compact />
        </div>
      )}

      {/* Initial loading state */}
      {messages.length === 0 && isLoading && !showSwitchLoadingSkeleton && (
        <MessageListLoadingSkeleton />
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
          <p>No messages yet. Start the conversation!</p>
        </div>
      )}

      {/* Messages grouped by date */}
      {messages.length > 0 && (
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messageGroups.map((group) => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="flex justify-center mb-4">
                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                  {formatDateHeader(group.date)}
                </span>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {group.messages.map((message, index) => {
                  const prevMessage = index > 0 ? group.messages[index - 1] : null;
                  const showSender = !prevMessage || prevMessage.sender.id !== message.sender.id;
                  const senderRole = isGroupChat ? roleByUserId?.[message.sender.id] : undefined;

                  return (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isOwnMessage={message.sender.id === currentUserId}
                      showSender={showSender}
                      senderRole={senderRole}
                      isSelectMode={isSelectMode}
                      isSelected={selectedMessageIds.includes(message.id)}
                      onToggleSelect={onToggleSelectMessage}
                      isHighlighted={highlightMessageId === message.id}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
