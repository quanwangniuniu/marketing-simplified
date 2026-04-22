'use client';

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { Bell, FolderOpen, Hash, Home, MessageSquare, MessagesSquare, Plus, Star, User, Users } from 'lucide-react';
import type { Chat } from '@/types/chat';
import { useAuthStore } from '@/lib/authStore';
import {
  listStarredChats,
  reorderStarredChats,
  starChat,
  unstarChat,
} from '@/lib/api/chatApi';
import toast from 'react-hot-toast';
import type { MessagesNavView } from './NavRail';
import FilesSidebarView from './FilesSidebarView';
import ActivitySidebarView from './ActivitySidebarView';
import ProjectMembersSection from './ProjectMembersSection';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import { Skeleton } from '@/components/ui/skeleton';

function normalizeChat(c: Chat): Chat {
  const raw = c.project_id ?? (c as { project?: number }).project;
  const project_id = Number(raw);
  return Number.isFinite(project_id) ? { ...c, project_id } : c;
}

interface HomeSidebarProps {
  view: MessagesNavView;
  onChangeView: (view: MessagesNavView) => void;
  selectedProjectId: number | null;
  chats: Chat[];
  currentChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onCreateChat: () => void;
  onCreateChannel: () => void;
  isLoading: boolean;
  emptyState: React.ReactNode;
  roleByUserId?: Record<number, string>;
  projectMembers: ProjectMemberData[];
  isLoadingMembers: boolean;
  onStartDM: (userId: number) => void;
}

