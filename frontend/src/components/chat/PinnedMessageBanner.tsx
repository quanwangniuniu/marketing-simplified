'use client';

import { ArrowUpRight, ChevronRight, Pin } from 'lucide-react';
import type { PinnedMessageRow } from '@/lib/api/chatApi';

interface PinnedMessageBannerProps {
  latestPin: PinnedMessageRow;
  pinCount: number;
  isNew: boolean;
  onJumpToMessage: (messageId: number, parentMessageId?: number | null) => void;
  onViewAll: () => void;
}

export default function PinnedMessageBanner({
  latestPin,
  pinCount,
  isNew,
  onJumpToMessage,
  onViewAll,
}: PinnedMessageBannerProps) {
  const sender = latestPin.message.sender?.username || latestPin.message.sender?.email || 'Unknown';

  return (
    <section
      className="pin-banner-enter relative flex items-center gap-2.5 bg-gradient-to-r from-teal-50/80 via-teal-50/40 to-white px-4 py-2"
      data-testid="pinned-message-banner"
      aria-live="polite"
    >
      {/* Deep "unseen" wash on its own layer: gradients can't transition, opacity can. */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-100/80 via-teal-50/50 to-white transition-opacity duration-700 ease-out',
          isNew ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      <button
        type="button"
        onClick={() => onJumpToMessage(latestPin.message.id, latestPin.message.parent_message_id ?? null)}
        className="group relative flex min-w-0 flex-1 items-center gap-2.5 text-left"
        title="Jump to message"
        aria-label={`Jump to latest pinned message: ${latestPin.message.content || 'attachment'}`}
      >
        <span className="pin-grad-chip flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105">
          <Pin className="h-3 w-3" />
        </span>

        {isNew && (
          <span
            className="pin-new-pulse shrink-0 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold text-white"
            data-testid="pinned-banner-new"
          >
            New
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-[13px]">
          <span className="font-semibold text-teal-700">{sender}:</span>{' '}
          <span className="text-gray-800">{latestPin.message.content || '(attachment)'}</span>
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 self-center text-gray-300 transition group-hover:text-teal-600" />
      </button>

      <button
        type="button"
        onClick={onViewAll}
        className="relative flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700"
        aria-label={`View all ${pinCount} pinned messages`}
      >
        {pinCount} pin{pinCount === 1 ? '' : 's'}
        <ChevronRight className="h-3 w-3" />
      </button>
    </section>
  );
}
