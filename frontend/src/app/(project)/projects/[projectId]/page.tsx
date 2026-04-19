'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';

import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';

function parsePositiveProjectId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function getErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: { detail?: string; error?: string } };
    message?: string;
  };
  return (
    anyErr?.response?.data?.detail ||
    anyErr?.response?.data?.error ||
    anyErr?.message ||
    fallback
  );
}

/**
 * Project “home” for /projects/:id — meetings/spreadsheets/miro used to link here
 * but no page existed (Next.js 404 + dev overlay removeChild noise).
 */
export default function ProjectHubPage() {
  const params = useParams();
  const rawId = params?.projectId as string | undefined;
  const projectId = parsePositiveProjectId(rawId);

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId == null) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const p = await ProjectAPI.getProject(projectId);
        if (!cancelled) setProject(p);
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load project'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pid = projectId ?? 0;

  return (
    <ProtectedRoute>
      <Layout mainScrollMode="page">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6">
            <Link href="/projects" className="text-sm text-blue-600 hover:underline">
              ← All projects
            </Link>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-sm font-medium text-gray-900">Loading project…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
              <AlertCircle className="h-8 w-8" />
              <p className="mt-3 font-semibold">Could not open project</p>
              <p className="mt-1 text-sm text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && project && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
              {project.description ? (
                <p className="mt-2 text-sm text-gray-600">{project.description}</p>
              ) : null}

              <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Open in this project
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <Link
                    href={`/projects/${pid}/meetings`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Meetings
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/projects/${pid}/spreadsheets`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Spreadsheets
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/projects/${pid}/miro`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Miro
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
