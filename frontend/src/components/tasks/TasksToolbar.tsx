'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TasksViewMode = 'list' | 'timeline';

interface TasksToolbarProps {
  viewMode: TasksViewMode;
  onViewModeChange: (mode: TasksViewMode) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}

const ViewButton = ({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-md border px-4 py-1.5 text-sm',
      active
        ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    )}
  >
    {children}
  </button>
);

const TasksToolbar: React.FC<TasksToolbarProps> = ({
  viewMode,
  onViewModeChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  className,
}) => (
  <div className={cn('flex flex-wrap items-center gap-3', className)}>
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder={searchPlaceholder || 'Search tasks...'}
        value={searchValue ?? ''}
        onChange={(event) => onSearchChange?.(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
    <div className="flex items-center gap-2">
      <ViewButton
        active={viewMode === 'list'}
        onClick={() => onViewModeChange('list')}
      >
        List View
      </ViewButton>
      <ViewButton
        active={viewMode === 'timeline'}
        onClick={() => onViewModeChange('timeline')}
      >
        Timeline View
      </ViewButton>
    </div>
  </div>
);

export default TasksToolbar;
