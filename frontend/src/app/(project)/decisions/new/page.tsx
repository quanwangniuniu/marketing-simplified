'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { MeetingsAPI } from '@/lib/api/meetingsApi';

/** Blocks duplicate createDraft when Strict Mode runs the effect twice (same query string). */
let decisionDraftCreationLockForSearch = '';

function DecisionNewInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const search = window.location.search;
    if (decisionDraftCreationLockForSearch === search) {
      return;
    }
    decisionDraftCreationLockForSearch = search;

    const params = new URLSearchParams(search);
    const rawProject = params.get('project_id');
    const rawOrigin = params.get('origin_meeting_id');
    const projectId = rawProject != null ? Number(rawProject) : NaN;
    const originMeetingId =
      rawOrigin != null && String(rawOrigin).trim() !== '' ? Number(rawOrigin) : null;

    if (!Number.isFinite(projectId) || projectId < 1) {
      decisionDraftCreationLockForSearch = '';
      setError('project_id is required');
      return;
    }
    if (originMeetingId != null && (!Number.isFinite(originMeetingId) || originMeetingId < 1)) {
      decisionDraftCreationLockForSearch = '';
      setError('origin_meeting_id is invalid');
      return;
    }

    let cancelled = false;
    (async () => {
      if (originMeetingId != null) {
        try {
          const m = await MeetingsAPI.getMeeting(projectId, originMeetingId);
          if (!cancelled) setOriginLabel(m.title?.trim() || `Meeting ${originMeetingId}`);
        } catch {
          if (!cancelled) setOriginLabel(`Meeting ${originMeetingId}`);
        }
      }
      try {
        const body =
          originMeetingId != null && Number.isFinite(originMeetingId) && originMeetingId >= 1
            ? { origin_meeting_id: originMeetingId }
            : {};
        const draft = await DecisionAPI.createDraft(projectId, body);
        const id = draft.id;
        if (id == null) {
          decisionDraftCreationLockForSearch = '';
          setError('Decision draft created without an id.');
          return;
        }
        router.replace(`/decisions/${id}?project_id=${projectId}`);
        queueMicrotask(() => {
          decisionDraftCreationLockForSearch = '';
        });
      } catch {
        decisionDraftCreationLockForSearch = '';
        if (!cancelled) setError('Could not create decision draft.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
      <p className="text-sm text-slate-600">Creating decision draft…</p>
      {originLabel ? (
        <p className="max-w-md text-xs text-slate-500">
          Origin meeting: <span className="font-medium text-slate-700">{originLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

export default function DecisionNewPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
              Loading…
            </div>
          }
        >
          <DecisionNewInner />
        </Suspense>
      </Layout>
    </ProtectedRoute>
  );
}
