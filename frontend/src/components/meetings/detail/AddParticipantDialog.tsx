'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search } from 'lucide-react';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { ParticipantLink } from '@/types/meeting';

interface Member {
  id: number;
  user: { id: number; username?: string; email?: string; name?: string };
  role?: string;
  is_active?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  meetingId: number;
  members: Member[];
  existingParticipantUserIds: number[];
  onCreated: (participant: ParticipantLink) => void;
}

function memberUserId(m: Member): number {
  return m.user?.id ?? m.id;
}

function memberDisplay(m: Member): { name: string; email: string } {
  const u = m.user;
  return {
    name: u?.name || u?.username || u?.email || `User #${memberUserId(m)}`,
    email: u?.email || '',
  };
}

export default function AddParticipantDialog({
  open,
  onOpenChange,
  projectId: _projectId,
  meetingId,
  members,
  existingParticipantUserIds,
  onCreated,
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedUserId(null);
    setRole('');
    setSubmitting(false);
  }, [open]);

  const available = useMemo(() => {
    return members.filter((m) => !existingParticipantUserIds.includes(memberUserId(m)));
  }, [members, existingParticipantUserIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((m) => {
      const { name, email } = memberDisplay(m);
      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        String(memberUserId(m)).includes(q)
      );
    });
  }, [available, query]);

  const submit = async () => {
    if (!selectedUserId || submitting) return;
    setSubmitting(true);
    try {
      const created = await MeetingsAPI.addParticipant(_projectId, meetingId, {
        user: selectedUserId,
        role: role.trim() || null,
      });
      toast.success('Participant added');
      onCreated(created);
      onOpenChange(false);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string; non_field_errors?: string[] } }; message?: string };
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.message ||
        'Could not add participant.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="flex items-start justify-between px-5 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-gray-900">
                Add participant
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-gray-500">
                Pick a project member and optionally set a role.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 px-5 pb-5 pt-4">
            <div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, or id…"
                  className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
              <ul className="mt-2 max-h-52 overflow-y-auto rounded-md ring-1 ring-gray-100">
                {filtered.length === 0 && (
                  <li className="px-3 py-3 text-xs text-gray-400">
                    {available.length === 0
                      ? 'All project members are already in this meeting.'
                      : 'No matches.'}
                  </li>
                )}
                {filtered.map((m) => {
                  const uid = memberUserId(m);
                  const { name, email } = memberDisplay(m);
                  const active = selectedUserId === uid;
                  return (
                    <li key={uid}>
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(uid)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                          active ? 'bg-[#3CCED7]/10' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{name}</p>
                          {email && (
                            <p className="truncate text-[11px] text-gray-500">{email}</p>
                          )}
                        </div>
                        {active && (
                          <span className="shrink-0 rounded-full bg-[#3CCED7]/20 px-2 py-0.5 text-[11px] font-medium text-[#0E8A96]">
                            Selected
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <label
                htmlFor="participant-role"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Role (optional)
              </label>
              <input
                id="participant-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Facilitator, Attendee, Notetaker…"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!selectedUserId || submitting}
                title={!selectedUserId ? 'Pick a member first.' : undefined}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Adding…' : 'Add participant'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
