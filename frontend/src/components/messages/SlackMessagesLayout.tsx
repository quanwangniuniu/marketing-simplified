'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Chat } from '@/types/chat';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import type { MessagesNavView } from '@/components/messages/LeftSidebar/NavRail';
import HomeSidebar from '@/components/messages/LeftSidebar/HomeSidebar';

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
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
  mobileSidebarHeader?: React.ReactNode;
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
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  mobileSidebarHeader,
}: SlackMessagesLayoutProps) {
  const [navView, setNavView] = useState<MessagesNavView>('home');

  const sidebarContent = (
    <HomeSidebar
      view={navView}
      onChangeView={setNavView}
      selectedProjectId={selectedProjectId}
      chats={chats}
      currentChatId={currentChatId}
      onSelectChat={(chatId) => {
        onSelectChat(chatId);
        onMobileSidebarOpenChange(false);
      }}
      onCreateChat={onCreateChat}
      onCreateChannel={onCreateChannel}
      isLoading={isLoadingChats}
      emptyState={chatListEmptyState}
      roleByUserId={roleByUserId}
      projectMembers={projectMembers}
      isLoadingMembers={isLoadingMembers}
      onStartDM={(userId) => {
        onStartDM(userId);
        onMobileSidebarOpenChange(false);
      }}
    />
  );

  return (
    <div
      className="flex-1 min-h-0 overflow-hidden flex bg-white"
      data-testid="messages-layout"
    >
      {/* Desktop sidebar */}
      <div
        className="hidden h-full w-72 shrink-0 border-r border-gray-200 md:flex md:flex-col"
        data-testid="messages-left"
      >
        {sidebarContent}
      </div>

      {/* Mobile sidebar sheet */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[10000] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40"
            aria-label="Close conversations"
            onClick={() => onMobileSidebarOpenChange(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(22rem,calc(100vw-2rem))] flex-col bg-white shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2">
              <div className="min-w-0 flex-1">{mobileSidebarHeader}</div>
              <button
                type="button"
                onClick={() => onMobileSidebarOpenChange(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close conversations"
                title="Close conversations"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* Main chat panel */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        data-testid="messages-chat-panel"
      >
        {chatPanel}
      </div>
    </div>
  );
}
