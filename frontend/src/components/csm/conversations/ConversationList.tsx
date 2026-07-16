'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Conversation, ConversationStatus, TicketSummary } from '@/types/csmConversation';
import { useCsmConversationStore } from '@/lib/csmConversationStore';
import CsmConversationAPI from '@/lib/api/csmConversationApi';
import { cn } from '@/lib/utils';
import { Inbox, RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<ConversationStatus, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-500',
};

const CHANNEL_ICONS: Record<string, string> = {
  web: '🌐',
  email: '✉️',
  whatsapp: '💬',
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface ConversationListProps {
  conversations: Conversation[];
  loading?: boolean;
  onClaimed?: () => void;
  selectedQueueName?: string | null;
  queueLoadError?: boolean;
  hasAvailableQueues?: boolean;
}

export function ConversationList({
  conversations,
  loading,
  onClaimed,
  selectedQueueName,
  queueLoadError,
  hasAvailableQueues = true,
}: ConversationListProps) {
  const activeId = useCsmConversationStore((s) => s.activeConversationId);
  const setActive = useCsmConversationStore((s) => s.setActiveConversation);
  const updateConversation = useCsmConversationStore((s) => s.updateConversation);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const handleClaim = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setClaimingId(conv.id);
    try {
      const ticket = await CsmConversationAPI.claim(conv.id);
      const ticketSummary: TicketSummary = {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        status_display: ticket.status_display,
        priority: ticket.priority,
        priority_display: ticket.priority_display,
        assigned_to_name: ticket.assigned_to_name,
      };
      // Fetch updated conversation so queue_organisation_id is refreshed in store
      const updatedConv = await CsmConversationAPI.get(conv.id);
      updateConversation({ ...updatedConv, ticket: ticketSummary });
      toast.success('Claimed — ticket created');
      onClaimed?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Failed to claim conversation.');
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    const title = queueLoadError
      ? 'Queue list unavailable'
      : hasAvailableQueues
        ? 'No conversations in your assigned queues'
        : 'No assigned queues';
    const description = queueLoadError
      ? 'Refresh the page or ask an admin to check your queue access.'
      : hasAvailableQueues
        ? selectedQueueName
          ? `There are no active conversations in ${selectedQueueName}.`
          : 'Only conversations from queues assigned to you appear here.'
        : 'Ask an admin to assign you to an active queue before handling customer conversations.';
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          {queueLoadError ? <RefreshCw size={18} /> : <Inbox size={18} />}
        </div>
        <p className="text-sm font-medium text-gray-700">{title}</p>
        <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-gray-400">{description}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => setActive(conv.id)}
          className={cn(
            'flex flex-col gap-1 px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer',
            activeId === conv.id && 'bg-blue-50 border-l-2 border-l-blue-500'
          )}
        >
          {/* Row 1: Title (ticket title if claimed, else channel+fallback) + status badge */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-gray-900 truncate flex-1">
              {conv.ticket
                ? `#${conv.ticket.id} ${conv.ticket.title}`
                : `${CHANNEL_ICONS[conv.channel] ?? '💬'} New conversation`}
            </span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', STATUS_COLORS[conv.status])}>
              {conv.status_display}
            </span>
          </div>

          {/* Row 2: Customer name + elapsed */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="truncate flex-1">
              {CHANNEL_ICONS[conv.channel] ?? '💬'} {conv.customer_name ?? conv.customer_email ?? 'Unknown'}
            </span>
            <span className="shrink-0 ml-2">{formatElapsed(conv.elapsed_seconds)}</span>
          </div>

          {/* Row 3: Queue + assigned agent */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>{conv.queue_name ?? <span className="text-orange-400 font-medium">Unassigned</span>}</span>
            {conv.assigned_to_name && (
              <span className="truncate">· → {conv.assigned_to_name}</span>
            )}
          </div>

          {/* Claim button — only when no ticket exists yet */}
          {!conv.ticket && conv.status !== 'closed' && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => handleClaim(e, conv)}
                disabled={claimingId === conv.id}
                className="text-xs px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors"
              >
                {claimingId === conv.id ? 'Claiming…' : 'Claim'}
              </button>
            </div>
          )}

          {/* Ticket status badge after claimed */}
          {conv.ticket && (
            <span className={cn(
              'self-start text-xs px-1.5 py-0.5 rounded-full font-medium',
              conv.ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
              conv.ticket.status === 'resolved' ? 'bg-blue-100 text-blue-700' :
              conv.ticket.status === 'closed' ? 'bg-gray-100 text-gray-400' :
              'bg-gray-100 text-gray-600'
            )}>
              {conv.ticket.status_display}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
