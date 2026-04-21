'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Minus, Maximize2, ChevronDown, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/chatStore';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';
import { useProjectMemberRoles } from '@/hooks/useProjectMemberRoles';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import CreateChatDialog from './CreateChatDialog';

interface ChatWidgetWindowProps {
  projectId?: string;
}

export default function ChatWidgetWindow({ projectId }: ChatWidgetWindowProps) {
  const router = useRouter();
  
  // Use selectors to get widget-specific state (independent from Messages page)
  const closeWidget = useChatStore(state => state.closeWidget);
  const widgetView = useChatStore(state => state.widgetView);
  const widgetChatId = useChatStore(state => state.widgetChatId);
  const setWidgetChat = useChatStore(state => state.setWidgetChat);
  const setMessagePageOpen = useChatStore(state => state.setMessagePageOpen);
  const widgetProjectId = useChatStore(state => state.widgetProjectId);
  const setWidgetProjectId = useChatStore(state => state.setWidgetProjectId);
  const chatsByProject = useChatStore(state => state.chatsByProject);
  // Get chats for the widget's selected project only (independent from Messages page)
  const chats = widgetProjectId ? (chatsByProject[widgetProjectId] || []) : [];

  const { roleByUserId } = useProjectMemberRoles(widgetProjectId);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Fetch projects for selector
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const fetchedProjects = await ProjectAPI.getProjects();
        setProjects(fetchedProjects);
        
        // If no project selected and we have projects, select the first one
        if (!widgetProjectId && fetchedProjects.length > 0) {
          setWidgetProjectId(fetchedProjects[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch projects for chat widget:', error);
      }
    };
    fetchProjects();
  }, [widgetProjectId, setWidgetProjectId]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Get current project name
  const currentProject = projects.find(p => p.id === widgetProjectId);
  const currentProjectName = currentProject?.name || 'Select Project';
  
  // Get current chat for widget (independent from Messages page)
  const widgetChat = chats.find(chat => chat.id === widgetChatId);
  
  // If widgetChatId is set but chat not found (e.g., after page refresh), go back to list
  useEffect(() => {
    if (widgetChatId && !widgetChat && chats.length > 0) {
      console.warn('[ChatWidgetWindow] Chat not found, returning to list. ChatId:', widgetChatId);
      setWidgetChat(null);
    }
  }, [widgetChatId, widgetChat, chats.length, setWidgetChat]);
  
  const handleSelectChat = (chatId: number) => {
    setWidgetChat(chatId);
  };
  
  const handleBackToList = () => {
    setWidgetChat(null);
  };
  
  const handleCreateChat = () => {
    setIsCreateDialogOpen(true);
  };
  
  const handleChatCreated = (chatId: number) => {
    setIsCreateDialogOpen(false);
    setWidgetChat(chatId);
  };
  
  const handleOpenMessagesPage = () => {
    // Close the widget and open the messages page
    closeWidget();
    setMessagePageOpen(true);

    const params = new URLSearchParams();
    const fallbackProjectId = projectId ? Number(projectId) : NaN;
    const targetProjectId =
      typeof widgetProjectId === 'number' && widgetProjectId > 0
        ? widgetProjectId
        : Number.isFinite(fallbackProjectId) && fallbackProjectId > 0
          ? fallbackProjectId
          : null;

    if (targetProjectId) {
      params.set('projectId', String(targetProjectId));
    }
    if (widgetChatId) {
      params.set('chatId', String(widgetChatId));
    }

    const query = params.toString();
    router.push(query ? `/messages?${query}` : '/messages');
  };

  const handleProjectSelect = (project: ProjectData) => {
    setWidgetProjectId(project.id);
    setIsProjectDropdownOpen(false);
    // Clear current chat when switching projects
    setWidgetChat(null);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-2xl w-[380px] h-[600px] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-[#3CCED7] text-white px-4 py-3 flex flex-col gap-2 flex-shrink-0">
          {/* Top row: Title and controls */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">
              {widgetView === 'chat' && widgetChat ? widgetChat.name || 'Chat' : 'Chats'}
            </h2>
            <div className="flex items-center gap-1">
              {/* Expand to Messages Page Button */}
              <button
                onClick={handleOpenMessagesPage}
                className="hover:bg-[#2AB5BD] rounded p-1.5 transition-colors"
                aria-label="Open in Messages page"
                title="Open full Messages page"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              {/* Minimize Button */}
              <button
                onClick={closeWidget}
                className="hover:bg-[#2AB5BD] rounded p-1.5 transition-colors"
                aria-label="Minimize"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
              {/* Close Button */}
              <button
                onClick={closeWidget}
                className="hover:bg-[#2AB5BD] rounded p-1.5 transition-colors"
                aria-label="Close"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Project Selector Row */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="flex items-center gap-2 w-full px-2 py-1.5 bg-[#2AB5BD] hover:bg-[#1a9ba3] rounded text-sm transition-colors"
            >
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1 text-left">{currentProjectName}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown */}
            {isProjectDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto z-50">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 text-sm">No projects found</div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSelect(project)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                        project.id === widgetProjectId ? 'bg-[#3CCED7]/10 text-[#1a9ba3]' : 'text-gray-700'
                      }`}
                    >
                      <FolderOpen className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {widgetView === 'list' ? (
            <ChatList
              chats={chats}
              currentChatId={widgetChatId}
              onSelectChat={handleSelectChat}
              onCreateChat={handleCreateChat}
              roleByUserId={roleByUserId}
            />
          ) : widgetChat ? (
            <ChatWindow
              chat={widgetChat}
              onBack={handleBackToList}
              roleByUserId={roleByUserId}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a chat to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Chat Dialog */}
      <CreateChatDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        projectId={widgetProjectId ? String(widgetProjectId) : projectId || ''}
        onChatCreated={handleChatCreated}
      />
    </>
  );
}
