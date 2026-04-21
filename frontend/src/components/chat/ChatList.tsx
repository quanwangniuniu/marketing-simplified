'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatListProps, Chat } from '@/types/chat';
import ChatListItem from './ChatListItem';
import EmptyChatState from './EmptyChatState';

const AGENT_BOT_EMAIL = 'agent-bot@system.local';

function isBotChat(chat: Chat): boolean {
  return chat.participants?.some(p => p.user.email === AGENT_BOT_EMAIL) ?? false;
}

export default function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  roleByUserId,
}: ChatListProps) {
  // Pin bot chats to the top of the list
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aBot = isBotChat(a) ? 0 : 1;
      const bBot = isBotChat(b) ? 0 : 1;
      return aBot - bBot;
    });
  }, [chats]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat List */}
      <ScrollArea className="flex-1">
        {sortedChats.length === 0 ? (
          <EmptyChatState onCreateChat={onCreateChat} />
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === currentChatId}
                onClick={() => onSelectChat(chat.id)}
                roleByUserId={roleByUserId}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create Chat Button */}
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={onCreateChat}
          className="w-full bg-[#3CCED7] hover:bg-[#2AB5BD] text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>
    </div>
  );
}


