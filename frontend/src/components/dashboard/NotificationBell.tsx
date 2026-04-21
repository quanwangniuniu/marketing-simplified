'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import AlertCard from './AlertCard';
import type { AlertData, AlertStatus } from '@/lib/mock/dashboardMock';

interface NotificationBellProps {
  alerts: AlertData[];
}

type FilterKey = 'all' | 'critical' | 'warning' | 'info';

const filters: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

export default function NotificationBell({ alerts }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [localAlerts, setLocalAlerts] = useState<AlertData[]>(alerts);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalAlerts(alerts);
  }, [alerts]);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openAlerts = localAlerts.filter((a) => a.status === 'open');
  const unreadCount = openAlerts.length;

  const visible = filter === 'all'
    ? openAlerts
    : openAlerts.filter((a) => a.severity === filter);

  const handleAction = (id: number, action: Exclude<AlertStatus, 'open'>) => {
    setLocalAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: action } : a)));
  };

  const markAllRead = () => {
    setLocalAlerts((prev) => prev.map((a) => (a.status === 'open' ? { ...a, status: 'dismissed' } : a)));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4 text-gray-600" />
        {unreadCount > 0 && (
          <span
            data-notification-badge
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-notification-panel
          className="absolute right-0 top-full mt-2 w-[380px] max-h-[560px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
            {filters.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {visible.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400">
                <Bell className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                All caught up.
              </div>
            ) : (
              visible.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onAction={handleAction} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
