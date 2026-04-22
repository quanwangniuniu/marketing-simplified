'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock3,
  MessageSquare,
  Plus,
  Rocket,
  Target,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ProjectMemberPicker } from '@/components/meetings/ProjectMemberPicker';
import type { UnifiedMeetingTemplateOption } from '@/lib/meetings/unifiedMeetingTemplates';

type QuickCreateSubmitPayload = {
  meetingType: string;
  title: string;
  objective: string;
  scheduledDate?: string;
  scheduledTime?: string;
  participantUserIds: number[];
};

type QuickCreateMeetingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  projectId: number;
  templateOptions: UnifiedMeetingTemplateOption[];
  onSubmit: (payload: QuickCreateSubmitPayload) => Promise<void>;
};

const DURATION_OPTIONS = [
  { id: '15m', label: '15m', minutes: 15 },
  { id: '30m', label: '30m', minutes: 30 },
  { id: '1h', label: '1h', minutes: 60 },
  { id: '1.5h', label: '1.5h', minutes: 90 },
  { id: 'custom', label: 'No specific duration', minutes: 0 },
] as const;

const WHEN_OPTIONS = [
  { id: 'start_now', label: 'Start Now' },
  { id: 'in_30_mins', label: 'In 30 mins' },
  { id: 'tomorrow_morning', label: 'Tomorrow Morning' },
  { id: 'pick_date', label: 'Pick Date' },
] as const;

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function scheduleFromWhen(whenId: (typeof WHEN_OPTIONS)[number]['id'], fallbackDate: string, fallbackTime: string) {
  const now = new Date();
  if (whenId === 'start_now') {
    return { scheduledDate: toDateString(now), scheduledTime: toTimeString(now) };
  }
  if (whenId === 'in_30_mins') {
    const d = new Date(now.getTime() + 30 * 60 * 1000);
    return { scheduledDate: toDateString(d), scheduledTime: toTimeString(d) };
  }
  if (whenId === 'tomorrow_morning') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return { scheduledDate: toDateString(d), scheduledTime: toTimeString(d) };
  }
  return { scheduledDate: fallbackDate, scheduledTime: fallbackTime };
}

function iconForTemplate(label: string) {
  const n = label.trim().toLowerCase();
  if (n.includes('planning')) return Target;
  if (n.includes('client')) return Users;
  if (n.includes('stand')) return MessageSquare;
  if (n.includes('review') || n.includes('retro')) return Check;
  if (n.includes('deploy')) return Rocket;
  return Calendar;
}

