'use client';

import { useState } from 'react';
import { Users, User, Bot, ChevronDown, Trash2, Star } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { ChatListItemProps } from '@/types/chat';
import { useAuthStore } from '@/lib/authStore';
import { useChatStore } from '@/lib/chatStore';
import { deleteChat } from '@/lib/api/chatApi';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import toast from 'react-hot-toast';

export default function ChatListItem({
  chat,
  isActive,
  onClick,
  roleByUserId,
  showStarToggle,
  isStarred,
  onStarToggle,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: ChatListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLeavingChat, setIsLeavingChat] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  // Use selector for stable reference
  const currentUser = useAuthStore(state => state.user);
  const removeChat = useChatStore(state => state.removeChat);
  
  // Get the other participant (not current user) for private chats
  const getOtherParticipant = () => {
    if (chat.type === 'group' || !chat.participants) return null;
    const userId = currentUser?.id ? Number(currentUser.id) : null;
    if (userId === null) return null;
    return chat.participants.find(p => p.user.id !== userId);
  };
  
  const otherParticipant = getOtherParticipant();
  const isBot = otherParticipant?.user?.email === 'agent-bot@system.local'
    || otherParticipant?.user?.username === 'agent-bot';
  const otherParticipantRole =
    chat.type === 'private' && otherParticipant?.user?.id && !isBot
      ? roleByUserId?.[otherParticipant.user.id]
      : undefined;

  const normalizeLastMessageContent = (content: string, isForwarded: boolean) => {
    return isForwarded ? `Forwarded: ${content}` : content;
  };

  const getAttachmentPreviewText = (attachmentCount: number) => {
    return attachmentCount > 1 ? `${attachmentCount} attachments` : 'Attachment';
  };
  
  // Get chat display name
  const getChatName = () => {
    if (chat.type === 'group') {
      return chat.name || 'Group Chat';
    }
    if (isBot) return 'AI Agent';
    return otherParticipant?.user?.username || 'Private Chat';
  };
  
  // Get last message preview
  const getLastMessagePreview = () => {
    if (!chat.last_message) {
      return <span className="text-gray-400 italic">No messages yet</span>;
    }
    
    const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
    const senderId = chat.last_message.sender.id;
    const isOwnMessage = currentUserId !== null && senderId === currentUserId;
    const isForwarded = Boolean(chat.last_message.is_forwarded);
    const hasAttachments = Boolean(chat.last_message.has_attachments);
    const attachmentCount =
      chat.last_message.attachment_count ?? chat.last_message.attachments?.length ?? 0;
    const content = chat.last_message.content?.trim()
      ? chat.last_message.content
      : (hasAttachments ? getAttachmentPreviewText(attachmentCount) : chat.last_message.content);
    const normalizedContent = normalizeLastMessageContent(content, isForwarded);
    
    if (isOwnMessage) {
      const preview = normalizedContent.length > 30 ? `${normalizedContent.substring(0, 30)}...` : normalizedContent;
      return <span className="text-gray-500">You: {preview}</span>;
    }
    
    const sender = chat.last_message.sender.username;
    const preview = normalizedContent.length > 30 ? `${normalizedContent.substring(0, 30)}...` : normalizedContent;
    
    return (
      <span className="text-gray-600">
        {chat.type === 'group' && <span className="font-medium">{sender}: </span>}
        {preview}
      </span>
    );
  };
  
  // Get formatted timestamp
  const getTimestamp = () => {
    if (!chat.last_message) return '';
    
    try {
      return formatDistanceToNow(new Date(chat.last_message.created_at), { addSuffix: true });
    } catch {
      return '';
    }
  };
  
  // Get detailed timestamp for expanded view
  const getDetailedTimestamp = () => {
    if (!chat.last_message) return 'No activity';
    
    try {
      return format(new Date(chat.last_message.created_at), 'MMM d, yyyy h:mm a');
    } catch {
      return '';
    }
  };
  
  // Handle expand toggle (don't trigger onClick)
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const performLeaveChat = async () => {
    try {
      setIsLeavingChat(true);
      await deleteChat(chat.id);
      removeChat(chat.id);
      toast.success(chat.type === 'group' ? 'Left group chat' : 'Chat deleted');
    } catch (error: any) {
      const errorData = error?.response?.data;
      const errorMsg =
        (typeof errorData === 'string' && errorData) ||
        errorData?.detail ||
        errorData?.error ||
        'Failed to delete chat';
      toast.error(errorMsg);
    } finally {
      setIsLeavingChat(false);
    }
  };

  const handleLeaveChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLeavingChat) return;
    setIsConfirmOpen(true);
  };

  const confirmMessage = chat.type === 'group'
    ? 'Leave this group chat? You can be added back later by another participant.'
    : 'Delete this private chat for yourself? The other participant will still keep their copy.';
  const confirmLabel = chat.type === 'group' ? 'Leave Group' : 'Delete Chat';
  
  // Get initials for avatar
  const getInitials = () => {
    if (chat.type === 'group') return null;
    const name = otherParticipant?.user?.username || '';
    return name.charAt(0).toUpperCase();
  };

  return (
    <>
      <div
        draggable={Boolean(draggable)}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`transition-all duration-200 ${
          isActive ? 'bg-[#3CCED7]/10 border-l-4 border-[#3CCED7]' : 'hover:bg-gray-50 border-l-4 border-transparent'
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* Main Row - use div instead of button to avoid nested buttons */}
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
          className="w-full p-3 text-left cursor-pointer"
        >
          <div className="flex items-start gap-3">
            {/* Avatar with Online Status */}
            <div className="flex-shrink-0 relative">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isBot
                  ? 'bg-gradient-to-br from-violet-500 to-violet-600'
                  : chat.type === 'group'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                    : 'bg-gradient-to-br from-[#3CCED7] to-[#3CCED7]'
              } text-white font-semibold text-lg shadow-sm`}>
                {isBot ? (
                  <Bot className="w-6 h-6" />
                ) : chat.type === 'group' ? (
                  <Users className="w-6 h-6" />
                ) : getInitials() ? (
                  <span>{getInitials()}</span>
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header: Name + Timestamp */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className={`font-semibold truncate ${
                    isActive ? 'text-[#0f757a]' : 'text-gray-900'
                  }`}>
                    {getChatName()}
                  </h3>
                  {isBot && (
                    <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded flex-shrink-0">
                      AI
                    </span>
                  )}
                  {chat.type === 'private' && otherParticipantRole && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex-shrink-0">
                      {otherParticipantRole}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {showStarToggle && onStarToggle && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStarToggle(e);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isStarred
                          ? 'text-amber-500 hover:bg-amber-50'
                          : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                      }`}
                      aria-label={isStarred ? 'Remove from starred' : 'Add to starred'}
                      title={isStarred ? 'Remove from starred' : 'Add to starred'}
                    >
                      <Star className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
                    </button>
                  )}
                  {chat.last_message && (
                    <span className="text-xs text-gray-500">
                      {getTimestamp()}
                    </span>
                  )}
                </div>
              </div>

              {/* Last Message + Unread Count + Expand */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm truncate flex-1">
                  {getLastMessagePreview()}
                </p>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Unread Badge - only show when count > 0 */}
                  {(chat.unread_count ?? 0) > 0 && (
                    <span className="bg-[#3CCED7] text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 shadow-sm">
                      {chat.unread_count! > 99 ? '99+' : chat.unread_count}
                    </span>
                  )}
                  
                  {/* Expand Button */}
                  <button
                    onClick={handleExpandClick}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown 
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 ml-[60px] border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
            {/* Chat Type */}
            <div className="flex items-center gap-2 py-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                chat.type === 'group' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-[#3CCED7]/15 text-[#1a9ba3]'
              }`}>
                {chat.type === 'group' ? (
                  <>
                    <Users className="w-3 h-3" />
                    Group Chat
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3" />
                    Private Chat
                  </>
                )}
              </span>
            </div>
            
            {/* Participants (for group chats) */}
            {chat.type === 'group' && chat.participants && (
              <div className="py-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">
                  {chat.participants.length} participant{chat.participants.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {chat.participants.slice(0, 5).map((participant) => (
                    <div 
                      key={participant.id}
                      className="px-2 py-1 bg-gray-100 rounded-full text-xs"
                    >
                      <span className="text-gray-700 truncate max-w-[80px]">
                        {participant.user.username}
                      </span>
                    </div>
                  ))}
                  {chat.participants.length > 5 && (
                    <span className="text-xs text-gray-500 px-2 py-1">
                      +{chat.participants.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* For private chats - show other participant details */}
            {chat.type === 'private' && otherParticipant && (
              <div className="py-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {otherParticipant.user.email}
                </p>
              </div>
            )}
            
            {/* Last Activity */}
            <div className="py-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Last activity: {getDetailedTimestamp()}
              </p>
            </div>

            {/* Dangerous Action */}
            <div className="py-2 border-t border-gray-100">
              <button
                onClick={handleLeaveChat}
                disabled={isLeavingChat}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-red-300 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={chat.type === 'group' ? 'Leave group chat' : 'Delete private chat'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isLeavingChat
                  ? 'Working...'
                  : chat.type === 'group'
                    ? 'Leave Group'
                    : 'Delete Chat'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        type="danger"
        title={chat.type === 'group' ? 'Leave group chat?' : 'Delete chat?'}
        message={confirmMessage}
        confirmText={confirmLabel}
        cancelText="Cancel"
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          if (isLeavingChat) return;
          setIsConfirmOpen(false);
          void performLeaveChat();
        }}
      />
    </>
  );
}
