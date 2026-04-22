'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import MeetingTypeCombobox from '@/components/meetings-v2/MeetingTypeCombobox';

interface Props {
  title: string;
  meetingType: string;
  objective: string;
  readOnly: boolean;
  typeSuggestions: string[];
  onCommit: (patch: {
    title?: string;
    meeting_type?: string;
    objective?: string;
  }) => Promise<void>;
}

export default function OverviewSection({
  title,
  meetingType,
  objective,
  readOnly,
  typeSuggestions,
  onCommit,
}: Props) {
  const [localTitle, setLocalTitle] = useState(title);
  const [localObjective, setLocalObjective] = useState(objective);

  useEffect(() => setLocalTitle(title), [title]);
  useEffect(() => setLocalObjective(objective), [objective]);

  const commit = async (patch: Parameters<Props['onCommit']>[0]) => {
    try {
      await onCommit(patch);
    } catch {
      // parent toasts
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Overview
        </h2>
      </header>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="mtg-title"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
          >
            Title
          </label>
          <input
            id="mtg-title"
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => {
              if (localTitle.trim() && localTitle !== title) {
                commit({ title: localTitle.trim() });
              } else if (!localTitle.trim()) {
                setLocalTitle(title);
              }
            }}
            disabled={readOnly}
            className="w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition hover:border-gray-200 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="mtg-type"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
          >
            Meeting type
          </label>
          <MeetingTypeCombobox
            id="mtg-type"
            ariaLabel="Meeting type"
            value={meetingType}
            onChange={(label) => {
              if (label !== meetingType) commit({ meeting_type: label });
            }}
            suggestions={typeSuggestions}
          />
        </div>

        <div>
          <label
            htmlFor="mtg-objective"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
          >
            Objective
          </label>
          <textarea
            id="mtg-objective"
            rows={3}
            value={localObjective}
            onChange={(e) => setLocalObjective(e.target.value)}
            onBlur={() => {
              if (localObjective !== objective) {
                commit({ objective: localObjective });
              }
            }}
            disabled={readOnly}
            placeholder="What do you want to achieve in this meeting?"
            className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>
    </section>
  );
}
