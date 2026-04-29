'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { useProjectStore } from '@/lib/projectStore';
import { useAuthStore } from '@/lib/authStore';
import api from '@/lib/api';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { Meeting } from '@/types/meeting';
import DocumentHeader from '@/components/meetings/document/DocumentHeader';
import CollaborativeEditor, {
  type EditorHostState,
  type MemberLike,
} from '@/components/meetings/document/CollaborativeEditor';

export default function MeetingDocumentPage() {
  const params = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const activeProject = useProjectStore((s) => s.activeProject);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const meetingId = Number(params?.meetingId);
  const projectIdParam = searchParams?.get('project_id');
  const projectId = projectIdParam
    ? Number(projectIdParam)
    : activeProject?.id ?? null;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<MemberLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostState, setHostState] = useState<EditorHostState>({
    wsState: 'connecting',
    closeCode: null,
    saving: false,
    lastSyncedAt: null,
    editorsOnline: 1,
    activeUsers: [],
  });

  useEffect(() => {
    if (!projectId || !meetingId || Number.isNaN(meetingId)) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      MeetingsAPI.getMeeting(projectId, meetingId),
      api.get<unknown>(`/api/core/projects/${projectId}/members/`),
    ])
      .then(([meetingRes, membersRes]) => {
        if (cancelled) return;
        setMeeting(meetingRes);
        const data = (membersRes as { data: unknown }).data;
        const raw: MemberLike[] = Array.isArray(data)
          ? (data as MemberLike[])
          : ((data as { results?: MemberLike[]; items?: MemberLike[] })?.results ??
              (data as { items?: MemberLike[] })?.items ??
              []);
        setMembers(raw);
      })
      .catch((err) => {
        if (cancelled) return;
        const e = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
        const status = e.response?.status;
        if (status === 404) setLoadError('Meeting not found.');
        else if (status === 403) setLoadError('You do not have access to this meeting.');
        else setLoadError(e.response?.data?.detail || e.message || 'Could not load meeting.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, meetingId]);

  const readOnly = useMemo(() => {
    if (!meeting) return true;
    return (
      meeting.is_archived ||
      meeting.status === 'archived' ||
      hostState.closeCode === 4003
    );
  }, [meeting, hostState.closeCode]);

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-[1440px] px-6 py-4">
        {!projectId && (
          <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
            Select a project to view this document.
          </div>
        )}

        {projectId && loadError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        {projectId && !loadError && loading && !meeting && (
          <div className="rounded-xl bg-white p-6 text-center text-xs text-gray-400 shadow-sm ring-1 ring-gray-100">
            Loading meeting…
          </div>
        )}

        {projectId && meeting && hasHydrated && (
          <div className="space-y-5">
            <DocumentHeader
              projectId={projectId}
              meeting={meeting}
              wsState={hostState.wsState}
              closeCode={hostState.closeCode}
              saving={hostState.saving}
              lastSyncedAt={hostState.lastSyncedAt}
              editorsOnline={hostState.editorsOnline}
              activeUsers={hostState.activeUsers}
              readOnly={readOnly}
            />

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <CollaborativeEditor
                projectId={projectId}
                meetingId={meeting.id}
                token={token}
                readOnly={readOnly}
                members={members}
                onStateChange={setHostState}
              />
            </section>
          </div>
        )}
      </div>
      <ChatFAB />
    </DashboardLayout>
  );
}
