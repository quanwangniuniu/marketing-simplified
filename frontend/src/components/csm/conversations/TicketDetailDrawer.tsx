'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, X } from 'lucide-react';
import { TicketAPI } from '@/lib/api/csmConversationApi';
import type { Ticket } from '@/types/csmConversation';
import CsmSettingsDrawerShell from '@/components/csm-settings/CsmSettingsDrawerShell';
import { CsmPriorityBadge } from '@/components/csm/CsmPriorityBadge';
import { SlaDetail } from './SlaCountdown';

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
  /** A status change succeeded — parent refreshes its list row. */
  onUpdated: (ticket: Ticket) => void;
  onOpenConversation: (conversationId: number) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-sm text-gray-700">{children}</div>
    </div>
  );
}

export default function TicketDetailDrawer({
  ticket: ticketProp,
  open,
  onClose,
  onUpdated,
  onOpenConversation,
}: Props) {
  const [updating, setUpdating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [desc, setDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  // Render from a locally-refreshed copy so the drawer's SLA and status stay
  // current even when the list snapshot that opened it has gone stale (e.g. the
  // SLA policy was toggled on another page).
  const [live, setLive] = useState<Ticket | null>(ticketProp);
  const ticket = live;

  // Adopt whatever the parent passes, then keep it fresh from the server while
  // the drawer is open, including a periodic refresh that also drives the tick.
  useEffect(() => { setLive(ticketProp); }, [ticketProp]);
  useEffect(() => {
    if (!open || !ticketProp) return;
    let cancelled = false;
    const refresh = () => {
      TicketAPI.get(ticketProp.id).then((t) => { if (!cancelled) setLive(t); }).catch(() => {});
    };
    refresh();
    const id = setInterval(() => { setNow(Date.now()); refresh(); }, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, ticketProp?.id]);

  // Reset the editable description only when switching to a different ticket, so
  // a background refresh doesn't clobber an in-progress edit.
  useEffect(() => {
    setDesc(ticket?.description ?? '');
  }, [ticket?.id]);

  if (!ticket) return null;

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === ticket.status) return;
    setUpdating(true);
    try {
      const updated = await TicketAPI.update(ticket.id, { status: newStatus });
      setLive(updated);
      onUpdated(updated);
      toast.success(`Ticket #${ticket.id} marked as ${updated.status_display}`);
    } catch {
      toast.error('Failed to update ticket status.');
    } finally {
      setUpdating(false);
    }
  };

  const saveDescription = async () => {
    setSavingDesc(true);
    try {
      const updated = await TicketAPI.update(ticket.id, { description: desc });
      setLive(updated);
      onUpdated(updated);
      toast.success('Description saved.');
    } catch {
      toast.error('Failed to save description.');
    } finally {
      setSavingDesc(false);
    }
  };

  const commitTags = async (next: string[]) => {
    setSavingTags(true);
    try {
      const updated = await TicketAPI.update(ticket.id, { tags: next });
      setLive(updated);
      onUpdated(updated);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // A ticket outside the agent's queues returns 404 (queryset scoping), not
      // 403, so both map to the same access message rather than "not found".
      toast.error(
        status === 403 || status === 404
          ? "You don't have access to edit this ticket."
          : 'Failed to update tags.',
      );
    } finally {
      setSavingTags(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || (ticket.tags ?? []).includes(tag)) { setTagInput(''); return; }
    setTagInput('');
    commitTags([...(ticket.tags ?? []), tag]);
  };

  const removeTag = (tag: string) => commitTags((ticket.tags ?? []).filter((t) => t !== tag));

  const nextStatuses = ticket.available_next_statuses ?? [];
  const descDirty = desc !== (ticket.description ?? '');

  return (
      <CsmSettingsDrawerShell
        open={open}
        onClose={onClose}
        title={`Ticket #${ticket.id}`}
        footer={
          ticket.conversation != null ? (
            <button
              type="button"
              onClick={() => onOpenConversation(ticket.conversation as number)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <MessageSquare size={14} />
              Open conversation
            </button>
          ) : null
        }
      >
        <div className="flex flex-col gap-1 overflow-y-auto px-6 py-4">
          <h3 className="mb-2 text-base font-semibold text-gray-900">{ticket.title}</h3>

          <div className="divide-y divide-gray-100">
            <Row label="Status">
              <div className="flex items-center gap-2">
                {ticket.status_color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ticket.status_color }}
                    aria-hidden
                  />
                )}
                <select
                  value={ticket.status}
                  disabled={updating || nextStatuses.length === 0}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-700 disabled:opacity-70 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value={ticket.status}>{ticket.status_display}</option>
                  {nextStatuses.map((next) => (
                    <option key={next.slug} value={next.slug}>{next.name}</option>
                  ))}
                </select>
              </div>
            </Row>

            <Row label="Priority">
              <CsmPriorityBadge priority={ticket.priority} size="md" />
            </Row>

            <Row label="SLA">
              <SlaDetail ticket={ticket} now={now} />
            </Row>

            <Row label="Queue">{ticket.queue_name ?? '—'}</Row>

            <Row label="Assignee">{ticket.assigned_to_name ?? 'Unassigned'}</Row>

            <Row label="Created">
              {new Date(ticket.created_at).toLocaleString()}
            </Row>
          </div>

          <div className="mt-4">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Tags
            </span>
            {(ticket.tags ?? []).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(ticket.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      disabled={savingTags}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      aria-label={`Remove ${tag}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                disabled={savingTags}
                placeholder="Add a tag…"
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={savingTags || tagInput.trim() === ''}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingTags ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Description
            </span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="Add a description…"
              className="mt-1 w-full resize-y rounded-md border border-gray-200 px-2.5 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            {descDirty && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDesc(ticket.description ?? '')}
                  disabled={savingDesc}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDescription}
                  disabled={savingDesc}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingDesc ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      </CsmSettingsDrawerShell>
  );
}
