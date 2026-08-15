'use client';

import type { DragEvent, MouseEvent, ReactNode } from 'react';
import { Bot, Hash, Pin, Star, User, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { Chat } from '@/types/chat';
import { isParticipantCurrentlyMuted } from '@/lib/chatMute';
import { useChatStore } from '@/lib/chatStore';

interface SidebarChatRowProps {
  chat: Chat;
  isActive: boolean;
  displayName: string;
  isBot?: boolean;
  isSelf?: boolean;
  currentUserId: number | null;
  onClick: () => void;
  // Star toggle (Home view only)
  showStarToggle?: boolean;
  isStarred?: boolean;
  onStarToggle?: (e: MouseEvent<HTMLElement>) => void;
  // Drag-and-drop (Home view only)
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLElement>) => void;
  onDragOver?: (e: DragEvent<HTMLElement>) => void;
  onDrop?: (e: DragEvent<HTMLElement>) => void;
  isDragging?: boolean;
  // Context menu
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
  // Test IDs
  testId?: string;
}

function compactTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return 'now';
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return format(d, 'MMM d');
  } catch {
    return '';
  }
}

function buildPreview(chat: Chat, currentUserId: number | null): ReactNode {
  if (!chat.last_message) {
    return <span className="italic text-gray-400">No messages yet</span>;
  }

  const last = chat.last_message;
  const senderId = last.sender?.id;
  const isOwn = currentUserId !== null && senderId === currentUserId;
  const isForwarded = Boolean(last.is_forwarded);
  const hasAttachments = Boolean(last.has_attachments);
  const attachmentCount = last.attachment_count ?? last.attachments?.length ?? 0;

  const rawContent = last.content?.trim()
    ? last.content
    : hasAttachments
      ? attachmentCount > 1
        ? `${attachmentCount} attachments`
        : 'Attachment'
      : '';

  const content = isForwarded ? `Forwarded: ${rawContent}` : rawContent;

  if (isOwn) {
    return <span>You: {content}</span>;
  }
  if (chat.type === 'group') {
    const sender = last.sender?.username ?? '';
    return (
      <span>
        <span className="font-medium">{sender}: </span>
        {content}
      </span>
    );
  }
  return <span>{content}</span>;
}

export default function SidebarChatRow({
  chat,
  isActive,
  displayName,
  isBot,
  isSelf,
  currentUserId,
  onClick,
  showStarToggle,
  isStarred,
  onStarToggle,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  onContextMenu,
  testId = 'messages-chat-row',
}: SidebarChatRowProps) {
  const unreadCount = chat.unread_count ?? 0;
  const hasUnread = unreadCount > 0;
  const timestamp = compactTimestamp(chat.last_message?.created_at);
  const currentParticipant = currentUserId !== null
    ? (chat.participants ?? []).find((p) => p.user.id === currentUserId)
    : undefined;
  const isMuted = isParticipantCurrentlyMuted(currentParticipant);
  const notificationLevel = currentParticipant?.notification_level ?? 'all';
  // Grey badge: muted OR set to mentions-only (non-mention unreads are low-priority)
  const isQuiet = isMuted || notificationLevel === 'mentions' || notificationLevel === 'none';
  const hasMention = (chat.mention_unread_count ?? 0) > 0;
  const hasUnseenPin = useChatStore((state) => Boolean(state.unseenPinChatIds?.[chat.id]));

  const Icon = chat.type === 'group' ? Hash : isBot ? Bot : Users;

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={isDragging ? 'opacity-60' : ''}
    >
      {/* role="button" div allows nested <button> elements (e.g. star toggle), which <button> does not */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        draggable={Boolean(draggable)}
        onDragStart={onDragStart}
        className={[
          'w-full px-2 py-1.5 flex items-start gap-2 text-left rounded-md transition-colors cursor-pointer',
          'hover:bg-gray-100 group/row',
          isActive
            ? 'bg-[#3CCED7]/10 border-l-2 border-[#3CCED7]'
            : 'border-l-2 border-transparent',
          draggable ? 'cursor-grab active:cursor-grabbing' : '',
        ].join(' ')}
        data-testid={testId}
        data-chat-id={String(chat.id)}
      >
        {/* Icon */}
        <div
          className={[
            'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded',
            isBot ? 'text-violet-500' : 'text-gray-400',
            isActive ? 'text-[#3CCED7]' : '',
          ].join(' ')}
        >
          {chat.type === 'private' && !isBot ? (
            isSelf
              ? <User className="h-4 w-4 text-[#3CCED7]" />
              : <User className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 leading-tight">
          {/* Top line: name + AI badge + timestamp */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={[
                  'truncate text-sm',
                  hasUnread ? 'font-semibold text-gray-900' : 'text-gray-700',
                  isActive ? 'text-[#0f757a]' : '',
                ].join(' ')}
              >
                {displayName}
              </span>
              {isBot && (
                <span className="flex-shrink-0 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
                  AI
                </span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              {showStarToggle && onStarToggle && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStarToggle(e);
                  }}
                  className={[
                    'rounded p-0.5 transition-opacity',
                    isStarred
                      ? 'text-amber-500 hover:text-amber-600 opacity-100'
                      : 'text-gray-400 hover:text-gray-700 opacity-0 group-hover/row:opacity-100',
                  ].join(' ')}
                  aria-label={isStarred ? 'Unstar' : 'Star'}
                  title={isStarred ? 'Unstar' : 'Star'}
                >
                  <Star className={`h-3.5 w-3.5 ${isStarred ? 'fill-current' : ''}`} />
                </button>
              )}
              {timestamp && (
                <span
                  className={[
                    'text-[11px]',
                    hasUnread && !isQuiet ? 'font-semibold text-[#3CCED7]' : 'text-gray-400',
                  ].join(' ')}
                >
                  {timestamp}
                </span>
              )}
            </div>
          </div>

          {/* Bottom line: preview + unread badge */}
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p
              className={[
                'min-w-0 flex-1 truncate text-xs',
                hasUnread ? 'text-gray-700' : 'text-gray-500',
              ].join(' ')}
            >
              {buildPreview(chat, currentUserId)}
            </p>
            <div className="flex flex-shrink-0 items-center gap-1">
              {chat.type === 'group' && hasUnseenPin && (
                <span
                  className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-teal-500 text-white shadow-sm"
                  data-testid="messages-pin-badge"
                  aria-label="New pinned message"
                  title="New pinned message"
                >
                  <Pin className="h-2.5 w-2.5 fill-current" />
                </span>
              )}
              {hasMention && (
                <span
                  className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${isMuted ? 'bg-gray-400' : 'bg-rose-500'}`}
                  data-testid="messages-mention-badge"
                  aria-label="You were mentioned"
                >
                  @
                </span>
              )}
              {hasUnread && (
                <span
                  className={[
                    'flex h-[18px] min-w-[20px] flex-shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm',
                    isQuiet ? 'bg-gray-400' : 'bg-[#3CCED7]',
                  ].join(' ')}
                  data-testid="messages-unread-badge"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
