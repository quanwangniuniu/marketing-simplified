'use client';

import Link from 'next/link';

import type { KnowledgeNavigationLink } from '@/types/meeting';

export interface MeetingSummaryRelatedArtifactsProps {
  relatedDecisions?: KnowledgeNavigationLink[];
  relatedTasks?: KnowledgeNavigationLink[];
}

/**
 * Related workspace artifacts (ArtifactLink), distinct from origin-based knowledge navigation.
 *
 * **Boundary (v1):** Origin rows (`Meeting*Origin`) and related artifact links do not overlap for the
 * same task/decision id on a meeting — the API excludes origin ids from related lists. Related links are
 * manual/supplementary and do not drive “has generated” filters.
 */
export function MeetingSummaryRelatedArtifacts({
  relatedDecisions = [],
  relatedTasks = [],
}: MeetingSummaryRelatedArtifactsProps) {
  return (
    <div className="space-y-4" data-testid="meeting-summary-related-artifacts">
      <section data-testid="meeting-summary-related-decisions">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Related decisions
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {relatedDecisions.length > 0 ? (
            relatedDecisions.map((item) => (
              <Link
                key={item.id}
                href={item.detail_url ?? item.url}
                className="truncate text-sm text-[#1a9ba3]/90 hover:underline"
              >
                {item.title}
              </Link>
            ))
          ) : (
            <p className="text-sm text-gray-400">No related decisions</p>
          )}
        </div>
      </section>

      <section className="pt-1" data-testid="meeting-summary-related-tasks">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Related tasks
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {relatedTasks.length > 0 ? (
            relatedTasks.map((item) => (
              <Link
                key={item.id}
                href={item.detail_url ?? item.url}
                className="truncate text-sm text-emerald-800/90 hover:underline"
              >
                {item.title}
              </Link>
            ))
          ) : (
            <p className="text-sm text-gray-400">No related tasks</p>
          )}
        </div>
      </section>
    </div>
  );
}
