// src/components/layout/Sidebar.tsx
import { useState, useEffect, useMemo } from "react";
import type { FC, ComponentType } from "react";
import { useChatStore } from "@/lib/chatStore";
import { useAgentSidePanelStore } from "@/lib/agentSidePanelStore";
// TODO: In actual projects, uncomment the imports below
// import Link from 'next/link';
// For Next.js 13+ App Router, also import:
// import { usePathname } from 'next/navigation';
// For Next.js 12 Pages Router, also import:
// import { useRouter } from 'next/router';

import {
  FolderOpen,
  Shield,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  FileSpreadsheet,
  CheckSquare,
  Calendar,
  Bell,
  ListTodo,
  UserRoundCog,
  Notebook,
  Bot,
  Presentation,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePathname } from "next/navigation";

interface NavigationItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
  description?: string;
  children?: NavigationItem[];
  exactMatch?: boolean;
}

interface SidebarProps {
  className?: string;
  defaultCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  userRole?: string;
  userRoleLevel?: number;
  unsavedChangesGuard?: {
    hasChanges: boolean;
    onNavigateAway: (destination: string) => void;
  };
}

// Navigation configuration - can be dynamically adjusted based on user role
const getNavigationItems = (
  userRole?: string,
  userRoleLevel?: number,
  t?: (key: string) => string
): NavigationItem[] => {
  const baseItems: NavigationItem[] = [
    {
      name: "Spreadsheets",
      href: "/spreadsheets",
      icon: FileSpreadsheet,
      description: "Choose a project and open its spreadsheets",
    },
    {
      name: t ? t("sidebar.projects") : "Projects",
      href: "/projects",
      icon: FolderOpen,
      description: t ? t("sidebar.manage_projects") : "Manage your projects",
    },
    {
      name: t ? t("sidebar.campaigns") : "Campaigns",
      href: "/campaigns",
      icon: BarChart3,
      description: t ? t("sidebar.campaign_management") : "Campaign management",
    },
    {
      name: t ? t("sidebar.meetings") : "Meetings",
      href: "/meetings",
      icon: Presentation,
      description: t
        ? t("sidebar.meetings_description")
        : "Meeting preparation and project meetings",
    },
    {
      name: t ? t("sidebar.tasks") : "Tasks",
      href: "/tasks",
      icon: ListTodo,
      description: t
        ? t("sidebar.task_management")
        : "Manage tasks and reviews",
    },
    {
      name: "Decisions",
      href: "/decisions",
      icon: CheckSquare,
      description: "Decision workbench and history",
    },
    {
      name: t ? t('sidebar.notion') : 'Notion',
      href: '/notion',
      icon: Notebook,
      description: t ? t('sidebar.notion_editor') : 'Draft documents with Notion-like editor',
    },
    // {
    //   name: t ? t("sidebar.reports") : "Reports",
    //   href: "/reports",
    //   icon: FileText,
    //   description: t ? t("sidebar.analytics_reports") : "Analytics and reports",
    // },
    {
      name: t ? t("sidebar.messages") : "Messages",
      href: "/messages",
      icon: MessageSquare,
      badge: 3,
      description: t ? t("sidebar.team_communication") : "Team communication",
    },
    {
      name: t ? t("sidebar.calendar") : "Calendar",
      href: "/calendar",
      icon: Calendar,
      description: t ? t("sidebar.schedule_events") : "Schedule and events",
    },
  ];

  // Add administration features based on user role
  if (userRoleLevel && userRoleLevel <= 2) {
    baseItems.push({
      name: t ? t("sidebar.administration") : "Administration",
      href: "/admin",
      icon: Shield,
      description: t
        ? t("sidebar.system_administration")
        : "System administration",
      children: [
        {
          name: t ? t("sidebar.user_management") : "User Management",
          href: "/admin/users",
          icon: Users,
        },
        {
          name: t ? t("sidebar.roles") : "Roles",
          href: "/admin/roles",
          icon: UserRoundCog,
        },
        {
          name: t ? t("sidebar.permissions") : "Permissions",
          href: "/admin/permissions",
          icon: Shield,
        },
        // {
        //   name: t ? t("sidebar.system_settings") : "System Settings",
        //   href: "/admin/settings",
        //   icon: Settings,
        // },
        {
          name: t ? t("sidebar.notifications") : "Notifications",
          href: "/admin/notifications",
          icon: Bell,
        },
      ],
    });
  }

  baseItems.push({
    name: t ? t("sidebar.settings") : "Settings",
    href: "/integrations",
    icon: Settings,
    description: t ? t("sidebar.user_preferences") : "User preferences",
  });

  return baseItems;
};

