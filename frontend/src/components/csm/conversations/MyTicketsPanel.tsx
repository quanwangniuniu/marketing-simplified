'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PanelRight, RefreshCw } from 'lucide-react';
import { TicketAPI } from '@/lib/api/csmConversationApi';
import { useCsmConversationStore } from '@/lib/csmConversationStore';
import type { Ticket } from '@/types/csmConversation';
import { PRIORITY_LABELS } from '@/types/csm';
import { SlaCountdown } from './SlaCountdown';
import TicketDetailDrawer from './TicketDetailDrawer';

const PRIORITY_BORDER_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#fb923c',
  medium:   '#60a5fa',
  low:      '#d1d5db',
};

const PRIORITY_TEXT_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-orange-400',
  medium:   'text-blue-400',
  low:      'text-gray-400',
};

interface MyTicketsPanelProps {
  refreshKey?: number;
}

export function MyTicketsPanel({ refreshKey }: MyTicketsPanelProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const setActive = useCsmConversationStore((s) => s.setActiveConversation);
  const activeId = useCsmConversationStore((s) => s.activeConversationId);
  const conversations = useCsmConversationStore((s) => s.conversations);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TicketAPI.myTickets('priority');
      setTickets(data);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Re-fetch when user switches back to this tab/page (e.g. after changing SLA policy)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const handleTicketUpdated = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setDetailTicket((cur) => (cur && cur.id === updated.id ? updated : cur));
  };

  const handleSwitchToConversation = (ticket: Ticket) => {
    if (ticket.conversation == null) return;
    const conv = conversations.find((c) => c.id === ticket.conversation);
    if (conv) setActive(conv.id);
  };

  const openConversationFromDrawer = (conversationId: number) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) setActive(conv.id);
    setDetailTicket(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            My Active Tickets ({tickets.length})
          </p>
          <button
            onClick={load}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
            <p className="text-sm text-gray-400">No active tickets</p>
            <p className="text-xs text-gray-300 mt-1">Claim a conversation to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {tickets.map((ticket) => {
              const isActive = ticket.conversation != null && activeId === ticket.conversation;
              const borderColor = PRIORITY_BORDER_COLOR[ticket.priority] ?? '#d1d5db';

              return (
                <div
                  key={ticket.id}
                  onClick={() => handleSwitchToConversation(ticket)}
                  style={{ borderLeftColor: borderColor }}
                  className={`rounded-lg border border-gray-200 border-l-[3px] p-2.5 flex flex-col gap-1.5 transition-colors ${
                    ticket.conversation
                      ? 'cursor-pointer hover:border-gray-300 hover:bg-gray-50/60'
                      : 'cursor-default'
                  } ${isActive ? 'bg-blue-50/60 border-gray-200' : 'bg-white'}`}
                >
                  {/* Clicking the card switches to the conversation; the button
                      opens the ticket detail drawer (where status is changed). */}
                  <div className="flex items-start gap-1.5">
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate leading-snug ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>
                        #{ticket.id} {ticket.title}
                      </p>
                      {ticket.queue_name && (
                        <span className="text-[10px] text-gray-400 truncate">{ticket.queue_name}</span>
                      )}
                      {ticket.conversation != null && (
                        <span className="text-[10px] text-blue-400 truncate">
                          Conversation #{ticket.conversation}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDetailTicket(ticket); }}
                      title="Open ticket detail"
                      className="shrink-0 p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PanelRight size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`text-[11px] font-medium shrink-0 ${PRIORITY_TEXT_COLOR[ticket.priority] ?? 'text-gray-400'}`}>
                      {PRIORITY_LABELS[ticket.priority as keyof typeof PRIORITY_LABELS] ?? ticket.priority}
                    </span>
                    <span className="text-gray-200 shrink-0">·</span>
                    <SlaCountdown ticket={ticket} now={now} />
                  </div>

                  {/* Current status, read-only. The interactive control lives
                      in the detail drawer. */}
                  <div className="flex items-center justify-end gap-1.5">
                    {ticket.status_color && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: ticket.status_color }}
                        aria-hidden
                      />
                    )}
                    <span className="text-[10px] font-medium text-gray-500">
                      {ticket.status_display}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TicketDetailDrawer
        ticket={detailTicket}
        open={detailTicket != null}
        onClose={() => setDetailTicket(null)}
        onUpdated={handleTicketUpdated}
        onOpenConversation={openConversationFromDrawer}
      />
    </>
  );
}
