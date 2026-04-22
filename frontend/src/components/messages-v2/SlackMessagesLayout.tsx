'use client';

import { useState } from 'react';
import type { Chat } from '@/types/chat';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import type { MessagesNavView } from '@/components/messages-v2/LeftSidebar/NavRail';
import HomeSidebar from '@/components/messages-v2/LeftSidebar/HomeSidebar';

interface SlackMessagesLayoutProps {
  selectedProjectId: number | null;

  chats: Chat[];
  currentChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onCreateChat: () => void;
  onCreateChannel: () => void;

  isLoadingChats: boolean;
  chatListEmptyState: React.ReactNode;
  roleByUserId?: Record<number, string>;

  projectMembers: ProjectMemberData[];
  isLoadingMembers: boolean;
  onStartDM: (userId: number) => void;

  chatPanel: React.ReactNode;
}

export default function SlackMessagesLayout({
  selectedProjectId,
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  onCreateChannel,
  isLoadingChats,
  chatListEmptyState,
  roleByUserId,
  projectMembers,
  isLoadingMembers,
  onStartDM,
  chatPanel,
}: SlackMessagesLayoutProps) {
  const isMobileChatOpen = Boolean(currentChatId);
  const [navView, setNavView] = useState<MessagesNavView>('home');

  return (
    <div
      className="flex-1 min-h-0 overflow-hidden flex bg-white"
      data-testid="messages-layout"
    >
      {/* Single inline sidebar (288px) — drop ProjectRail + vertical NavRail */}
      <div
        className={[
          'h-full w-72 shrink-0 border-r border-gray-200 flex flex-col',
          isMobileChatOpen ? 'hidden md:flex' : 'flex',
        ].join(' ')}
        data-testid="messages-left"
      >
        <HomeSidebar
          view={navView}
          onChangeView={setNavView}
          selectedProjectId={selectedProjectId}
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={onSelectChat}
          onCreateChat={onCreateChat}
          onCreateChannel={onCreateChannel}
          isLoading={isLoadingChats}
          emptyState={chatListEmptyState}
          roleByUserId={roleByUserId}
          projectMembers={projectMembers}
          isLoadingMembers={isLoadingMembers}
          onStartDM={onStartDM}
        />
      </div>

      {/* Main chat panel — flex-1 full-bleed */}
      <div
        className={[
          'flex-1 flex flex-col min-w-0',
          isMobileChatOpen ? 'flex' : 'hidden md:flex',
        ].join(' ')}
        data-testid="messages-chat-panel"
      >
        {chatPanel}
      </div>
    </div>
  );
}
