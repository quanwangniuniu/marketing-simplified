// src/components/layout/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, User, Settings, LogOut, HelpCircle, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';
import Link from 'next/link';

interface HeaderProps {
  className?: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  notifications?: {
    count: number;
    items: Array<{
      id: string;
      title: string;
      message: string;
      time: string;
      read: boolean;
      type: 'info' | 'warning' | 'error' | 'success';
    }>;
  };
  onNotificationClick?: (id: string) => void;
  onUserMenuClick?: (action: 'profile' | 'settings' | 'logout') => void;
}

const Header: React.FC<HeaderProps> = ({
  className = '',
  user = {
    name: 'Admin',
    email: 'admin@company.com',
    role: 'System Administrator',
  },
  notifications = {
    count: 3,
    items: [
      {
        id: '1',
        title: 'Permission Updated',
        message: 'Role permissions for Team Leader have been updated',
        time: '2 minutes ago',
        read: false,
        type: 'info',
      },
      {
        id: '2',
        title: 'New User Registration',
        message: 'John Doe has requested access to the system',
        time: '1 hour ago',
        read: false,
        type: 'warning',
      },
      {
        id: '3',
        title: 'System Update',
        message: 'Security patches have been applied successfully',
        time: '3 hours ago',
        read: true,
        type: 'success',
      },
    ],
  },
  onNotificationClick,
  onUserMenuClick,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (id: string) => {
    onNotificationClick?.(id);
    setShowNotifications(false);
  };



  const unreadCount = notifications.items.filter(item => !item.read).length;

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'success': return 'text-green-600 bg-green-50';
      default: return 'text-brand-teal bg-brand-teal/10';
    }
  };

  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
              <Image
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                width={400}
                height={100}
                className="h-20 w-auto"
                priority
              />
          </Link>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-teal rounded-full transition-colors duration-200"
                aria-label="Notifications"
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                      <span className="text-sm text-gray-500">{notifications.count} total</span>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {notifications.items.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors duration-200 hover:bg-gray-50 ${item.read ? 'bg-white border-gray-200' : 'bg-brand-teal/5 border-brand-teal/20'
                            }`}
                          onClick={() => handleNotificationClick(item.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${getNotificationTypeColor(item.type)}`}></div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
                                <span className="text-xs text-gray-500">{item.time}</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{item.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {notifications.items.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Bell className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu - Click to navigate to profile */}
            <div>
              <button
                onClick={() => onUserMenuClick?.('profile')}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-teal transition-colors duration-200"
                aria-label="Go to profile"
              >
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700">{user.name}</div>
                  {user.role && (
                    <div className="text-xs text-gray-500">{user.role}</div>
                  )}
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-gray-600" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
