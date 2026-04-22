'use client';

import type { ReactNode } from 'react';

export type TasksTab = 'summary' | 'tasks' | 'board';

interface TabConfig {
  id: TasksTab;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'tasks',   label: 'Tasks' },
  { id: 'board',   label: 'Board' },
];

interface TabNavProps {
  active: TasksTab;
  onChange: (tab: TasksTab) => void;
  trailing?: ReactNode;
}

export default function TabNav({ active, onChange, trailing }: TabNavProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full transition ${
                  isActive ? 'bg-[#3CCED7]' : 'bg-transparent'
                }`}
                aria-hidden
              />
              {tab.label}
            </button>
          );
        })}
      </nav>
      {trailing ? <div className="flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
