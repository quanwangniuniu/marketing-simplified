'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  BookingLinkAPI,
  bookingLinkUrl,
  type BookingLinkDTO,
  type BookingLinkWritePayload,
} from '@/lib/api/calendarApi';
import { CalendarAPI, type CalendarDTO } from '@/lib/api/calendarApi';
import { googleCalendarApi } from '@/lib/api/googleCalendarApi';
import { useProjectStore } from '@/lib/projectStore';
import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import { detectTimezone } from './bookingSlots';

/**
 * Owner-side management for booking links.
 *
 * The public page is useless until someone can generate a link, which is what
 * this covers. Rules map one-to-one onto the availability layer, so anything
 * saved here is what the public page will offer.
 */

/** The durations people actually pick; anything else goes through Custom. */
const DURATION_PRESETS = [15, 30, 45, 60];

const DEFAULT_FORM = {
  title: '',
  slug: '',
  description: '',
  calendar_id: '',
  host_id: '' as string,
  invitee_ids: [] as number[],
  invitee_emails: [] as string[],
  duration_minutes: 30,
  slot_increment_minutes: 15,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 60,
  max_advance_days: 60,
};

/** Mirrors the backend: blank windows fall back to working hours, then Mon–Fri 9–5. */
const WINDOW_HINT =
  'taken from your calendar working hours, or Monday–Friday 09:00–17:00 if you have none set.';

function noticeLabel(minutes: number): string {
  if (!minutes) return 'no';
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 60 === 0 && minutes < 1440) return `${minutes / 60}h`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  return `${Math.round(minutes / 60)}h`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    // calendars uses a custom error envelope: {error, message, details:[{field, message}]}
    const details = record.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { field?: string; message?: string };
      if (first?.message) {
        return first.field ? `${first.field}: ${first.message}` : first.message;
      }
    }
    if (typeof record.message === 'string' && record.message !== 'VALIDATION_ERROR') {
      return record.message;
    }
  }
  return fallback;
}

interface BookingLinkManagerProps {
  /** Needed to build the shareable URL, which is org-scoped by design. */
  orgSlug: string;
}

