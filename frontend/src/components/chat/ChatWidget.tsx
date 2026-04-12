'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore } from '@/lib/chatStore';
import { useAuthStore } from '@/lib/authStore';
import { useChatData } from '@/hooks/useChatData';
import { useChatSocket } from '@/hooks/useChatSocket';
import ChatWidgetButton from './ChatWidgetButton';
import ChatWidgetWindow from './ChatWidgetWindow';

interface ChatWidgetProps {
  // Optional: If provided, auto-switch to this project (from URL context)
  contextProjectId?: string | number | null;
}

export default function ChatWidget({ contextProjectId }: ChatWidgetProps = {}) {
  const pathname = usePathname();

  // Use selectors for stable references
  const user = useAuthStore(state => state.user);
  const isWidgetOpen = useChatStore(state => state.isWidgetOpen);
  const isMessagePageOpen = useChatStore(state => state.isMessagePageOpen);
  // Use widget-specific project ID (independent from Messages page)
  const widgetProjectId = useChatStore(state => state.widgetProjectId);
  const setWidgetProjectId = useChatStore(state => state.setWidgetProjectId);
  
  // Track if component has mounted (for SSR/hydration safety)
  const [isMounted, setIsMounted] = useState(false);
  
  // Set mounted on client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Use global unread count (across ALL projects) for the badge
  const globalUnreadCount = useChatStore(state => state.globalUnreadCount);
  const fetchGlobalUnreadCount = useChatStore(state => state.fetchGlobalUnreadCount);
  const unreadRefreshAtRef = useRef(0);
  const unreadRefreshThrottleMs = 15000;
  const isRealtimeContextActive = isWidgetOpen || isMessagePageOpen;

  const refreshGlobalUnreadCount = useCallback((force = false) => {
    if (!user || !isMounted || isRealtimeContextActive) {
      return;
    }

    const now = Date.now();
    if (!force && now - unreadRefreshAtRef.current < unreadRefreshThrottleMs) {
      return;
    }

    unreadRefreshAtRef.current = now;
    fetchGlobalUnreadCount();
  }, [user, isMounted, isRealtimeContextActive, fetchGlobalUnreadCount]);

  // Keep a stable ref so event listeners and pathname effect always call the
  // latest version without being listed as their own dependency.
  const refreshGlobalUnreadCountRef = useRef(refreshGlobalUnreadCount);
  useEffect(() => {
    refreshGlobalUnreadCountRef.current = refreshGlobalUnreadCount;
  }, [refreshGlobalUnreadCount]);

  // Fetch global unread count on mount/login.
  // `refreshGlobalUnreadCount` is intentionally omitted from deps: its identity
  // changes whenever isRealtimeContextActive flips, which would re-trigger this
  // effect on every widget open/close. Calling via ref avoids that.
  useEffect(() => {
    if (user && isMounted) {
      refreshGlobalUnreadCountRef.current(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isMounted]);

  // Refresh on route changes — only re-runs when pathname actually changes.
  useEffect(() => {
    if (pathname) {
      refreshGlobalUnreadCountRef.current();
    }
  }, [pathname]);

  // Refresh when returning to the tab/window — registered once, never re-registered.
  useEffect(() => {
    const handleFocus = () => refreshGlobalUnreadCountRef.current();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshGlobalUnreadCountRef.current();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Auto-switch to context project (Option A: from URL)
  useEffect(() => {
    if (contextProjectId) {
      const projectIdNum = typeof contextProjectId === 'string' 
        ? parseInt(contextProjectId, 10) 
        : contextProjectId;
      if (projectIdNum && !isNaN(projectIdNum) && projectIdNum !== widgetProjectId) {
        setWidgetProjectId(projectIdNum);
      }
    }
  }, [contextProjectId, widgetProjectId, setWidgetProjectId]);
  
  // Use widget's project from store (or context project if no selection)
  const effectiveProjectId = widgetProjectId 
    ? String(widgetProjectId) 
    : contextProjectId 
      ? String(contextProjectId) 
      : undefined;
  
  // Fetch chats for the widget's selected project
  const { fetchChats } = useChatData({ 
    projectId: effectiveProjectId, 
    autoFetch: !!effectiveProjectId
  });
  
  // Connect to WebSocket for real-time updates
  const userId = user?.id ? Number(user.id) : null;
  const socketEnabled = isWidgetOpen && !isMessagePageOpen;
  const { connected } = useChatSocket(userId, {
    enabled: socketEnabled,
    onMessage: (message) => {
      console.log('[ChatWidget] New message received:', message);
    },
    onOpen: () => {
      console.log('[ChatWidget] Chat WebSocket connected');
    },
    onClose: () => {
      console.warn('[ChatWidget] Chat WebSocket disconnected');
    },
  });

  // Refresh chats when WebSocket connects or project changes
  useEffect(() => {
    if (connected && effectiveProjectId) {
      fetchChats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, effectiveProjectId]); // Don't include fetchChats to avoid infinite loop

  // Don't render during SSR
  if (!isMounted) {
    return null;
  }
  
  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className={`fixed bottom-20 z-50 ${isWidgetOpen ? 'right-4' : 'right-0'}`}>
      {isWidgetOpen ? (
        <ChatWidgetWindow projectId={effectiveProjectId} />
      ) : (
        <ChatWidgetButton unreadCount={globalUnreadCount} />
      )}
    </div>
  );
}
