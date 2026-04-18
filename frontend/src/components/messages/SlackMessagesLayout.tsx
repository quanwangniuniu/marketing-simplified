'use client';

import { useState } from 'react';
import type { Chat } from '@/types/chat';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import ProjectRail from '@/components/messages/LeftSidebar/ProjectRail';
import NavRail, { type MessagesNavView } from '@/components/messages/LeftSidebar/NavRail';
import HomeSidebar from '@/components/messages/LeftSidebar/HomeSidebar';

interface SlackMessagesLayoutProps {
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;

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
  onSelectProject,
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
      className="flex-1 overflow-hidden"
      data-testid="messages-layout"
    >
      <div className="h-full flex overflow-hidden bg-white">
        {/* Left side (Slack-like): project rail + grouped chat sidebar */}
        <div
          className={[
            'h-full border-r border-gray-200',
            // On mobile, hide the whole sidebar when a chat is open
            isMobileChatOpen ? 'hidden md:flex' : 'flex',
          ].join(' ')}
          data-testid="messages-left"
        >
          <ProjectRail
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
          />
          <NavRail active={navView} onChange={setNavView} />
          <HomeSidebar
            view={navView}
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

        {/* Main chat panel */}
        <div
          className={[
            'flex-1 flex flex-col min-w-0',
            // On mobile, only show panel when chat is open
            isMobileChatOpen ? 'flex' : 'hidden md:flex',
          ].join(' ')}
          data-testid="messages-chat-panel"
        >
          {chatPanel}
        </div>
      </div>
    </div>
  );
}

