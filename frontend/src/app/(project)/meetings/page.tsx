'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';
import { useProjectStore } from '@/lib/projectStore';

function parsePositiveProjectId(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function MeetingsHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const zoomToastShownRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasProjects, setHasProjects] = useState<boolean>(true);

  useEffect(() => {
    if (searchParams.get('zoom_connected') === 'true' && !zoomToastShownRef.current) {
      zoomToastShownRef.current = true;
      toast.success('Zoom account connected successfully!');
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('zoom_connected');
      const newUrl = newParams.toString()
        ? `${window.location.pathname}?${newParams.toString()}`
        : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;
    let redirected = false;

    const redirectToMeetingsHome = async () => {
      setLoading(true);
      setError(null);
      setHasProjects(true);

      // Zustand `persist` rehydrates after first paint; wait briefly so we don't
      // redirect twice (null → then activeProject) which can 404 / removeChild races.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => requestAnimationFrame(r));
      if (cancelled) return;

      try {
        const ap = useProjectStore.getState().activeProject;
        const fromStore = parsePositiveProjectId(ap?.id);
        if (fromStore != null) {
          redirected = true;
          router.replace(`/projects/${fromStore}/meetings`);
          return;
        }

        const list = (await ProjectAPI.getProjects()) as ProjectData[];
        const projects = Array.isArray(list) ? list : [];
        if (!projects.length) {
          setHasProjects(false);
          return;
        }

        const firstId = parsePositiveProjectId(projects[0]?.id);
        if (firstId == null) {
          setError('Could not resolve a valid project id.');
          return;
        }

        redirected = true;
        router.replace(`/projects/${firstId}/meetings`);
      } catch (err: unknown) {
        console.error('Failed to load projects for meetings hub:', err);
        const message =
          (err as { response?: { data?: { error?: string; detail?: string } }; message?: string })
            ?.response?.data?.error ||
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as { message?: string })?.message ||
          'Failed to load projects';
        setError(String(message));
      } finally {
        if (!cancelled && !redirected) {
          setLoading(false);
        }
      }
    };

    void redirectToMeetingsHome();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="mt-3 font-medium text-gray-900">Opening Meetings…</p>
          <p className="text-sm text-gray-600">Redirecting to your project meetings page.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
          <AlertCircle className="h-6 w-6" />
          <p className="mt-3 font-semibold">Could not load projects</p>
          <p className="text-sm text-red-500">{error}</p>
          <Link href="/projects" className="mt-4 text-sm font-medium text-blue-600 hover:underline">
            Go to Projects
          </Link>
        </div>
      );
    }

    if (!hasProjects) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          <p className="mt-3 font-medium text-gray-900">No projects available</p>
          <p className="text-sm text-gray-600">Create or join a project to start using Meetings.</p>
          <Link href="/projects" className="mt-4 text-sm font-medium text-blue-600 hover:underline">
            Go to Projects
          </Link>
        </div>
      );
    }
    return null;
  };

  return (
    <ProtectedRoute>
      <Layout mainScrollMode="page">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Meetings</h1>
              <p className="text-sm text-gray-600">Pick a project to open its Meeting Preparation Workspace.</p>
            </div>
          </div>

          {renderContent()}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

export default function MeetingsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="mt-3 font-medium text-gray-900">Loading Meetings…</p>
          <p className="text-sm text-gray-600">Preparing your meetings workspace.</p>
        </div>
      }
    >
      <MeetingsHubContent />
    </Suspense>
  );
}
