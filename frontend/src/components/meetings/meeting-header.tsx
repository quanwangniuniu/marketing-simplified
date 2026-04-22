import { useEffect, useState } from 'react';
import { Calendar, Check, Clock, ExternalLink, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
interface MeetingTypePickerOption {
  value: string;
  label: string;
}

interface MeetingHeaderProps {
  title: string;
  meetingType: string;
  /** Unified list: system meeting types + custom templates (`custom_tpl:<id>`). */
  meetingTypeOptions: MeetingTypePickerOption[];
  status: string;
  meetingTypeSaving: boolean;
  objective: string;
  scheduledDate: string;
  scheduledTime: string;
  externalReference: string;
  saving: boolean;
  onScheduledDateChange: (value: string) => void;
  onScheduledTimeChange: (value: string) => void;
  onExternalReferenceChange: (value: string) => void;
  onMeetingTypeChange: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
  onTitleSave: (value: string) => void;
  onObjectiveSave: (value: string) => void;
}

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-2 rounded-md py-1">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function MeetingHeader({
  title,
  meetingType,
  meetingTypeOptions,
  status,
  meetingTypeSaving,
  objective,
  scheduledDate,
  scheduledTime,
  externalReference,
  saving,
  onScheduledDateChange,
  onScheduledTimeChange,
  onExternalReferenceChange,
  onMeetingTypeChange,
  onSave,
  onBack,
  onTitleSave,
  onObjectiveSave,
}: MeetingHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingObjective, setEditingObjective] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [editingReference, setEditingReference] = useState(false);
  const [meetingTypeMenuOpen, setMeetingTypeMenuOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [objectiveDraft, setObjectiveDraft] = useState(objective);

  useEffect(() => setTitleDraft(title), [title]);
  useEffect(() => setObjectiveDraft(objective), [objective]);

  const meetingTypeLabel =
    meetingTypeOptions.find((o) => o.value === meetingType)?.label ?? meetingType;

  return (
    <section className="py-1">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const next = titleDraft.trim();
                  if (next && next !== title) onTitleSave(next);
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                }}
                placeholder="Please enter the name of the meeting"
                className="h-8 min-w-[320px] border-none bg-transparent px-0 text-xl leading-tight font-bold text-slate-900 outline-none"
              />
            ) : (
              <h1
                className={`cursor-text truncate text-xl leading-tight font-bold ${
                  title.trim() ? 'text-slate-900' : 'text-slate-400'
                }`}
                onClick={() => setEditingTitle(true)}
              >
                {title.trim() || 'Please enter the name of the meeting'}
              </h1>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMeetingTypeMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700"
                disabled={meetingTypeSaving}
              >
                {meetingTypeLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
              {meetingTypeMenuOpen ? (
                <div className="absolute top-8 left-0 z-20 max-h-[min(70vh,320px)] min-w-[200px] overflow-y-auto rounded-md border border-slate-100 bg-white p-1 shadow-sm">
                  {meetingTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        onMeetingTypeChange(opt.value);
                        setMeetingTypeMenuOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Badge variant="outline" className="h-7 rounded-full border-slate-300 bg-transparent px-3 text-xs text-slate-500">
              {status}
            </Badge>
            {meetingTypeSaving ? <Badge variant="secondary">Saving type…</Badge> : null}
          </div>
          {editingObjective ? (
            <input
              autoFocus
              value={objectiveDraft}
              onChange={(e) => setObjectiveDraft(e.target.value)}
              onBlur={() => {
                const next = objectiveDraft.trim();
                if (next !== objective) onObjectiveSave(next);
                setEditingObjective(false);
              }}
              placeholder="Please enter the description of the meeting"
              className="h-8 w-full border-none bg-transparent px-0 text-lg text-slate-500 outline-none"
            />
          ) : (
            <p
              className={`cursor-text text-xl leading-snug ${
                objective.trim() ? 'text-slate-500' : 'text-slate-400'
              }`}
              onClick={() => setEditingObjective(true)}
            >
              {objective.trim() || 'Please enter the description of the meeting'}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-3">
          <PropertyRow icon={<Calendar className="h-4 w-4" />} label="Date">
            {editingDate ? (
              <input
                autoFocus
                type="date"
                value={scheduledDate}
                onChange={(e) => onScheduledDateChange(e.target.value)}
                onBlur={() => setEditingDate(false)}
                className="w-full border-none bg-transparent px-0 py-0 text-sm text-slate-600 outline-none"
              />
            ) : (
              <button type="button" onClick={() => setEditingDate(true)} className="text-sm text-slate-600">
                {scheduledDate || 'Set date'}
              </button>
            )}
          </PropertyRow>

          <PropertyRow icon={<Clock className="h-4 w-4" />} label="Time">
            {editingTime ? (
              <input
                autoFocus
                type="time"
                step={60}
                value={scheduledTime}
                onChange={(e) => onScheduledTimeChange(e.target.value)}
                onBlur={() => setEditingTime(false)}
                className="w-full border-none bg-transparent px-0 py-0 text-sm text-slate-600 outline-none"
              />
            ) : (
              <button type="button" onClick={() => setEditingTime(true)} className="text-sm text-slate-600">
                {scheduledTime || 'Set time'}
              </button>
            )}
          </PropertyRow>

          <PropertyRow icon={<LinkIcon className="h-4 w-4" />} label="Reference">
            <div className="flex items-center gap-2">
              {editingReference ? (
                <input
                  autoFocus
                  type="text"
                  value={externalReference}
                  onChange={(e) => onExternalReferenceChange(e.target.value)}
                  onBlur={() => setEditingReference(false)}
                  className="w-full border-none bg-transparent px-0 py-0 text-sm text-slate-600 outline-none"
                  placeholder="Add reference"
                />
              ) : (
                <button type="button" onClick={() => setEditingReference(true)} className="text-sm text-[#3CCED7]">
                  {externalReference || 'Add reference'}
                </button>
              )}
              {externalReference.trim() ? (
                <a
                  href={/^https?:\/\//i.test(externalReference) ? externalReference : `https://${externalReference}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:text-slate-700"
                  aria-label="Open external reference"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </PropertyRow>
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={onSave} disabled={saving}>
            <Check className="mr-1 h-4 w-4" />
            {saving ? 'Saving…' : 'Save schedule & reference'}
          </Button>
        </div>
      </div>
    </section>
  );
}
