'use client';

import { X, MessageCircle, Users, ExternalLink, Forward } from 'lucide-react';
import { buildMessagesPath } from '@/lib/messages/messagesRoutes';
import { useRouter } from 'next/navigation';
import type { Chat } from '@/types/chat';
import { useAuthStore } from '@/lib/authStore';
import { useBuildUrl } from '@/lib/buildUrl';

interface DrawerChatHeaderProps {
  chat: Chat | null;
  projectId?: number | null;
  onClose: () => void;
  isLoading?: boolean;
  // Selection mode
  isSelectMode?: boolean;
  selectedCount?: number;
  onCancelSelect?: () => void;
  onBulkForward?: () => void;
  // Typing indicator
  typingUserId?: number | null;
  fallbackName?: string;
  fallbackSubtitle?: string;
}

export default function DrawerChatHeader({
  chat,
  projectId,
  onClose,
  isLoading = false,
  isSelectMode = false,
  selectedCount = 0,
  onCancelSelect,
  onBulkForward,
  typingUserId = null,
  fallbackName = 'Conversation unavailable',
  fallbackSubtitle = '',
}: DrawerChatHeaderProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id ? Number(user.id) : null;

  // Get chat display name and info
  const getChatInfo = () => {
    if (!chat) {
      return {
        name: isLoading ? 'Loading...' : fallbackName,
        subtitle: isLoading ? '' : fallbackSubtitle,
        isPrivate: false,
      };
    }

    if (chat.type === 'group') {
      return {
        name: chat.name || 'Group Chat',
        subtitle: `${chat.participants?.length || 0} members`,
        isPrivate: false,
      };
    }

    // Private chat - find the other participant
    const otherParticipant = chat.participants?.find(
      (p) => p.user.id !== currentUserId
    );

    // Check if the other user is typing
    const isOtherUserTyping = typingUserId !== null && typingUserId !== currentUserId;

    return {
      name: otherParticipant?.user?.username || 'Direct Message',
      subtitle: isOtherUserTyping ? 'Typing...' : 'Direct Message',
      isPrivate: true,
    };
  };

  const { name, subtitle, isPrivate } = getChatInfo();

  // Navigate to full messages page
  const handleOpenFullChat = () => {
    if (!chat) return;
    router.push(buildUrl(buildMessagesPath(chat.slug)));
    onClose();
  };

  // Selection mode header
  if (isSelectMode) {
    return (
      <div className="flex-shrink-0 border-b border-gray-200 bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side: Cancel button and count */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancelSelect}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Cancel selection"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-medium">
              {selectedCount} selected
            </span>
          </div>

          {/* Right side: Bulk actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onBulkForward}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium transition-colors"
            >
              <Forward className="w-4 h-4" />
              Forward
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal header
  return (
    <div className="flex-shrink-0 border-b border-gray-200 bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-3">
      {/* Top row: Icon, Title, Close button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Chat type icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            {isPrivate ? (
              <MessageCircle className="w-5 h-5 text-white" />
            ) : (
              <Users className="w-5 h-5 text-white" />
            )}
          </div>

          {/* Chat name and subtitle */}
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <>
                <div className="h-5 w-32 bg-white/30 rounded animate-pulse" />
                <div className="h-3 w-20 bg-white/20 rounded animate-pulse mt-1" />
              </>
            ) : (
              <>
                <h3
                  className="font-semibold text-white truncate"
                  title={name}
                >
                  {name}
                </h3>
                {subtitle && (
                  <p className="text-xs text-white/80 truncate">{subtitle}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Open full chat button */}
          {chat && (
            <button
              onClick={handleOpenFullChat}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Open full chat"
              title="Open in Messages"
            >
              <ExternalLink className="w-4 h-4 text-white" />
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
