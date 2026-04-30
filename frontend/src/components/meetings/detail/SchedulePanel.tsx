'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  scheduledDate: string | null;
  scheduledTime: string | null;
  externalReference: string | null;
  readOnly: boolean;
  onCommit: (patch: {
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    external_reference?: string | null;
  }) => Promise<void>;
}

function toTimeInput(value: string | null): string {
  if (!value) return '';
  const m = value.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

function formatScheduledLabel(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!time) return datePart;
  const t = time.match(/^(\d{2}):(\d{2})/);
  if (!t) return datePart;
  const hour = Number(t[1]);
  const mm = t[2];
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${datePart} · ${display}:${mm}${suffix}`;
}

export default function SchedulePanel({
  scheduledDate,
  scheduledTime,
  externalReference,
  readOnly,
  onCommit,
}: Props) {
  const [date, setDate] = useState(scheduledDate ?? '');
  const [time, setTime] = useState(toTimeInput(scheduledTime));
  const [link, setLink] = useState(externalReference ?? '');

  useEffect(() => setDate(scheduledDate ?? ''), [scheduledDate]);
  useEffect(() => setTime(toTimeInput(scheduledTime)), [scheduledTime]);
  useEffect(() => setLink(externalReference ?? ''), [externalReference]);

  const commit = async (patch: Parameters<Props['onCommit']>[0]) => {
    try {
      await onCommit(patch);
    } catch {
      // toast already raised in parent
    }
  };

  const copyLink = async () => {
    if (!link.trim()) return;
    try {
      await navigator.clipboard.writeText(link.trim());
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const label = formatScheduledLabel(scheduledDate, scheduledTime);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Schedule
        </h2>
      </header>

      {label ? (
        <p className="mb-3 text-sm text-gray-800">{label}</p>
      ) : (
        <p className="mb-3 text-xs italic text-gray-400">Unscheduled</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => commit({ scheduled_date: date || null })}
            disabled={readOnly}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() =>
              commit({
                scheduled_time: time ? (time.length === 5 ? `${time}:00` : time) : null,
              })
            }
            disabled={readOnly}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:bg-gray-50"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Conference link
        </label>
        <div className="flex gap-1">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => commit({ external_reference: link.trim() || null })}
            disabled={readOnly}
            placeholder="https://..."
            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:bg-gray-50"
          />
          {link && (
            <>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100"
                aria-label="Open conference link"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100"
                aria-label="Copy conference link"
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
