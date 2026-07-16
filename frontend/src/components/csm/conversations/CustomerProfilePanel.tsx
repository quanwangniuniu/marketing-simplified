'use client';

import React, { useEffect, useState } from 'react';
import { CustomerProfile, LinkedTicket } from '@/types/csmConversation';
import CustomerStatusLabelControl from './CustomerStatusLabelControl';
import CustomerInternalNotes from './CustomerInternalNotes';
import StatusLabelBadge from '@/components/csm-settings/status-labels/StatusLabelBadge';
import { CsmPriorityBadge } from '@/components/csm/CsmPriorityBadge';

interface CustomerProfilePanelProps {
  profile: CustomerProfile | null;
  linkedTickets: LinkedTicket[];
  conversationId: number;
}

const TICKET_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-400',
};

export function CustomerProfilePanel({
  profile,
  linkedTickets,
  conversationId,
}: CustomerProfilePanelProps) {

  // Local status-label state so the header badge updates immediately on change.
  const [label, setLabel] = useState<{ id: number | null; name: string | null; color: string | null }>({
    id: profile?.status_label ?? null,
    name: profile?.status_label_name ?? null,
    color: profile?.status_label_color ?? null,
  });

  useEffect(() => {
    setLabel({
      id: profile?.status_label ?? null,
      name: profile?.status_label_name ?? null,
      color: profile?.status_label_color ?? null,
    });
  }, [profile?.id, profile?.status_label, profile?.status_label_name, profile?.status_label_color]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 p-4">
        No customer linked
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Profile header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Conversation #{conversationId}
        </p>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          </div>
        </div>
        {label.id && label.name && (
          <StatusLabelBadge name={label.name} color={label.color ?? '#475569'} />
        )}
      </div>

      {/* Status label (assign / change) */}
      <div className="px-4 py-3 border-b border-gray-100">
        <CustomerStatusLabelControl
          customerId={profile.id}
          projectId={profile.project_id}
          value={label.id}
          valueName={label.name}
          valueColor={label.color}
          onChange={setLabel}
        />
      </div>

      {/* Customer details */}
      <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-2">
        {profile.company && (
          <div>
            <p className="text-xs text-gray-400">Company</p>
            <p className="text-sm text-gray-700">{profile.company}</p>
          </div>
        )}
        {profile.phone && (
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-sm text-gray-700">{profile.phone}</p>
          </div>
        )}
        {profile.organisation_name && (
          <div>
            <p className="text-xs text-gray-400">Organisation</p>
            <p className="text-sm text-gray-700">{profile.organisation_name}</p>
          </div>
        )}
        {profile.region_name && (
          <div>
            <p className="text-xs text-gray-400">Region</p>
            <p className="text-sm text-gray-700">{profile.region_name}</p>
          </div>
        )}
      </div>

      {/* Linked tickets */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Linked Tickets</p>
        {linkedTickets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-600">No linked ticket yet</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Create a ticket from this conversation to establish the bidirectional reference.
            </p>
          </div>
        ) : (
          linkedTickets.map((ticket) => (
            <div key={ticket.id} className="rounded-lg border border-gray-100 p-2">
              <p className="text-xs font-medium text-gray-800 truncate">#{ticket.id} {ticket.title}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">Linked to conversation #{conversationId}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${TICKET_STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <CsmPriorityBadge priority={ticket.priority} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Internal notes (MED-217) — agents/admins only, never shown to the customer */}
      <CustomerInternalNotes customerId={profile.id} />

    </div>
  );
}
