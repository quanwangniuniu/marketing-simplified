'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { MeetingDocumentEditor } from '@/components/meetings/MeetingDocumentEditor';

const normalizeNumberParam = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export default function MeetingDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = normalizeNumberParam(params?.projectId);
  const meetingId = normalizeNumberParam(params?.meetingId);

  if (!Number.isFinite(projectId) || !Number.isFinite(meetingId)) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="mx-auto max-w-5xl p-6 text-sm text-red-600">Invalid meeting route parameters.</div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="mx-auto max-w-5xl space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Meeting document</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${projectId}/meetings/${meetingId}`)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to meeting
            </Button>
          </div>
          <MeetingDocumentEditor projectId={projectId} meetingId={meetingId} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
