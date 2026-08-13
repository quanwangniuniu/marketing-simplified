'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
} from 'lucide-react';
import { buildQuickStartChecklistItems } from '@/components/quick-start/buildQuickStartChecklistItems';
import { inferQuickStartStepFromPathname } from '@/lib/quickStartChecklistProgress';
import {
  queueOverviewSectionScroll,
  scrollOverviewMainToSectionWithRetry,
} from '@/lib/overviewScroll';
import { shouldRenderQuickStartChecklist } from '@/lib/quickStartChecklistRoutes';
import {
  clearQuickStartPostCreateGuide,
  markQuickStartChecklistStepComplete,
  readQuickStartChecklistProgress,
  shouldShowQuickStartPostCreateGuide,
} from '@/lib/quickStartPostCreate';
import { useProjectStore } from '@/lib/projectStore';
import { useBuildUrl } from '@/lib/buildUrl';

function stepItemClassName(isDone: boolean): string {
  const base =
    'group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition';
  if (isDone) {
    return `${base} border-gray-200/80 bg-gray-50/90 text-gray-500 opacity-75 hover:opacity-90`;
  }
  return `${base} border-white/60 bg-white text-gray-800 hover:border-[#3CCED7]/30 hover:bg-white shadow-sm`;
}

export default function QuickStartPostCreateChecklist() {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const pathname = usePathname();
  const activeProjectId = useProjectStore((s) => s.activeProject?.id ?? null);
  const [guide, setGuide] = useState(() =>
    shouldShowQuickStartPostCreateGuide(activeProjectId)
  );
  const [isOpen, setIsOpen] = useState(true);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setGuide(shouldShowQuickStartPostCreateGuide(activeProjectId));
    if (activeProjectId) {
      setCompletedStepIds(
        readQuickStartChecklistProgress(activeProjectId).completedStepIds
      );
    } else {
      setCompletedStepIds([]);
    }
  }, [activeProjectId, pathname]);

  const syncProgressFromRoute = useCallback(() => {
    if (!guide || !pathname) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const stepId = inferQuickStartStepFromPathname(pathname, hash);
    if (!stepId) return;
    const next = markQuickStartChecklistStepComplete(guide.projectId, stepId);
    setCompletedStepIds(next);
  }, [guide, pathname]);

  useEffect(() => {
    syncProgressFromRoute();
    window.addEventListener('hashchange', syncProgressFromRoute);
    return () => window.removeEventListener('hashchange', syncProgressFromRoute);
  }, [syncProgressFromRoute]);

  const dismiss = useCallback(() => {
    clearQuickStartPostCreateGuide();
    setGuide(null);
    setCompletedStepIds([]);
  }, []);

  const markStepComplete = useCallback(
    (stepId: string) => {
      if (!guide) return;
      const next = markQuickStartChecklistStepComplete(guide.projectId, stepId);
      setCompletedStepIds(next);
    },
    [guide]
  );

  const checklistItems = useMemo(
    () => (guide ? buildQuickStartChecklistItems(guide) : []),
    [guide]
  );

  const handleTeamInviteClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      markStepComplete('team');
      setIsOpen(false);
      queueOverviewSectionScroll('project-team');
      if (pathname === '/overview') {
        window.history.replaceState(null, '', '/overview#project-team');
        scrollOverviewMainToSectionWithRetry('project-team');
        return;
      }
      router.push(buildUrl('/overview#project-team'));
    },
    [markStepComplete, pathname, router]
  );

  const handleItemNavigate = useCallback(
    (stepId: string) => {
      markStepComplete(stepId);
      setIsOpen(false);
    },
    [markStepComplete]
  );

  if (!shouldRenderQuickStartChecklist(pathname)) return null;
  if (!guide || checklistItems.length === 0) return null;

  const completedCount = checklistItems.filter((item) =>
    completedStepIds.includes(item.id)
  ).length;
  const remainingCount = checklistItems.length - completedCount;
  const stepLabel =
    remainingCount === 0
      ? 'All done'
      : `${remainingCount} step${remainingCount === 1 ? '' : 's'} left`;

  const overlay =
    mounted && isOpen
      ? createPortal(
          <button
            type="button"
            aria-label="Close Quick Start checklist"
            className="fixed inset-0 z-[45] bg-gray-900/50 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsOpen(false)}
          />,
          document.body
        )
      : null;

  return (
    <>
      {overlay}
      <div
        className="fixed bottom-[5.75rem] right-6 z-50 flex flex-col items-end gap-2"
        data-testid="quick-start-checklist"
      >
        {isOpen ? (
          <section
            id="quick-start-checklist-panel"
            className="w-[min(calc(100vw-3rem),22rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl ring-1 ring-black/5"
            aria-labelledby="quick-start-checklist-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-[#3CCED7]/10 p-1.5 ring-1 ring-[#3CCED7]/20">
                  <Sparkles className="h-4 w-4 text-[#3CCED7]" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2
                    id="quick-start-checklist-title"
                    className="text-sm font-semibold text-gray-900"
                  >
                    {guide.projectName} is ready
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {completedCount}/{checklistItems.length} steps viewed
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Collapse Quick Start checklist"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Dismiss Quick Start guide"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {checklistItems.map((item) => {
                const Icon = item.icon;
                const isDone = completedStepIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <Link
                      href={buildUrl(item.href)}
                      onClick={
                        item.id === 'team'
                          ? handleTeamInviteClick
                          : () => handleItemNavigate(item.id)
                      }
                      className={stepItemClassName(isDone)}
                      aria-current={isDone ? 'step' : undefined}
                    >
                      {isDone ? (
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 text-emerald-500"
                          aria-hidden
                        />
                      ) : (
                        <Icon className="h-4 w-4 shrink-0 text-[#3CCED7]" aria-hidden />
                      )}
                      <span
                        className={`flex-1 font-medium leading-snug ${
                          isDone ? 'text-gray-500' : ''
                        }`}
                      >
                        {item.label}
                      </span>
                      {isDone ? (
                        <span className="text-xs text-gray-400">Done</span>
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-[#0d9488]" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-[#3CCED7]/35 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-lg hover:border-[#3CCED7]/50"
          aria-expanded={isOpen}
          aria-controls="quick-start-checklist-panel"
        >
          {remainingCount === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 text-[#3CCED7]" aria-hidden />
          )}
          <span>Quick Start</span>
          <span className="text-xs text-gray-500">{stepLabel}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden />
          )}
        </button>
      </div>
    </>
  );
}
