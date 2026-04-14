'use client';

/**
 * Spreadsheet Project Choose page.
 * Nav "Spreadsheet" -> this page -> select project -> /projects/[id]/spreadsheets (same as Project -> Spreadsheet).
 *
 * Sanity check:
 * - Home still works
 * - Project -> Spreadsheet still works
 * - Nav "Spreadsheet" -> choose project -> lands on same spreadsheet page as Project -> Spreadsheet
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProjectAPI, ProjectData } from '@/lib/api/projectApi';
import { AlertCircle, FileSpreadsheet, FolderOpen, Loader2 } from 'lucide-react';

export default function SpreadsheetProjectChoosePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await ProjectAPI.getProjects();
        setProjects(Array.isArray(list) ? list : []);
      } catch (err: unknown) {
        console.error('Failed to load projects:', err);
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load projects';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  const handleSelectProject = (projectId: number) => {
    router.push(`/projects/${projectId}/spreadsheets`);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Spreadsheet</h1>
              <p className="text-sm text-gray-500">Choose a project to open its spreadsheets</p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              <span className="text-sm text-gray-600">Loading projects…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-600">
              No projects available. Create or join a project first.
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectProject(project.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 hover:shadow"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate">{project.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {project.organization?.name ?? 'No organization'}
                      </div>
                    </div>
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
