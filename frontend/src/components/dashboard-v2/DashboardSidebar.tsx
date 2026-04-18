'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard, Megaphone, CheckSquare, GitBranch, Table2,
  Calendar, Users, MessageSquare, Workflow, Clock, Settings,
  Bot, ChevronsUpDown, ChevronDown, ChevronRight,
  Target, Mail, Notebook, Facebook, Video, Presentation,
} from 'lucide-react';

type LucideIcon = typeof LayoutDashboard;

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Overview', href: '/overview', icon: LayoutDashboard },
      { label: 'AI Agent', href: '/agent', icon: Bot },
    ],
  },
  {
    title: 'MANAGE',
    items: [
      { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare },
      { label: 'Decisions', href: '/decisions', icon: GitBranch },
      { label: 'Spreadsheets', href: '/spreadsheet', icon: Table2 },
    ],
  },
  {
    title: 'CONTENT',
    items: [
      { label: 'Ad Variations', href: '/variations', icon: Target },
      {
        label: 'Ads Draft',
        href: '#',
        icon: Megaphone,
        children: [
          { label: 'Facebook Meta', href: '/facebook_meta', icon: Facebook },
          { label: 'TikTok', href: '/tiktok', icon: Video },
          { label: 'Google Ads', href: '/google_ads', icon: Target },
        ],
      },
      {
        label: 'Email Draft',
        href: '#',
        icon: Mail,
        children: [
          { label: 'Mailchimp', href: '/mailchimp', icon: Mail },
          { label: 'Klaviyo', href: '/klaviyo', icon: Mail },
        ],
      },
      { label: 'Notion', href: '/notion', icon: Notebook },
    ],
  },
  {
    title: 'COLLABORATE',
    items: [
      { label: 'Meetings', href: '/meetings', icon: Users },
      { label: 'Calendar', href: '/calendar', icon: Calendar },
      { label: 'Messages', href: '/messages', icon: MessageSquare },
      { label: 'Miro', href: '/miro', icon: Presentation },
    ],
  },
  {
    title: 'TOOLS',
    items: [
      { label: 'Workflows', href: '/workflows', icon: Workflow },
      { label: 'Timeline', href: '/timeline', icon: Clock },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export default function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (label: string) => {
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <aside className="w-[255px] h-screen flex flex-col border-r border-gray-200 bg-white shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <Link href="/" className="flex items-center">
          <Image
            src="/marketing_simplified_logo.png"
            alt="Marketing Simplified Logo"
            width={220}
            height={104}
            className="h-20 w-auto"
            priority
          />
        </Link>
      </div>

      {/* Project header — clickable to switch project */}
      <button
        onClick={() => router.push('/select-project')}
        className="px-4 py-3 border-b border-gray-100 w-full hover:bg-gray-50 transition-colors text-left group"
        title="Switch project"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#3CCED7] to-[#A6E661] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">Q2</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">Q2 Product Launch</div>
            <div className="text-xs text-gray-400">$45,000/mo</div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0" />
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-4 pb-2 px-2">
        {navGroups.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? 'mt-5' : ''}>
            <div className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {group.title}
            </div>
            {group.items.map((item) => {
              const hasChildren = !!item.children?.length;
              const isOpen = hasChildren && expanded.includes(item.label);
              const isActive = !hasChildren && pathname === item.href;
              const childActive = hasChildren && item.children!.some((c) => pathname === c.href);

              return (
                <div key={item.label}>
                  <button
                    onClick={() => (hasChildren ? toggle(item.label) : router.push(item.href))}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                      isActive || childActive
                        ? 'bg-[#3CCED7]/8 text-[#3CCED7]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    aria-expanded={hasChildren ? isOpen : undefined}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[#3CCED7]" />
                    )}
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {hasChildren && (
                      isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      )
                    )}
                  </button>

                  {hasChildren && isOpen && (
                    <div className="ml-8 mt-1 mb-1 space-y-0.5">
                      {item.children!.map((child) => {
                        const childIsActive = pathname === child.href;
                        return (
                          <button
                            key={child.href}
                            onClick={() => router.push(child.href)}
                            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                              childIsActive
                                ? 'bg-[#3CCED7]/8 text-[#3CCED7] font-medium'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <child.icon className="w-[14px] h-[14px] shrink-0" />
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User card */}
      <button
        onClick={() => router.push('/profile')}
        className="px-4 py-3 border-t border-gray-100 w-full hover:bg-gray-50 transition-colors text-left"
        title="View profile"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-semibold">J</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">JohnS</div>
            <div className="text-xs text-gray-400">User</div>
          </div>
        </div>
      </button>
    </aside>
  );
}
