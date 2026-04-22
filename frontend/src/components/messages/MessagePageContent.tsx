'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import { useChatStore } from '@/lib/chatStore';
import { useChatData } from '@/hooks/useChatData';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useProjectMemberRoles } from '@/hooks/useProjectMemberRoles';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import ProjectSelector from './ProjectSelector';
import ChatWindow from '@/components/chat/ChatWindow';
import CreateChatDialog from '@/components/chat/CreateChatDialog';
import SlackMessagesLayout from '@/components/messages/SlackMessagesLayout';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';

interface MessagePageContentProps {
  loading?: boolean;
}

export default function MessagePageContent({
  loading = false,
}: MessagePageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore(state => state.user);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateChannelDialogOpen, setIsCreateChannelDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Ensure userId is a number for consistent comparison in addMessage
  const userId = user?.id ? Number(user.id) : null;
  
  // Chat store state
  const currentChatId = useChatStore(state => state.currentChatId);
  const setCurrentChat = useChatStore(state => state.setCurrentChat);
  const chatsByProject = useChatStore(state => state.chatsByProject);
  // Get chats for the selected project only (independent from widget)
  const chats = useMemo(
    () => (selectedProjectId ? (chatsByProject[selectedProjectId] || []) : []),
    [chatsByProject, selectedProjectId]
  );

  const { roleByUserId } = useProjectMemberRoles(selectedProjectId);
  const { members: projectMembers, isLoading: isLoadingMembers } = useProjectMembers(selectedProjectId);
  
  // Fetch chats for selected project
  const { fetchChats, createNewChat, isLoading } = useChatData({
    projectId: selectedProjectId || undefined,
    autoFetch: false,
  });
  const delayedChatLoading = useMinimumLoading(isLoading);
  
  // Connect to WebSocket for real-time updates
  const { connected } = useChatSocket(userId, {
    enabled: !loading,
    onMessage: (message) => {
      console.log('[MessagePage] New message received:', message);
    },
    onOpen: () => {
      console.log('[MessagePage] WebSocket connected');
    },
    onClose: () => {
      console.warn('[MessagePage] WebSocket disconnected');
    },
  });
  
  // Fetch chats when project changes or WebSocket connects
  // Combined into one effect to prevent duplicate fetches
  const hasFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const projectIdParam = searchParams.get('projectId');
    const chatIdParam = searchParams.get('chatId');
    const projectIdFromQuery = projectIdParam ? Number(projectIdParam) : NaN;
    const chatIdFromQuery = chatIdParam ? Number(chatIdParam) : NaN;

    if (
      Number.isFinite(projectIdFromQuery) &&
      projectIdFromQuery > 0 &&
      projectIdFromQuery !== selectedProjectId
    ) {
      setSelectedProjectId(projectIdFromQuery);
    }

    if (
      Number.isFinite(chatIdFromQuery) &&
      chatIdFromQuery > 0 &&
      chatIdFromQuery !== currentChatId
    ) {
      setCurrentChat(chatIdFromQuery);
    }
  }, [currentChatId, loading, searchParams, selectedProjectId, setCurrentChat]);

  const replaceMessagesQuery = useCallback(
    (next: { projectId?: number | null; chatId?: number | null; messageId?: number | null }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (next.projectId === null) params.delete('projectId');
      else if (typeof next.projectId === 'number' && Number.isFinite(next.projectId) && next.projectId > 0) {
        params.set('projectId', String(next.projectId));
      }

      if (next.chatId === null) params.delete('chatId');
      else if (typeof next.chatId === 'number' && Number.isFinite(next.chatId) && next.chatId > 0) {
        params.set('chatId', String(next.chatId));
      }

      if (next.messageId === null) params.delete('messageId');
      else if (typeof next.messageId === 'number' && Number.isFinite(next.messageId) && next.messageId > 0) {
        params.set('messageId', String(next.messageId));
      }

      const query = params.toString();
      router.replace(query ? `/messages?${query}` : '/messages');
    },
    [router, searchParams]
  );
  
  useEffect(() => {
    if (selectedProjectId) {
      // Only fetch if we haven't fetched for this project yet, or if WebSocket just connected
      const fetchKey = `${selectedProjectId}-${connected}`;
      if (hasFetchedRef.current !== fetchKey) {
        hasFetchedRef.current = fetchKey;
        console.log('[MessagePage] Fetching chats for project:', selectedProjectId, 'connected:', connected);
        fetchChats();
      }
    }
  }, [connected, selectedProjectId, fetchChats]);
  
  // Get current chat from store
  const currentChat = chats.find(chat => chat.id === currentChatId);
  
  // Filter chats by search query
  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Search by chat name
    if (chat.name?.toLowerCase().includes(query)) return true;
    
    // Search by participant names
    const participantMatch = chat.participants.some(p => 
      p.user.username?.toLowerCase().includes(query) ||
      p.user.email?.toLowerCase().includes(query)
    );
    if (participantMatch) return true;
    
    // Search by last message content
    if (chat.last_message?.content.toLowerCase().includes(query)) return true;
    
    return false;
  });
  
  const handleSelectProject = useCallback((projectId: number) => {
    setSelectedProjectId(projectId);
    // Clear current chat when switching projects
    setCurrentChat(null);
    replaceMessagesQuery({ projectId, chatId: null, messageId: null });
  }, [replaceMessagesQuery, setCurrentChat]);
  
  const handleSelectChat = (chatId: number) => {
    setCurrentChat(chatId);
    replaceMessagesQuery({
      projectId: selectedProjectId,
      chatId,
      messageId: null,
    });
  };
  
  const handleBackToList = () => {
    setCurrentChat(null);
    replaceMessagesQuery({
      projectId: selectedProjectId,
      chatId: null,
      messageId: null,
    });
  };
  
  const handleCreateChat = () => {
    if (loading) return;
    setIsCreateDialogOpen(true);
  };

  const handleCreateChannel = () => {
    if (loading) return;
    setIsCreateChannelDialogOpen(true);
  };
  
  const handleChatCreated = (chatId: number) => {
    setIsCreateDialogOpen(false);
    setCurrentChat(chatId);
    replaceMessagesQuery({ projectId: selectedProjectId, chatId, messageId: null });
    // Refresh chats to include the new one
    fetchChats();
  };

  const handleChannelCreated = (chatId: number) => {
    setIsCreateChannelDialogOpen(false);
    setCurrentChat(chatId);
    replaceMessagesQuery({ projectId: selectedProjectId, chatId, messageId: null });
    fetchChats();
  };

  const handleStartDM = useCallback(async (targetUserId: number) => {
    if (!selectedProjectId) return;

    // Check if a DM thread already exists with this user
    const existingChat = chats.find(
      (c) =>
        c.type === 'private' &&
        c.participants?.some((p) => p.user.id === targetUserId)
    );

    if (existingChat) {
      setCurrentChat(existingChat.id);
      replaceMessagesQuery({ projectId: selectedProjectId, chatId: existingChat.id, messageId: null });
      return;
    }

    try {
      const newChat = await createNewChat({
        type: 'private',
        project_id: selectedProjectId,
        participant_ids: [targetUserId],
      });
      setCurrentChat(newChat.id);
      replaceMessagesQuery({ projectId: selectedProjectId, chatId: newChat.id, messageId: null });
    } catch {
      // createNewChat already shows a toast on error
    }
  }, [selectedProjectId, chats, createNewChat, setCurrentChat, replaceMessagesQuery]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div
        className="bg-white border-b border-gray-200 px-6 py-4"
        data-testid="messages-header"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-[#3CCED7]" />
              <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            </div>
            
            {/* Project Selector */}
            <ProjectSelector
              loading={loading}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
            />
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent text-sm"
            data-testid="messages-search"
          />
        </div>
      </div>
      
      <SlackMessagesLayout
        loadingProjects={loading}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        chats={filteredChats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onCreateChannel={handleCreateChannel}
        roleByUserId={roleByUserId}
        isLoadingChats={isLoading}
        projectMembers={projectMembers}
        isLoadingMembers={isLoadingMembers}
        onStartDM={handleStartDM}
        chatListEmptyState={
          !selectedProjectId ? (
            <div className="flex items-center justify-center p-6 text-center">
              <div>
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Select a project to view chats</p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-gray-500">No chats yet</div>
          )
        }
        chatPanel={
          !selectedProjectId ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Select a project to start
                </h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  Choose a project from the dropdown above to view and manage your team conversations.
                </p>
              </div>
            </div>
          ) : !currentChat ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Select a conversation
                </h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  Choose a chat from the list or start a new conversation with your team members.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full" data-testid="messages-chat-window">
              <ChatWindow
                chat={currentChat}
                onBack={handleBackToList}
                roleByUserId={roleByUserId}
              />
            </div>
          )
        }
      />
      
      {/* Create Chat Dialog */}
      {selectedProjectId && (
        <>
          <CreateChatDialog
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            projectId={String(selectedProjectId)}
            onChatCreated={handleChatCreated}
          />
          <CreateChatDialog
            isOpen={isCreateChannelDialogOpen}
            onClose={() => setIsCreateChannelDialogOpen(false)}
            projectId={String(selectedProjectId)}
            onChatCreated={handleChannelCreated}
            variant="channel"
          />
        </>
      )}
    </div>
  );
}