export function QuickCreateMeetingModal({
  open,
  onOpenChange,
  creating,
  projectId,
  templateOptions,
  onSubmit,
}: QuickCreateMeetingModalProps) {
  const systemTemplates = useMemo(
    () => templateOptions.filter((opt) => opt.is_system).slice(0, 5),
    [templateOptions],
  );
  const customTemplates = useMemo(
    () => templateOptions.filter((opt) => !opt.is_system),
    [templateOptions],
  );

  const defaultTemplateId = useMemo(() => {
    const planning = systemTemplates.find((t) => t.label.toLowerCase() === 'planning');
    return planning?.value ?? systemTemplates[0]?.value ?? templateOptions[0]?.value ?? '';
  }, [systemTemplates, templateOptions]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId);
  const [selectedDurationId, setSelectedDurationId] = useState<(typeof DURATION_OPTIONS)[number]['id']>('30m');
  const [selectedWhenId, setSelectedWhenId] = useState<(typeof WHEN_OPTIONS)[number]['id']>('start_now');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [participantUserIds, setParticipantUserIds] = useState<number[]>([]);
  const [pickedDate, setPickedDate] = useState(() => toDateString(new Date()));
  const [pickedTime, setPickedTime] = useState(() => toTimeString(new Date()));
  const [showCustomTemplates, setShowCustomTemplates] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(defaultTemplateId);
    setSelectedDurationId('30m');
    setSelectedWhenId('start_now');
    setInviteOpen(false);
    setParticipantUserIds([]);
    setPickedDate(toDateString(new Date()));
    setPickedTime(toTimeString(new Date()));
    setShowCustomTemplates(false);
  }, [open, defaultTemplateId]);

  const selectedTemplate =
    templateOptions.find((t) => t.value === selectedTemplateId) ?? templateOptions[0];
  const selectedDuration = DURATION_OPTIONS.find((d) => d.id === selectedDurationId) ?? DURATION_OPTIONS[1];

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }
    const title = `${selectedTemplate.label} Meeting`;
    const objective =
      selectedDurationId === 'custom'
        ? `${selectedTemplate.label} quick session`
        : `${selectedTemplate.label} quick session (${selectedDuration.label})`;
    const { scheduledDate, scheduledTime } = scheduleFromWhen(selectedWhenId, pickedDate, pickedTime);

    await onSubmit({
      meetingType: selectedTemplate.value,
      title,
      objective,
      scheduledDate,
      scheduledTime,
      participantUserIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[430px] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl">
        <div className="p-6">
          <div className="mb-5">
            <DialogTitle className="text-[20px] font-semibold text-gray-900">
              Quick Create Meeting
            </DialogTitle>
            <p className="mt-1 text-sm text-gray-500">Start with a template</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {systemTemplates.map((template) => {
              const Icon = iconForTemplate(template.label);
              const active = template.value === selectedTemplateId;
              return (
                <button
                  key={template.value}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.value)}
                  className={cn(
                    'flex h-24 flex-col items-center justify-center rounded-xl border text-center text-sm font-medium transition',
                    active
                      ? 'border-[#3CCED7] bg-[#3CCED7] text-white shadow-md'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-[#3CCED7]/10/40',
                  )}
                >
                  <Icon className="mb-2 h-5 w-5" />
                  <span className="line-clamp-2 px-2">{template.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCustomTemplates((v) => !v)}
              className={cn(
                'flex h-24 flex-col items-center justify-center rounded-xl border border-dashed text-sm font-medium transition',
                showCustomTemplates
                  ? 'border-[#3CCED7] bg-[#3CCED7]/10 text-[#1a9ba3]'
                  : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700',
              )}
            >
              <Plus className="mb-2 h-5 w-5" />
              Add Template
            </button>
          </div>

          {showCustomTemplates && customTemplates.length > 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Your templates
              </p>
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1 text-sm">
                {customTemplates.map((template) => (
                  <button
                    key={template.value}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.value);
                      setShowCustomTemplates(false);
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition',
                      selectedTemplateId === template.value
                        ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-[#3CCED7]/10/60',
                    )}
                  >
                    <span className="line-clamp-2">{template.label}</span>
                    {selectedTemplateId === template.value ? (
                      <Check className="ml-2 h-3 w-3 shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <section className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Duration</h3>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((duration) => (
                <button
                  key={duration.id}
                  type="button"
                  onClick={() => setSelectedDurationId(duration.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-medium transition',
                    selectedDurationId === duration.id
                      ? 'border-[#3CCED7] bg-[#3CCED7] text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300',
                  )}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-gray-700">When?</h3>
            <div className="grid grid-cols-2 gap-2">
              {WHEN_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedWhenId(option.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-medium transition',
                    selectedWhenId === option.id
                      ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {selectedWhenId === 'pick_date' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600">
                  <span className="mb-1 block">Date</span>
                  <input
                    type="date"
                    value={pickedDate}
                    onChange={(e) => setPickedDate(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-900 focus:outline-none"
                  />
                </label>
                <label className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600">
                  <span className="mb-1 block">Time</span>
                  <input
                    type="time"
                    value={pickedTime}
                    onChange={(e) => setPickedTime(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-900 focus:outline-none"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="mt-5">
            <button
              type="button"
              onClick={() => setInviteOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
                inviteOpen
                  ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300',
              )}
            >
              <Users className="h-4 w-4" />
              Invite people
            </button>
            {inviteOpen ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <ProjectMemberPicker
                  projectId={projectId}
                  excludeUserIds={participantUserIds}
                  onPickUser={(userId) =>
                    setParticipantUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
                  }
                />
                {participantUserIds.length > 0 ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Selected {participantUserIds.length} participant
                    {participantUserIds.length > 1 ? 's' : ''}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleSubmit()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3CCED7] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#2AB5BD] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? (
              <>
                <Clock3 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Meeting
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
