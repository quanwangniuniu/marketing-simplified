'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MeetingsWorkspaceShellProps {
  /** Omit or pass `null` to hide the left rail (full-width main). */
  sidebar?: ReactNode | null;
  main: ReactNode;
  detail: ReactNode;
  detailOpen: boolean;
  className?: string;
}

export function MeetingsWorkspaceShell({
  sidebar,
  main,
  detail,
  detailOpen,
  className,
}: MeetingsWorkspaceShellProps) {
  const showRail = detail != null;

  return (
    <div
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col gap-0 lg:min-h-[calc(100vh-8rem)] lg:flex-row lg:items-stretch',
        className,
      )}
    >
      {sidebar != null ? (
        <aside className="shrink-0 border-b border-gray-200 bg-slate-50/90 lg:w-56 lg:border-b-0 lg:border-r lg:border-gray-200">
          {sidebar}
        </aside>
      ) : null}

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#fafbfc]">{main}</main>

      {showRail ? (
        <aside
          className={cn(
            'relative shrink-0 overflow-hidden border-t border-gray-200 bg-white transition-[width,border-color] duration-300 ease-in-out lg:border-l lg:border-t-0',
            detailOpen
              ? 'block w-full lg:w-[min(100%,420px)] xl:w-[440px]'
              : 'hidden lg:block lg:w-0 lg:border-0',
          )}
          aria-hidden={!detailOpen}
        >
          <div
            className={cn(
              'h-full min-h-[min(100vh,480px)] w-full transition-transform duration-300 ease-in-out will-change-transform lg:w-[420px] xl:w-[440px]',
              detailOpen ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            {detail}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