export default function BookingLinkManager({ orgSlug }: BookingLinkManagerProps) {
  const projectId = useProjectStore((state) => state.activeProject?.id ?? null);
  const [links, setLinks] = useState<BookingLinkDTO[]>([]);
  const [calendars, setCalendars] = useState<CalendarDTO[]>([]);
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  // What the user has typed into the guest box, before it resolves to either a
  // colleague or a plain address.
  const [inviteeQuery, setInviteeQuery] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);

  // The project store hydrates after first render, so the initial fetch can be
  // unscoped and land after the scoped one. Drop superseded responses rather
  // than letting them repopulate the picker with out-of-project calendars.
  const fetchSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [linkList, calendarList, googleStatus] = await Promise.all([
        BookingLinkAPI.list(),
        CalendarAPI.listCalendars(projectId).then((res) => res.data).catch(() => []),
        googleCalendarApi
          .getStatus()
          .then((status) => Boolean(status?.connected))
          .catch(() => false),
      ]);
      if (seq !== fetchSeq.current) return;
      setGoogleConnected(googleStatus);
      setLinks(linkList);
      // /api/calendars/ is paginated, so the payload is {count, results} rather
      // than a bare array. Accept both — an array-only check silently yields an
      // empty dropdown against the real API.
      const all = Array.isArray(calendarList)
        ? calendarList
        : (calendarList as { results?: CalendarDTO[] })?.results ?? [];
      // Scoped to the active project on purpose. The calendar page filters its
      // own view by project, so an unscoped picker can offer a calendar whose
      // events that page will never display - the booking would succeed and
      // then appear nowhere.
      setCalendars(all);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError(errorMessage(err, 'Could not load your booking links.'));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Hosting a colleague's time is only allowed inside a shared project, so the
  // candidates are exactly this project's members. Failure is non-fatal: the
  // picker falls back to just you.
  useEffect(() => {
    if (projectId == null) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    ProjectAPI
      .getAllProjectMembers(projectId)
      .then((rows) => {
        if (!cancelled) setMembers(rows.filter((row) => row.is_active));
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const hasCalendar = calendars.length > 0;
  // Not a gate. Google export only picks up the primary calendar, and
  // `is_primary` is set solely by the Google connect flow — so this is worth
  // saying only when a Google connection actually exists.
  const selected = calendars.find((c) => c.id === form.calendar_id);
  // Hosting a colleague is checked server-side against the calendar's project,
  // so a project-less calendar can only ever book your own time. Mirror that
  // here rather than letting the user pick something the API will reject.
  const editingCalendarId = editingId
    ? links.find((link) => link.id === editingId)?.calendar
    : undefined;
  const hostCalendar = selected ?? calendars.find((c) => c.id === editingCalendarId);
  const canHostOthers = Boolean(hostCalendar?.project_id) && members.length > 0;
  const hostCandidates = canHostOthers ? members : [];

  const memberLabel = (member: ProjectMemberData) =>
    member.user.name || member.user.username || member.user.email || '';
  const chosenInvitees = members.filter((member) =>
    form.invitee_ids.includes(member.user.id),
  );
  // Filtered client-side: a project's membership is already loaded and small
  // enough that a round trip per keystroke would be slower, not faster.
  const inviteeMatches =
    canHostOthers && inviteeQuery.trim()
      ? members
          .filter(
            (member) =>
              // Already chosen people drop out of the results, the way a share
              // dialog stops offering someone once they are on the list.
              !form.invitee_ids.includes(member.user.id) &&
              `${memberLabel(member)} ${member.user.email ?? ''}`
                .toLowerCase()
                .includes(inviteeQuery.trim().toLowerCase()),
          )
          .slice(0, 5)
      : [];
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeQuery.trim());
  const wontSyncToGoogle = googleConnected && !!selected && !selected.is_primary;

  // Only reachable outside a project. The calendars API treats project_id as
  // read-only, so anything created here is project-less - fine in the unscoped
  // view, invisible inside a project.
  const createCalendar = async () => {
    if (creatingCalendar) return;
    setCreatingCalendar(true);
    setError(null);
    try {
      const created = await CalendarAPI.createCalendar({
        name: 'My Calendar',
        timezone: detectTimezone(),
      });
      await refresh();
      setForm((current) => ({ ...current, calendar_id: created.data.id }));
    } catch (err) {
      setError(errorMessage(err, 'Could not create a calendar.'));
    } finally {
      setCreatingCalendar(false);
    }
  };

  const startCreating = () => {
    // No timezone here: the API derives it from the owner's calendar settings.
    setForm({ ...DEFAULT_FORM, calendar_id: calendars[0]?.id ?? '' });
    setEditingId(null);
    setShowAdvanced(false);
    setCustomDuration(false);
    setCreating(true);
    setError(null);
  };

  const startEditing = (link: BookingLinkDTO) => {
    setForm({
      title: link.title,
      slug: link.slug,
      description: link.description ?? '',
      calendar_id: '',
      host_id: String(link.host?.id ?? ''),
      invitee_ids: (link.invitees ?? [])
        .map((person) => person.id)
        .filter((id): id is number => id != null),
      invitee_emails: (link.invitees ?? [])
        .filter((person) => person.id == null)
        .map((person) => person.email),
      duration_minutes: link.duration_minutes,
      slot_increment_minutes: link.slot_increment_minutes,
      buffer_before_minutes: link.buffer_before_minutes,
      buffer_after_minutes: link.buffer_after_minutes,
      min_notice_minutes: link.min_notice_minutes,
      max_advance_days: link.max_advance_days,
    });
    setEditingId(link.id);
    // Open the advanced block when this link actually uses non-default rules,
    // so an edit never silently hides the values being changed.
    setShowAdvanced(
      link.buffer_before_minutes > 0 ||
        link.buffer_after_minutes > 0 ||
        link.min_notice_minutes !== DEFAULT_FORM.min_notice_minutes ||
        link.max_advance_days !== DEFAULT_FORM.max_advance_days ||
        link.slot_increment_minutes !== DEFAULT_FORM.slot_increment_minutes,
    );
    setCustomDuration(!DURATION_PRESETS.includes(link.duration_minutes));
    setCreating(true);
    setError(null);
  };

  const closeForm = () => {
    setCreating(false);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: BookingLinkWritePayload = {
        ...form,
        slug: form.slug.trim() || slugify(form.title),
        description: form.description.trim() || null,
        // Blank means "me"; the API reads null the same way.
        host_id: form.host_id ? Number(form.host_id) : null,
        invitee_ids: form.invitee_ids,
        invitee_emails: form.invitee_emails,
      };
      if (editingId) {
        // calendar_id is only sent when the user actually repointed the link;
        // an empty string would fail validation.
        if (!payload.calendar_id) delete payload.calendar_id;
        const updated = await BookingLinkAPI.update(editingId, payload);
        setLinks((prev) =>
          prev
            .map((l) => (l.id === editingId ? updated.data : l))
            .sort((a, b) => a.title.localeCompare(b.title)),
        );
      } else {
        const created = await BookingLinkAPI.create(payload);
        setLinks((prev) =>
          [...prev, created.data].sort((a, b) => a.title.localeCompare(b.title)),
        );
      }
      closeForm();
    } catch (err) {
      setError(
        errorMessage(
          err,
          editingId
            ? 'Could not save your changes.'
            : 'Could not create the booking link.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (link: BookingLinkDTO) => {
    setError(null);
    // Optimistic: the toggle is trivially reversible and the list shouldn't
    // flicker for a boolean.
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)),
    );
    try {
      await BookingLinkAPI.update(link.id, { is_active: !link.is_active });
    } catch (err) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, is_active: link.is_active } : l)),
      );
      setError(errorMessage(err, 'Could not update the link.'));
    }
  };

  const handleDelete = async (link: BookingLinkDTO) => {
    setError(null);
    try {
      await BookingLinkAPI.destroy(link.id);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the link.'));
    }
  };

  // A link's own organization is authoritative: the server derives it from the
  // user's organization, which can differ from the active project's org.
  const linkOrg = (link: BookingLinkDTO) => link.organization_slug || orgSlug;

  const copyUrl = async (link: BookingLinkDTO) => {
    const url = bookingLinkUrl(linkOrg(link), link.slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(link.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy to the clipboard. The URL is shown below the title.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8" data-testid="booking-link-manager">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Booking links</h1>
          <p className="mt-1 text-sm text-gray-500">
            Share a link and let people book time from your available slots.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={startCreating}
            data-testid="booking-link-new"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#3CCED7] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2AB5BD]"
          >
            <Plus className="h-4 w-4" />
            New link
          </button>
        )}
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          data-testid="booking-link-error"
        >
          {error}
        </div>
      )}

      {creating && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
          data-testid="booking-link-form"
        >
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? 'Edit booking link' : 'New booking link'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="bl-title" className="block text-xs font-medium text-gray-600">
                Title
              </label>
              <input
                id="bl-title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Intro call"
                data-testid="booking-link-title"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bl-slug" className="block text-xs font-medium text-gray-600">
                URL
              </label>
              <div className="mt-1 flex items-center gap-1 text-sm">
                <span className="shrink-0 text-gray-400">/book/{orgSlug}/</span>
                <input
                  id="bl-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder={slugify(form.title) || 'intro-call'}
                  data-testid="booking-link-slug"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Duration as presets: a free number field invites answers nobody
                wants (37 minutes), and the common cases are four values. */}
            <div className="sm:col-span-2">
              <span className="block text-xs font-medium text-gray-600">Duration</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {DURATION_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      setCustomDuration(false);
                      setForm({ ...form, duration_minutes: minutes });
                    }}
                    data-testid={`booking-link-duration-${minutes}`}
                    aria-pressed={!customDuration && form.duration_minutes === minutes}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      !customDuration && form.duration_minutes === minutes
                        ? 'border-[#3CCED7] bg-[#3CCED7]/10 font-medium text-[#0E8A96]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomDuration(true)}
                  data-testid="booking-link-duration-custom"
                  aria-pressed={customDuration}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    customDuration
                      ? 'border-[#3CCED7] bg-[#3CCED7]/10 font-medium text-[#0E8A96]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Custom
                </button>
                {customDuration && (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      aria-label="Custom duration in minutes"
                      value={form.duration_minutes}
                      onChange={(e) =>
                        setForm({ ...form, duration_minutes: Number(e.target.value) })
                      }
                      data-testid="booking-link-duration_minutes"
                      className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                    />
                    <span className="text-xs text-gray-400">min</span>
                  </span>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bl-calendar" className="block text-xs font-medium text-gray-600">
                Book into
              </label>
              <select
                id="bl-calendar"
                required={!editingId}
                disabled={!hasCalendar}
                value={form.calendar_id}
                onChange={(e) => setForm({ ...form, calendar_id: e.target.value })}
                data-testid="booking-link-calendar"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {!hasCalendar
                    ? 'No calendar available'
                    : editingId
                      ? 'Keep current calendar'
                      : 'Select a calendar…'}
                </option>
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bl-host" className="block text-xs font-medium text-gray-600">
                Whose time
              </label>
              <select
                id="bl-host"
                disabled={!canHostOthers}
                value={form.host_id}
                onChange={(e) => setForm({ ...form, host_id: e.target.value })}
                data-testid="booking-link-host"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Me</option>
                {hostCandidates.map((member) => (
                  <option key={member.user.id} value={String(member.user.id)}>
                    {member.user.name || member.user.username || member.user.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">
                {canHostOthers
                  ? 'Publishes their availability, and bookings land on their calendar.'
                  : 'Pick a project calendar above to set this up for a colleague.'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bl-invitee" className="block text-xs font-medium text-gray-600">
                Who it&apos;s for <span className="font-normal text-gray-400">(optional)</span>
              </label>

              {/*
                A list, not a single slot: one link can go to several people,
                mixing colleagues who have accounts with plain addresses.
              */}
              {(chosenInvitees.length > 0 || form.invitee_emails.length > 0) && (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {chosenInvitees.map((member) => (
                    <li
                      key={member.user.id}
                      data-testid="booking-link-invitee-chip"
                      className="flex items-center gap-1.5 rounded-full border border-[#3CCED7]/40 bg-[#3CCED7]/10 py-1 pl-2.5 pr-1.5 text-xs text-[#0E8A96]"
                    >
                      <span className="max-w-[14rem] truncate">{memberLabel(member)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            invitee_ids: form.invitee_ids.filter(
                              (id) => id !== member.user.id,
                            ),
                          })
                        }
                        aria-label={`Remove ${memberLabel(member)}`}
                        className="shrink-0 rounded-full p-0.5 text-[#0E8A96]/70 transition-colors hover:text-[#0E8A96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                  {form.invitee_emails.map((address) => (
                    <li
                      key={address}
                      data-testid="booking-link-invitee-chip"
                      className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1.5 text-xs text-gray-700"
                    >
                      <span className="max-w-[14rem] truncate">{address}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            invitee_emails: form.invitee_emails.filter(
                              (existing) => existing !== address,
                            ),
                          })
                        }
                        aria-label={`Remove ${address}`}
                        className="shrink-0 rounded-full p-0.5 text-gray-400 transition-colors hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <input
                id="bl-invitee"
                type="text"
                autoComplete="off"
                value={inviteeQuery}
                onChange={(e) => setInviteeQuery(e.target.value)}
                placeholder="Search a colleague, or type an email address"
                data-testid="booking-link-invitee"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
              {/*
                Two ways out of one box, as in a share dialog: pick someone we
                know, or commit an address for someone we don't.
              */}
              {inviteeMatches.length > 0 && (
                <ul
                  data-testid="booking-link-invitee-results"
                  className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  {inviteeMatches.map((member) => (
                    <li key={member.user.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            invitee_ids: [...form.invitee_ids, member.user.id],
                          });
                          setInviteeQuery('');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">{memberLabel(member)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {inviteeMatches.length === 0 &&
                looksLikeEmail &&
                !form.invitee_emails.includes(inviteeQuery.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        invitee_emails: [
                          ...form.invitee_emails,
                          inviteeQuery.trim().toLowerCase(),
                        ],
                      });
                      setInviteeQuery('');
                    }}
                    data-testid="booking-link-invitee-email"
                    className="mt-1 w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Invite <span className="font-medium">{inviteeQuery.trim()}</span> as a guest
                  </button>
                )}
              <p className="mt-1 text-[11px] text-gray-400">
                {canHostOthers
                  ? 'A colleague gets a notification. A guest just gets the link from you.'
                  : 'Type an email address for whoever this link is going to.'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bl-description" className="block text-xs font-medium text-gray-600">
                Description
                <span className="ml-1 font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="bl-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What should people expect from this meeting?"
                data-testid="booking-link-description"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Everything below is an advanced default most people never change,
              so it stays out of the way until asked for. */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              data-testid="booking-link-advanced-toggle"
              aria-expanded={showAdvanced}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  showAdvanced ? 'rotate-90' : ''
                }`}
              />
              Scheduling rules
              <span className="font-normal text-gray-400">
                — buffers, notice, how far ahead
              </span>
            </button>

            {showAdvanced && (
              <div
                data-testid="booking-link-advanced"
                className="mt-3 grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                {(
                  [
                    ['slot_increment_minutes', 'Slot every', 'min', 1],
                    ['min_notice_minutes', 'Minimum notice', 'min', 0],
                    ['buffer_before_minutes', 'Buffer before', 'min', 0],
                    ['buffer_after_minutes', 'Buffer after', 'min', 0],
                    ['max_advance_days', 'Bookable ahead', 'days', 1],
                  ] as const
                ).map(([field, label, unit, min]) => (
                  <div key={field}>
                    <label
                      htmlFor={`bl-${field}`}
                      className="block text-xs font-medium text-gray-600"
                    >
                      {label}
                      <span className="ml-1 font-normal text-gray-400">({unit})</span>
                    </label>
                    <input
                      id={`bl-${field}`}
                      type="number"
                      min={min}
                      value={form[field]}
                      onChange={(e) =>
                        setForm({ ...form, [field]: Number(e.target.value) })
                      }
                      data-testid={`booking-link-${field}`}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                ))}

                {/* Availability is not editable here yet, so say where the hours
                    actually come from rather than leaving it a mystery. */}
                <p className="sm:col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Availability:</span>{' '}
                  {WINDOW_HINT}
                </p>
              </div>
            )}
          </div>

          {!hasCalendar && (
            <div
              data-testid="booking-link-no-calendar"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p>
                    You don&apos;t have a calendar to book into. Calendars belong to
                    projects, and this project doesn&apos;t have one yet.
                  </p>
                  {projectId == null ? (
                    <button
                      type="button"
                      disabled={creatingCalendar}
                      onClick={createCalendar}
                      data-testid="booking-link-create-calendar"
                      className="mt-2 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {creatingCalendar ? 'Creating…' : 'Create a calendar for me'}
                    </button>
                  ) : (
                    <p className="mt-1.5 text-amber-700">
                      Projects normally get a calendar automatically, so this is
                      unexpected — ask an admin to provision one for the project.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {wontSyncToGoogle && (
            <div
              data-testid="booking-link-no-google-sync"
              className="mt-4 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>
                Bookings on this calendar won&apos;t appear in Google Calendar —
                only your Google-synced calendar exports. They will still show in
                your in-app calendar and availability.
              </span>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasCalendar}
              data-testid="booking-link-save"
              className="rounded-lg bg-[#3CCED7] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2AB5BD] disabled:opacity-60 disabled:shadow-none"
            >
              {saving
                ? editingId
                  ? 'Saving…'
                  : 'Creating…'
                : editingId
                  ? 'Save changes'
                  : 'Create link'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      ) : links.length === 0 && !creating ? (
        <div
          className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm animate-in fade-in duration-300"
          data-testid="booking-link-empty"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-50">
            <Link2 className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-gray-900">No booking links yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Create a link, share the URL, and people can book time from your available
            slots without the back-and-forth.
          </p>
          <button
            type="button"
            onClick={startCreating}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#3CCED7] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2AB5BD]"
          >
            <Plus className="h-4 w-4" />
            New link
          </button>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="booking-link-list">
          {links.map((link, index) => {
            const path = `/book/${linkOrg(link)}/${link.slug}`;
            const isCopied = copied === link.id;
            return (
              <li
                key={link.id}
                data-testid="booking-link-item"
                style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                className={`group rounded-2xl border bg-white p-4 transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 ${
                  link.is_active
                    ? 'border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md'
                    : 'border-gray-200 bg-gray-50/60 shadow-sm'
                }`}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          link.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      />
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {link.title}
                      </h3>
                      {!link.is_active && (
                        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    {/*
                      created_by_name is blank when the host set the link up
                      themselves, so this only appears when it says something
                      the title does not.
                    */}
                    {link.created_by_name && (
                      <p
                        data-testid="booking-link-host-note"
                        className="mt-1 flex items-center gap-1 pl-3.5 text-xs text-gray-500"
                      >
                        <User className="h-3 w-3 text-gray-400" />
                        {link.host.name}&apos;s time · set up by {link.created_by_name}
                      </p>
                    )}
                    {link.description && (
                      <p className="mt-1 line-clamp-1 pl-3.5 text-xs text-gray-500">
                        {link.description}
                      </p>
                    )}
                  </div>

                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {link.duration_minutes} min
                  </span>
                </div>

                {/* The URL is the artifact people actually share, so it gets the
                    weight — a field you can read and copy, not caption text. */}
                <div className="mt-3 flex items-stretch gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <Link2 className="mr-2 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate font-mono text-xs text-gray-600">
                      {path}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyUrl(link)}
                    aria-label={`Copy link for ${link.title}`}
                    data-testid="booking-link-copy"
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-200 ${
                      isCopied
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                  <a
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open booking page for ${link.title}`}
                    data-testid="booking-link-open"
                    className="inline-flex shrink-0 items-center rounded-lg border border-gray-200 px-2.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                {/* Rules the owner set, so the card says what the link will do
                    without opening anything. */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                    <span>{noticeLabel(link.min_notice_minutes)} notice</span>
                    <span aria-hidden>·</span>
                    <span>up to {link.max_advance_days}d ahead</span>
                    {(link.buffer_before_minutes > 0 || link.buffer_after_minutes > 0) && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {link.buffer_before_minutes}/{link.buffer_after_minutes} min buffer
                        </span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>{link.timezone}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(link)}
                      data-testid="booking-link-edit"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(link)}
                      data-testid="booking-link-toggle"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    >
                      {link.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(link)}
                      aria-label={`Delete ${link.title}`}
                      data-testid="booking-link-delete"
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
