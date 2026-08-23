'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  AtSign,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  MessageCircle,
  MessageSquare,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useBuildUrl } from '@/lib/buildUrl';
import type { NotificationItem } from '@/types/notifications';

// ── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

function typeIcon(eventType: string) {
  switch (eventType) {
    case 'chat_mention':
      return <AtSign className="h-3 w-3 text-[#3CCED7]" />;
    case 'chat_thread_reply':
      return <MessageCircle className="h-3 w-3 text-violet-500" />;
    case 'chat_reaction':
      return <SmilePlus className="h-3 w-3 text-amber-500" />;
    case 'chat_new_conversation':
      return <MessageSquare className="h-3 w-3 text-emerald-500" />;
    default: // chat_new_message
      return <Bell className="h-3 w-3 text-gray-400" />;
  }
}

// ── Activity item ─────────────────────────────────────────────────────────────

function ActivityItem({
  item,
  onRead,
  onNavigate,
}: {
  item: NotificationItem;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const actorName = item.actor_name ?? 'Someone';
  const initials = actorName[0]?.toUpperCase() ?? '?';

  const handleClick = () => {
    if (!item.is_read) onRead(item.id);
    if (item.action_url) onNavigate(item.action_url);
  };

  // For chat_new_message show message count badge
  const msgCount =
    item.event_type === 'chat_new_message'
      ? (item.metadata?.message_count as number | undefined)
      : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'group w-full flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition',
        item.is_read
          ? 'hover:bg-gray-50'
          : 'bg-[#3CCED7]/5 hover:bg-[#3CCED7]/10',
      ].join(' ')}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {item.is_read ? (
          <div className="h-2 w-2" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-[#3CCED7]" />
        )}
      </div>

      {/* Actor avatar */}
      <div className="shrink-0">
        {item.actor_avatar ? (
          <img
            src={item.actor_avatar}
            alt={actorName}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatarColor(actorName)}`}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs font-semibold text-gray-900 shrink-0">
            {actorName}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
            {typeIcon(item.event_type)}
          </span>
          {msgCount && msgCount > 1 && (
            <span className="rounded-full bg-[#3CCED7] px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
              {msgCount > 99 ? '99+' : msgCount}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-gray-600 leading-snug">
          {item.title}
        </p>
        {item.body && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-400 leading-snug">
            {item.body}
          </p>
        )}
        <p className="mt-1 text-[10px] text-gray-300">{relativeTime(item.created_at)}</p>
      </div>
    </button>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function ActivitySidebarView() {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const { groups, isLoading, error, unreadCount, markRead, markAllRead, clearRead } =
    useActivityFeed();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleNavigate = (url: string) => {
    router.push(buildUrl(url));
  };

  if (isLoading && groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Activity</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Activity</div>
        <div className="p-4 text-sm text-gray-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Activity
          </span>
          {unreadCount > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#3CCED7] px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && !confirmingClear && (
            <button
              type="button"
              onClick={markAllRead}
              title="Mark all as read"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
          )}
          {confirmingClear ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">Can&apos;t be undone.</span>
              <button
                type="button"
                onClick={() => { clearRead(); setConfirmingClear(false); }}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              data-testid="activity-clear-btn"
              title="Clear read notifications"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="task-tab-scrollbar flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-gray-400">
            <Check className="h-8 w-8 opacity-20" />
            <p className="text-sm">You&apos;re all caught up!</p>
            <p className="text-xs text-gray-300">Mentions, replies, reactions and DMs will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.label}
                </div>
                <div className="px-1 space-y-0.5">
                  {group.items.map((item) => (
                    <ActivityItem
                      key={item.id}
                      item={item}
                      onRead={markRead}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
