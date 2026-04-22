'use client';

import { MessageCircle } from 'lucide-react';
import { useChatStore } from '@/lib/chatStore';

interface ChatWidgetButtonProps {
  unreadCount: number;
}

export default function ChatWidgetButton({ unreadCount }: ChatWidgetButtonProps) {
  const { openWidget } = useChatStore();

  return (
    <div className="relative mr-4">
      {/* Button that slides in/out - hidden by default, shows on hover */}
      <button
        onClick={openWidget}
        className="relative bg-[#3CCED7] hover:bg-[#2AB5BD] active:bg-[#1a9ba3] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all duration-300 ease-out translate-x-12 hover:translate-x-0 opacity-50 hover:opacity-100 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:ring-offset-2"
        aria-label="Open chat"
        title="Open chat"
      >
        {/* Chat Icon */}
        <MessageCircle className="w-6 h-6" />
        
        {/* Unread Badge - always visible even when button is partially hidden */}
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -left-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow-md animate-pulse"
            aria-label={`${unreadCount} unread messages`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}



