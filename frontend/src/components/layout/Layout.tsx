// src/components/layout/Layout.tsx
import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import ChatWidget from '@/components/chat/ChatWidget';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import { usePermissionEditControl } from '@/hooks/usePermissionEditControl';
import { LanguageProvider } from '@/contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  mainScrollMode?: 'container' | 'page';
  sidebarCollapsed?: boolean;
  showHeader?: boolean;
  showSidebar?: boolean;
  unsavedChangesGuard?: {
    hasChanges: boolean;
    onNavigateAway: (destination: string) => void;
  };
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  showPermissionRole?: boolean; // New prop to show permission-based role
  onUserAction?: (action: 'profile' | 'settings' | 'logout') => void;
  onNotificationClick?: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  className = '',
  mainScrollMode = 'page',
  sidebarCollapsed = false,
  showHeader = true,
  showSidebar = true,
  showPermissionRole = false,
  unsavedChangesGuard,
  user: propUser,
  onUserAction,
  onNotificationClick,
}) => {
  const usePageScroll = mainScrollMode === 'page';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get project_id from URL for auto-switching chat widget
  const contextProjectId = searchParams.get('project_id');
  
  // Get user from auth store
  const { user: authUser, logout } = useAuthStore();
  
  // Get permission role if requested
  const { getUserPermissionLevel, userRoles } = usePermissionEditControl();
  
  // Get user's highest role level (lowest rank = highest level)
  // or default to 10 if no roles
  const userRoleLevel = userRoles.length > 0 
    ? Math.min(...userRoles.map(role => role.rank || 10))
    : 10;
  
  // Use auth store user if available, otherwise fall back to prop user or default
  const user = authUser ? {
    name: authUser.username || 'User',
    email: authUser.email,
    role: showPermissionRole && userRoles.length > 0 
      ? `${userRoles[0].name} (${getUserPermissionLevel()})`
      : authUser.roles?.length > 0 ? authUser.roles[0] : 'User',
  } : propUser || {
    name: 'Guest',
    email: 'guest@example.com',
    role: 'guest',
  };

  // detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // fold sidebar automatically
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // handle sidebar status
  const handleSidebarCollapseChange = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  // handle user actions
  const handleUserAction = async (action: 'profile' | 'settings' | 'logout') => {
    switch (action) {
      case 'profile':
        router.push('/profile');
        break;
      case 'settings':
        router.push('/profile/settings');
        break;
      case 'logout':
        try {
          await logout();
          router.push('/login');
        } catch (error) {
          console.error('Logout failed:', error);
        }
        break;
    }
    onUserAction?.(action);
  };

  // handle notification click action
  const handleNotificationClick = (id: string) => {
    console.log('Notification clicked:', id);
    // TODO: 
    onNotificationClick?.(id);
  };

  return (
    <LanguageProvider>
      <div className={`${usePageScroll ? 'min-h-screen' : 'h-screen'} flex flex-col bg-gray-100 ${className}`}>
        {/* Header */}
        {showHeader && (
          <Header
            user={user}
            onUserMenuClick={handleUserAction}
            onNotificationClick={handleNotificationClick}
          />
        )}

        {/* main */}
        <div className={`flex flex-1 ${usePageScroll ? 'overflow-visible' : 'overflow-hidden'}`}>
          {/* sidebar */}
          {showSidebar && (
            <Sidebar
              defaultCollapsed={isSidebarCollapsed}
              onCollapseChange={handleSidebarCollapseChange}
              userRole={user.role}
              userRoleLevel={userRoleLevel}
              unsavedChangesGuard={unsavedChangesGuard}
            />
          )}

          {/* main content */}
          <main className={`

            flex-1 overflow-hidden bg-white 
            ${usePageScroll ? 'overflow-visible' : 'overflow-hidden'} 
            bg-gray-50
            ${isMobile && !isSidebarCollapsed ? 'hidden' : 'block'}
            transition-all duration-300 ease-in-out
          `}>
            {children}
          </main>
        </div>

        {/* sidebar collapse */}
        {isMobile && !isSidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}
        
        {/* Global Chat Widget - available on all pages when authenticated */}
        {authUser && (
          <ChatWidget contextProjectId={contextProjectId} />
        )}
      </div>
    </LanguageProvider>
  );
};

export default Layout;
