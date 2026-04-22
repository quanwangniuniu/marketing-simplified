'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
  const d = new Date(`${ymd.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Build HH:MM slots between startHour and endHour inclusive (end at :00 of endHour). */
function buildTimeSlots(minuteStep: number, startHour: number, endHour: number) {
  const slots: { value: string; label: string }[] = [];
  const startM = startHour * 60;
  const endM = endHour * 60;
  for (let t = startM; t <= endM; t += minuteStep) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const value = `${pad2(h)}:${pad2(m)}`;
    const label = format(new Date(2000, 0, 1, h, m), 'h:mma').toLowerCase();
    slots.push({ value, label });
  }
  return slots;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export interface MeetingDateTimePickerProps {
  dateValue: string;
  timeValue: string;
  onChange: (dateYmd: string, timeHm: string) => void;
  disabled?: boolean;
  /** Slot interval in minutes (default 30, like the reference design). */
  slotMinutes?: number;
  id?: string;
  /** Larger touch-friendly trigger (e.g. create meeting form). */
  variant?: 'default' | 'comfortable';
}

export function MeetingDateTimePicker({
  dateValue,
  timeValue,
  onChange,
  disabled,
  slotMinutes = 30,
  id,
  variant = 'default',
}: MeetingDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseYmd(dateValue) ?? new Date());
  const [draftDate, setDraftDate] = useState<Date | null>(() => parseYmd(dateValue));
  const [draftTime, setDraftTime] = useState(() => timeValue.trim());

  const timeSlots = useMemo(
    () => buildTimeSlots(slotMinutes, 6, 22),
    [slotMinutes],
  );

  useEffect(() => {
    if (!open) return;
    const d = parseYmd(dateValue);
    setDraftDate(d);
    setDraftTime(timeValue.trim());
    setViewMonth(d ?? new Date());
  }, [open, dateValue, timeValue]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const gridStart = startOfWeek(start, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(end, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const summary = useMemo(() => {
    const d = parseYmd(dateValue);
    if (!d) return 'Select date & time';
    const datePart = format(d, 'EEE, MMM d, yyyy');
    if (!timeValue.trim()) return datePart;
    const hm = timeValue.trim();
    const m = hm.match(/^(\d{2}):(\d{2})$/);
    if (!m) return `${datePart} · ${timeValue}`;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const tLabel = format(new Date(2000, 0, 1, hh, mm), 'h:mma').toLowerCase();
    return `${datePart} · ${tLabel}`;
  }, [dateValue, timeValue]);

  const handleConfirm = useCallback(() => {
    if (!draftDate) return;
    const ymd = format(draftDate, 'yyyy-MM-dd');
    onChange(ymd, draftTime.trim());
    setOpen(false);
  }, [draftDate, draftTime, onChange]);

  const headerLine = draftDate
    ? format(draftDate, 'EEEE, MMMM d')
    : 'Pick a date';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex w-full items-center gap-3 text-left',
            variant === 'comfortable'
              ? 'rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base shadow-sm min-h-[52px]'
              : 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm',
            'focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !dateValue && 'text-gray-500',
          )}
        >
          <CalendarIcon
            className={cn(
              'shrink-0 text-[#3CCED7]',
              variant === 'comfortable' ? 'h-5 w-5' : 'h-4 w-4',
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{summary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-auto max-w-[min(100vw-2rem,520px)] border-0 bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl">
          <h3 className="mb-3 text-center text-sm font-semibold text-slate-900">
            Select a Date &amp; Time
          </h3>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
            <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold tracking-wide text-slate-800">
              {format(viewMonth, 'MMMM').toUpperCase()}
            </span>
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-medium text-slate-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = draftDate && isSameDay(day, draftDate);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setDraftDate(day);
                    setDraftTime('');
                  }}
                  className={cn(
                    'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors',
                    !inMonth && 'text-slate-300',
                    inMonth && !isSelected && 'text-slate-800 hover:bg-[#3CCED7]/15',
                    isToday && !isSelected && inMonth && 'ring-1 ring-blue-300',
                    isSelected && 'bg-[#3CCED7] font-semibold text-white shadow-sm hover:bg-[#3CCED7]',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
            </div>

          {/* Time panel — right column on md+, below calendar on small screens */}
          {draftDate ? (
            <div className="w-full shrink-0 rounded-xl border border-[#3CCED7]/20 bg-slate-50/80 p-3 shadow-inner md:mt-0 md:w-[220px]">
              <p className="mb-2 text-center text-xs font-medium text-slate-700">{headerLine}</p>
              <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-0.5">
                {timeSlots.map((slot) => {
                  const active = draftTime === slot.value;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setDraftTime(slot.value)}
                      className={cn(
                        'w-full rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-[#3CCED7] bg-white text-[#3CCED7] hover:bg-[#3CCED7]/10',
                      )}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
                <label className="sr-only" htmlFor={`${id ?? 'meeting-dt'}-custom`}>
                  Custom time
                </label>
                <input
                  id={`${id ?? 'meeting-dt'}-custom`}
                  type="time"
                  step={60}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                  title="Pick any minute"
                />
              </div>
              <Button
                type="button"
                className="mt-2 w-full bg-[#3CCED7] text-xs text-white hover:bg-[#2AB5BD]"
                size="sm"
                disabled={!draftTime.trim()}
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </div>
          ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
