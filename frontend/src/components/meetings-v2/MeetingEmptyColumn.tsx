'use client';

import { CalendarPlus } from 'lucide-react';

interface Props {
  variant: 'incoming' | 'completed';
  onCreate?: () => void;
}

export default function MeetingEmptyColumn({ variant, onCreate }: Props) {
  if (variant === 'incoming') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-white/50 px-6 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7]/10 to-[#A6E661]/10 text-[#3CCED7]">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">No incoming meetings</p>
          <p className="mt-1 text-xs text-gray-500">Create your first meeting to start planning.</p>
        </div>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            + Create meeting
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white/50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-gray-900">No completed meetings</p>
      <p className="text-xs text-gray-500">
        Meetings with a scheduled day before today appear here.
      </p>
    </div>
  );
}
