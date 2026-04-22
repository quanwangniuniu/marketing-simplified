'use client';

import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface TimelineFilterOption {
  value: string;
  label: string;
}

export interface TimelineHeaderUser {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
}

interface TimelineHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  workTypeOptions: TimelineFilterOption[];
  selectedWorkType: string;
  onWorkTypeChange: (value: string) => void;
  currentUser?: TimelineHeaderUser;
  displayRange?: string;
  onDisplayRangeChange?: (value: string) => void;
}

const getUserInitials = (user?: TimelineHeaderUser) => {
  if (!user) return 'U';

  const first = (user.first_name || '').trim();
  const last = (user.last_name || '').trim();

  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
  }

  const fallback = (user.username || user.email || '').trim();
  if (!fallback) return 'U';

  return fallback
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
};

const TimelineHeader = ({
  searchValue,
  onSearchChange,
  workTypeOptions,
  selectedWorkType,
  onWorkTypeChange,
  currentUser,
  displayRange = '12',
  onDisplayRangeChange,
}: TimelineHeaderProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (settingsOpen && settingsRef.current && !settingsRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [settingsOpen]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-md bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search timeline"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search timeline"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.username || currentUser.email || 'Current user'}
                className="h-full w-full object-cover"
              />
            ) : (
              getUserInitials(currentUser)
            )}
          </div>
        </div>
        <div className="relative">
          <select
            value={selectedWorkType}
            onChange={(event) => onWorkTypeChange(event.target.value)}
            aria-label="Work type filter"
            className="h-9 appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {workTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`rounded-md border px-2.5 py-2 text-slate-600 transition ${
              settingsOpen ? 'border-[#3CCED7] bg-[#3CCED7]/10' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            aria-label="View settings"
            aria-expanded={settingsOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          {settingsOpen ? (
            <div className="absolute right-0 mt-2 w-72 rounded-md border border-slate-200 bg-white shadow-lg z-30">
              <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                Display range
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="relative">
                  <select
                    value={displayRange}
                    onChange={(event) => onDisplayRangeChange?.(event.target.value)}
                    className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <div className="text-xs text-slate-400">
                  Items with dates outside this range won&apos;t show on your timeline.
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TimelineHeader;
