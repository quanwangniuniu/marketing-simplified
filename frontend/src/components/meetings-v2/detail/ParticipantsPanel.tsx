'use client';

import { useMemo, useState } from 'react';
import { Users, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { ParticipantLink } from '@/types/meeting';
import AddParticipantDialog from './AddParticipantDialog';

interface Member {
  id: number;
  user: { id: number; username?: string; email?: string; name?: string };
  role?: string;
  is_active?: boolean;
}

interface Props {
  projectId: number;
  meetingId: number;
  participants: ParticipantLink[];
  members: Member[];
  readOnly: boolean;
  onRefresh: () => void;
}

function memberLookup(members: Member[]): Map<number, Member> {
  const map = new Map<number, Member>();
  for (const m of members) {
    if (m.user?.id) map.set(m.user.id, m);
  }
  return map;
}

function participantLabel(p: ParticipantLink, lookup: Map<number, Member>): string {
  const m = lookup.get(p.user);
  if (!m) return `User #${p.user}`;
  return (
    m.user?.name ||
    m.user?.username ||
    m.user?.email ||
    `User #${p.user}`
  );
}

export default function ParticipantsPanel({
  projectId,
  meetingId,
  participants,
  members,
  readOnly,
  onRefresh,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const lookup = useMemo(() => memberLookup(members), [members]);
  const existingIds = participants.map((p) => p.user);

  const remove = async (linkId: number) => {
    setRemovingId(linkId);
    try {
      await MeetingsAPI.removeParticipant(projectId, meetingId, linkId);
      toast.success('Participant removed');
      onRefresh();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Could not remove participant.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Participants
          </h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {participants.length}
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            aria-label="Add participant"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>Add</span>
          </button>
        )}
      </header>

      {participants.length === 0 ? (
        <p className="text-xs italic text-gray-400">No participants yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {participants.map((p) => {
            const name = participantLabel(p, lookup);
            const roleText = (p.role || '').trim();
            return (
              <li
                key={p.id}
                className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ring-1 ring-gray-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{name}</p>
                  {roleText && (
                    <p className="truncate text-[11px] text-gray-500">{roleText}</p>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={removingId === p.id}
                    aria-label={`Remove ${name}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddParticipantDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        meetingId={meetingId}
        members={members}
        existingParticipantUserIds={existingIds}
        onCreated={() => onRefresh()}
      />
    </section>
  );
}