function Section({
  title,
  icon,
  headerExtra,
  children,
  headerRowClassName,
}: {
  title: string;
  icon: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  headerRowClassName?: string;
}) {
  return (
    <div className="mt-3">
      <div
        className={[
          'px-3 flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide',
          headerRowClassName ?? '',
        ].join(' ')}
      >
        <span className="text-gray-500">{icon}</span>
        <span className="flex-1 min-w-0">{title}</span>
        {headerExtra}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SidebarRowsSkeleton({
  rows = 4,
  withHeading = false,
}: {
  rows?: number;
  withHeading?: boolean;
}) {
  return (
    <div className="px-3 py-2">
      {withHeading ? <Skeleton className="mb-3 h-3 w-24" /> : null}
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`messages-sidebar-skeleton-${index}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeSidebar({
  view,
  onChangeView,
  selectedProjectId,
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  onCreateChannel,
  isLoading,
  emptyState,
  roleByUserId,
  projectMembers,
  isLoadingMembers,
  onStartDM,
}: HomeSidebarProps) {
  const currentUserId = useAuthStore((s) => (s.user?.id ? Number(s.user.id) : null));
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [starredOrder, setStarredOrder] = useState<number[]>([]);
  const [starLoading, setStarLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const { groupChats, privateChats } = useMemo(() => {
    const group: Chat[] = [];
    const priv: Chat[] = [];
    for (const chat of chats) {
      if (chat.type === 'group') group.push(chat);
      else priv.push(chat);
    }
    return { groupChats: group, privateChats: priv };
  }, [chats]);

  // User IDs that already have a DM thread — used to deduplicate the project members list
  const dmUserIds = useMemo(() => {
    const ids = new Set<number>();
    for (const chat of privateChats) {
      for (const p of chat.participants ?? []) {
        if (p.user?.id && p.user.id !== currentUserId) {
          ids.add(p.user.id);
        }
      }
    }
    return ids;
  }, [privateChats, currentUserId]);

  const getPrivateChatDisplayName = useCallback(
    (chat: Chat) => {
      if (chat.type !== 'private') return chat.name || 'Group chat';
      if (!currentUserId) return chat.name || 'Direct message';

      const other = chat.participants?.find((p) => p.user.id !== currentUserId);
      const otherUser = other?.user;
      const isBot =
        otherUser?.email === 'agent-bot@system.local' || otherUser?.username === 'agent-bot';
      if (isBot) return 'AI Agent';
      return otherUser?.username || chat.name || 'Direct message';
    },
    [currentUserId]
  );

  const starredIdSet = useMemo(() => new Set(starredOrder), [starredOrder]);

  const mergeChat = useCallback(
    (c: Chat): Chat => {
      const norm = normalizeChat(c);
      const live = chats.find((x) => x.id === norm.id);
      return live ?? norm;
    },
    [chats]
  );

  const loadStarred = useCallback(async () => {
    if (!selectedProjectId || view !== 'home') {
      setStarredOrder([]);
      return;
    }
    try {
      setStarLoading(true);
      const rows = await listStarredChats(selectedProjectId);
      setStarredOrder(rows.map((r) => r.chat.id));
    } catch {
      toast.error('Could not load starred chats');
      setStarredOrder([]);
    } finally {
      setStarLoading(false);
    }
  }, [selectedProjectId, view]);

  useEffect(() => {
    void loadStarred();
  }, [loadStarred]);

  const starredChatsOrdered = useMemo(() => {
    return starredOrder
      .map((id) => {
        const fromList = chats.find((c) => c.id === id);
        return fromList ?? null;
      })
      .filter((c): c is Chat => c !== null);
  }, [starredOrder, chats]);

  const toggleStar = async (chatId: number) => {
    if (!selectedProjectId) return;
    try {
      if (starredIdSet.has(chatId)) {
        await unstarChat(chatId);
        setStarredOrder((prev) => prev.filter((id) => id !== chatId));
      } else {
        await starChat(chatId);
        setStarredOrder((prev) => [...prev, chatId]);
      }
    } catch {
      toast.error('Could not update starred');
    }
  };

  const handleDragStart = (chatId: number) => (e: DragEvent<HTMLElement>) => {
    setDraggingId(chatId);
    e.dataTransfer.setData('text/plain', String(chatId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOn = (targetChatId: number) => async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const draggedId = Number(raw);
    setDraggingId(null);
    if (!selectedProjectId || !Number.isFinite(draggedId)) return;
    const order = [...starredOrder];
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetChatId);
    if (to < 0) return;

    if (from < 0) {
      if (order.includes(draggedId)) return;
      try {
        await starChat(draggedId);
        const next = [...order];
        next.splice(to, 0, draggedId);
        setStarredOrder(next);
        await reorderStarredChats(selectedProjectId, next);
      } catch {
        toast.error('Could not add to starred');
        void loadStarred();
      }
      return;
    }

    if (draggedId === targetChatId) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    setStarredOrder(next);
    try {
      await reorderStarredChats(selectedProjectId, next);
    } catch {
      toast.error('Could not reorder starred');
      void loadStarred();
    }
  };

  const handleDropOnStarredEmpty = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const draggedId = Number(raw);
    if (!selectedProjectId || !Number.isFinite(draggedId)) return;
    if (starredOrder.includes(draggedId)) return;
    try {
      await starChat(draggedId);
      setStarredOrder([draggedId]);
    } catch {
      toast.error('Could not add to starred');
    }
  };

  const listDragStart = (chatId: number) => (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.setData('text/plain', String(chatId));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const renderPlaceholder = (title: string, subtitle: string) => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-sm text-gray-500">
      <p className="font-medium text-gray-700">{title}</p>
      <p className="mt-1">{subtitle}</p>
    </div>
  );

  const mainListContent = () => {
    const showHome = view === 'home';
    const showDmsOnly = view === 'dms';

    if (!selectedProjectId) {
      return <div className="p-4 text-sm text-gray-500">{emptyState}</div>;
    }
    if (isLoading) {
      if (view === 'activity' || view === 'files') {
        return <SidebarRowsSkeleton rows={2} withHeading />;
      }

      return (
        <div className="pb-2">
          {showHome && (
            <Section title="Starred" icon={<Star className="w-3.5 h-3.5" />}>
              <SidebarRowsSkeleton rows={2} />
            </Section>
          )}

          {showHome && (
            <Section title="Channels" icon={<Hash className="w-3.5 h-3.5" />}>
              <SidebarRowsSkeleton rows={4} />
            </Section>
          )}

          {(showHome || showDmsOnly) && (
            <Section title="Direct messages" icon={<Users className="w-3.5 h-3.5" />}>
              <SidebarRowsSkeleton rows={4} />
            </Section>
          )}

          {(showHome || showDmsOnly) && selectedProjectId && (
            <Section title="Project members" icon={<User className="w-3.5 h-3.5" />}>
              <SidebarRowsSkeleton rows={4} />
            </Section>
          )}
        </div>
      );
    }

    if (view === 'activity') {
      return <ActivitySidebarView selectedProjectId={selectedProjectId} />;
    }
    if (view === 'files') {
      return <FilesSidebarView selectedProjectId={selectedProjectId} />;
    }

    if (showDmsOnly && privateChats.length === 0 && !selectedProjectId) {
      return <div className="p-4 text-sm text-gray-500">No direct messages</div>;
    }

    if (isCollapsed) {
      const collapsedSource = showDmsOnly ? privateChats : chats;
      return (
        <div className="p-2 space-y-2">
          {collapsedSource.slice(0, 12).map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat.id)}
              className={[
                'w-full h-10 rounded-lg border flex items-center justify-center',
                chat.id === currentChatId
                  ? 'bg-[#3CCED7]/10 border-[#3CCED7]/40 text-[#3CCED7]'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
              ].join(' ')}
              title={chat.type === 'private' ? getPrivateChatDisplayName(chat) : chat.name || 'Group chat'}
              data-testid="messages-chat-sidebar-collapsed-item"
              data-chat-id={String(chat.id)}
            >
              {chat.type === 'group' ? (
                <Hash className="w-4 h-4" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="pb-2">
        {showHome && (
          <Section
            title="Starred"
            icon={<Star className="w-3.5 h-3.5" />}
            headerExtra={
              starLoading ? (
                <span className="text-[10px] font-normal normal-case text-gray-400">…</span>
              ) : null
            }
          >
            {starredChatsOrdered.length === 0 ? (
              <div
                className="px-3 py-6 text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg mx-1 min-h-[4rem] flex items-center justify-center text-center"
                onDragOver={handleDragOver}
                onDrop={handleDropOnStarredEmpty}
              >
                Drag important channels or DMs here from the lists below.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-dashed border-gray-200 rounded-lg overflow-hidden mx-1">
                {starredChatsOrdered.map((chat) => (
                  <div
                    key={chat.id}
                    onDragOver={handleDragOver}
                    onDrop={handleDropOn(chat.id)}
                    className={draggingId === chat.id ? 'opacity-60' : ''}
                  >
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => onSelectChat(chat.id)}
                      className={[
                        'w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 text-left rounded-none group/starrow',
                        chat.id === currentChatId ? 'bg-[#3CCED7]/10 text-[#3CCED7] border-l-2 border-[#3CCED7]' : '',
                      ].join(' ')}
                      data-testid="messages-chat-row"
                      data-chat-id={String(chat.id)}
                      draggable
                      onDragStart={handleDragStart(chat.id)}
                      title={chat.type === 'private' ? getPrivateChatDisplayName(chat) : chat.name || 'Channel'}
                    >
                      {chat.type === 'group' ? (
                        <Hash className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Users className="w-4 h-4 text-gray-400" />
                      )}

                      <span className="flex-1 min-w-0 truncate">
                        {chat.type === 'private'
                          ? getPrivateChatDisplayName(chat)
                          : chat.name || 'untitled'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleStar(chat.id);
                        }}
                        className={[
                          'p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-opacity',
                          'opacity-0 group-hover/starrow:opacity-100',
                          'opacity-100 text-yellow-500 hover:text-yellow-600',
                        ].join(' ')}
                        aria-label="Unstar"
                        title="Unstar"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {showHome && (
          <div className="mt-3">
            <div className="px-3 flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide group/channels">
              <span className="text-gray-500">
                <Hash className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">Channels</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChannel();
                }}
                className="p-1 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800 opacity-0 group-hover/channels:opacity-100 transition-opacity"
                title="Add channel"
                aria-label="Add channel"
                data-testid="messages-add-channel"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 mx-1">
              {groupChats.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No channels</div>
              ) : (
                <div className="space-y-0.5">
                  {groupChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => onSelectChat(chat.id)}
                      className={[
                        'w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 text-left rounded-md',
                        chat.id === currentChatId ? 'bg-[#3CCED7]/10 text-[#3CCED7] border-l-2 border-[#3CCED7]' : '',
                      ].join(' ')}
                      data-testid="messages-chat-row"
                      data-chat-id={String(chat.id)}
                      draggable={!starredIdSet.has(chat.id)}
                      onDragStart={listDragStart(chat.id)}
                      title={chat.name || 'Channel'}
                    >
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{chat.name || 'untitled'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {(showHome || showDmsOnly) && (
          <Section
            title="Direct messages"
            icon={<Users className="w-3.5 h-3.5" />}
            headerRowClassName="group/dms"
            headerExtra={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChat();
                }}
                disabled={!selectedProjectId}
                className="p-1 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800 opacity-0 group-hover/dms:opacity-100 transition-opacity disabled:opacity-0"
                title="New chat"
                aria-label="New chat"
                data-testid="messages-new-chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            }
          >
            {privateChats.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No direct messages</div>
            ) : (
              <div className="space-y-0.5 mx-1">
                {privateChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => onSelectChat(chat.id)}
                    className={[
                      'w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 text-left rounded-md group/dmrow',
                      chat.id === currentChatId ? 'bg-[#3CCED7]/10 text-[#3CCED7] border-l-2 border-[#3CCED7]' : '',
                    ].join(' ')}
                    data-testid="messages-chat-row"
                    data-chat-id={String(chat.id)}
                    draggable={showHome && !starredIdSet.has(chat.id)}
                    onDragStart={showHome ? listDragStart(chat.id) : undefined}
                    title={chat.name || 'Direct message'}
                  >
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="flex-1 min-w-0 truncate">{getPrivateChatDisplayName(chat)}</span>

                    {showHome && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleStar(chat.id);
                        }}
                        className={[
                          'p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-opacity',
                          'opacity-0 group-hover/dmrow:opacity-100',
                          starredIdSet.has(chat.id) ? 'opacity-100 text-yellow-500 hover:text-yellow-600' : '',
                        ].join(' ')}
                        aria-label={starredIdSet.has(chat.id) ? 'Unstar' : 'Star'}
                        title={starredIdSet.has(chat.id) ? 'Unstar' : 'Star'}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {(showHome || showDmsOnly) && selectedProjectId && (
          <Section
            title="Project members"
            icon={<User className="w-3.5 h-3.5" />}
          >
            <ProjectMembersSection
              members={projectMembers}
              isLoading={isLoadingMembers}
              currentUserId={currentUserId}
              dmUserIds={dmUserIds}
              onStartDM={onStartDM}
            />
          </Section>
        )}
      </div>
    );
  };

  const tabItems: { id: MessagesNavView; label: string; icon: React.ReactNode; testid: string }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-3.5 h-3.5" />, testid: 'messages-nav-home' },
    { id: 'dms', label: 'DMs', icon: <MessageSquare className="w-3.5 h-3.5" />, testid: 'messages-nav-dms' },
    { id: 'activity', label: 'Activity', icon: <Bell className="w-3.5 h-3.5" />, testid: 'messages-nav-activity' },
    { id: 'files', label: 'Files', icon: <FolderOpen className="w-3.5 h-3.5" />, testid: 'messages-nav-files' },
  ];

  return (
    <div
      className="h-full w-full flex flex-col bg-white"
      data-testid="messages-home-sidebar"
      aria-label="Chats"
    >
      <div
        className="flex items-stretch border-b border-gray-200 px-1"
        data-testid="messages-nav-rail"
      >
        {tabItems.map((tab) => {
          const isActive = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeView(tab.id)}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                isActive
                  ? 'text-[#3CCED7] border-[#3CCED7]'
                  : 'text-gray-500 border-transparent hover:text-gray-900',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
              data-testid={tab.testid}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">{mainListContent()}</div>
    </div>
  );
}