const Sidebar: FC<SidebarProps> = ({
  className = "",
  defaultCollapsed = false,
  onCollapseChange,
  userRole = "user",
  userRoleLevel = 10,
  unsavedChangesGuard,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { t } = useLanguage();
  const { toggle: toggleAgentPanel, isOpen: isAgentPanelOpen } = useAgentSidePanelStore();

  // Get current pathname using Next.js 13+ App Router hook
  const pathname = usePathname();

  /** Hub /meetings, or any /projects/:id/meetings/... — only Meetings nav should be active */
  const pathnameIsMeetingsWorkspace = useMemo(
    () =>
      pathname === "/meetings" ||
      pathname.startsWith("/meetings/") ||
      /^\/projects\/[^/]+\/meetings(\/.*)?$/.test(pathname),
    [pathname]
  );

  // Get global unread count from chat store for Messages badge (across ALL projects)
  const globalUnreadCount = useChatStore(state => state.globalUnreadCount);

  const navigationItems = useMemo(() => {
    const items = getNavigationItems(userRole, userRoleLevel, t);
    // Update Messages badge with global unread count (across ALL projects)
    return items.map(item => {
      if (item.name === (t ? t("sidebar.messages") : "Messages") || item.href === "/messages") {
        return { ...item, badge: globalUnreadCount > 0 ? globalUnreadCount : undefined };
      }
      return item;
    });
  }, [userRole, userRoleLevel, t, globalUnreadCount]);

  // Handle collapse state changes
  const handleCollapseToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);

    // Clear expanded state when collapsing
    if (newCollapsed) {
      setExpandedItems([]);
    }
  };

  // Handle submenu expand/collapse
  const handleItemToggle = (itemName: string) => {
    if (collapsed) return;

    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  // Intercept navigation when on Notion page with unsaved changes
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!unsavedChangesGuard?.hasChanges || href === "#") return;
    const isOnNotion = pathname === "/notion" || pathname.startsWith("/notion/");
    const isNavigatingAway = href !== "/notion" && !href.startsWith("/notion/");
    if (isOnNotion && isNavigatingAway) {
      e.preventDefault();
      unsavedChangesGuard.onNavigateAway(href);
    }
  };

  // Check if path matches
  const isActive = (href: string, exactMatch?: boolean) => {
    if (href === "#") {
      return false;
    }
    if (href === "/") {
      return pathname === "/";
    }
    if (exactMatch) {
      return pathname === href;
    }
    // On any Meetings URL, highlight only Meetings (not Projects, etc.)
    if (pathnameIsMeetingsWorkspace) {
      return href === "/meetings";
    }
    // For exact match or sub-path match, but avoid partial matches
    // e.g., '/admin' should match '/admin' and '/admin/xxx', but not '/administrator'
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Check if there are active child items
  const hasActiveChild = (children?: NavigationItem[]) => {
    if (!children) return false;
    return children.some((child) => isActive(child.href, child.exactMatch));
  };

  // Auto-expand menus containing active items
  useEffect(() => {
    if (collapsed) return;

    navigationItems.forEach((item) => {
      if (item.children && hasActiveChild(item.children)) {
        setExpandedItems((prev) =>
          prev.includes(item.name) ? prev : [...prev, item.name]
        );
      }
    });
  }, [pathname, collapsed, navigationItems]);

  // Responsive handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`
      sticky top-0 z-30 flex h-[100vh] min-h-full shrink-0 flex-col self-stretch
      bg-white border-r border-gray-200 transition-all duration-300 ease-in-out
      ${collapsed ? "w-16" : "w-64"}
      ${className}
    `}
    >
      {/* Collapse button */}
      <div className="shrink-0 border-b border-gray-200">
        <button
          onClick={handleCollapseToggle}
          className="py-4 px-1.5 rounded-lg transition-colors duration-200 w-full flex flex-col items-end"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-600 self-center" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Navigation menu */}
      <nav
        className={`min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-4 ${
          collapsed ? "pb-28" : "pb-44"
        }`}
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isItemActive = isActive(item.href, item.exactMatch);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedItems.includes(item.name);
          const hasActiveChildItem = hasActiveChild(item.children);

          return (
            <div key={item.name}>
              {/* Main menu item */}
              <div className="relative">
                {hasChildren ? (
                  <button
                    onClick={() => handleItemToggle(item.name)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                      ${
                        isItemActive || hasActiveChildItem
                          ? "bg-[#3CCED7]/15 text-[#1a9ba3] border-r-2 border-[#3CCED7]"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }
                      ${collapsed ? "justify-center" : "justify-between"}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span>{item.name}</span>
                          {item.badge && (
                            <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {!collapsed && hasChildren && (
                      <ChevronRight
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    )}
                  </button>
                ) : (
                  // TODO: In actual projects, replace with Next.js Link component
                  // <Link href={item.href} className={...}>
                  <a
                    href={item.href}
                    onClick={(e) => handleLinkClick(e, item.href)}
                    className={`
                      flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                      ${
                        isItemActive
                          ? "bg-[#3CCED7]/15 text-[#1a9ba3] border-r-2 border-[#3CCED7]"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }
                      ${collapsed ? "justify-center" : ""}
                    `}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span>{item.name}</span>
                        {item.badge && (
                          <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </a>
                  // </Link>
                )}

                {/* Tooltip (only shown when collapsed) */}
                {collapsed && (
                  <div className="absolute left-full top-0 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.name}
                    {item.description && (
                      <div className="text-gray-300 text-xs mt-1">
                        {item.description}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submenu */}
              {hasChildren && isExpanded && !collapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = isActive(child.href, child.exactMatch);

                    return (
                      // TODO: In actual projects, replace with Next.js Link component
                      // <Link key={child.href} href={child.href} className={...}>
                      <a
                        key={child.href}
                        href={child.href}
                        onClick={(e) => handleLinkClick(e, child.href)}
                        className={`
                          flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200
                          ${
                            isChildActive
                              ? "bg-[#3CCED7]/10 text-[#1a9ba3] font-medium"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }
                        `}
                      >
                        <ChildIcon className="h-4 w-4" />
                        <span>{child.name}</span>
                      </a>
                      // </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Agent AI Link + footer*/}
      <div
        className={`fixed bottom-0 left-0 z-30 flex flex-col border-t border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="px-2 pb-2 pt-2">
          <button
            onClick={toggleAgentPanel}
            className={`
            w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
            ${
              isAgentPanelOpen
                ? "bg-gradient-to-r from-[#3CCED7] to-purple-600 text-white shadow-md"
                : "bg-gradient-to-r from-blue-50 to-purple-50 text-[#1a9ba3] hover:from-blue-100 hover:to-purple-100 hover:shadow-sm"
            }
            ${collapsed ? "justify-center" : ""}
          `}
          >
            <Bot className="h-5 w-5 flex-shrink-0" />
            {!collapsed && (
              <>
                <span>Agent</span>
                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isAgentPanelOpen
                    ? "bg-white/20 text-white"
                    : "bg-[#3CCED7]/15 text-[#3CCED7]"
                }`}>
                  AI
                </span>
              </>
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="border-t border-gray-200 p-4">
            <div className="text-xs text-gray-500">
              <div className="font-medium">{t("footer.version")}</div>
              <div>{t("footer.copyright")}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

/*
=== Actual Project Migration Guide ===

1. Import Next.js components:
   Uncomment at the top of the file:
   // import Link from 'next/link';

   And add based on your Next.js version:
   - Next.js 13+ App Router: import { usePathname } from 'next/navigation';
   - Next.js 12 Pages Router: import { useRouter } from 'next/router';

2. Replace path getting logic:
   Delete the useCurrentPath() function and replace in the Sidebar component:

   const pathname = useCurrentPath(); // Delete this line

   Replace with:
   - App Router: const pathname = usePathname();
   - Pages Router: const router = useRouter(); const pathname = router.pathname;

3. Replace link components:
   Replace all <a href={...}> with <Link href={...}>

   Example:
   <a href={item.href} className={...}>
   Replace with:
   <Link href={item.href} className={...}>

4. Test routing functionality:
   Ensure all menu items can navigate and highlight correctly

5. Optional: Custom routing logic
   If you use other routing libraries (like React Router), adjust the path getting logic accordingly.
*/
