'use client';

import { useEffect, useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';

interface ProjectRailProps {
  loading?: boolean;
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : (parts[0]?.[1] ?? '');
  return `${first}${second}`.toUpperCase();
}

export default function ProjectRail({
  loading = false,
  selectedProjectId,
  onSelectProject,
}: ProjectRailProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const delayedLoading = useMinimumLoading(loading || isLoading);

  useEffect(() => {
    if (loading) return;

    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const list = await ProjectAPI.getProjects();
        if (!mounted) return;
        setProjects(list);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loading]);

  const selectedIndex = useMemo(() => {
    if (!selectedProjectId) return -1;
    return projects.findIndex((p) => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  return (
    <div
      className="w-14 sm:w-16 h-full flex flex-col items-center gap-2 py-3 bg-gray-50"
      data-testid="messages-project-rail"
      aria-label="Projects"
    >
      <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600">
        <FolderOpen className="w-5 h-5" />
      </div>

      <div className="flex-1 overflow-y-auto w-full px-2 space-y-2">
        {delayedLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton
                key={idx}
                className="w-full h-10 rounded-lg"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-[10px] text-gray-500 text-center px-1">
            No projects
          </div>
        ) : (
          projects.map((project, idx) => {
            const isSelected = project.id === selectedProjectId;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={[
                  'w-full h-10 rounded-lg flex items-center justify-center',
                  'border transition-colors',
                  isSelected
                    ? 'bg-white border-blue-300 text-blue-700 shadow-sm'
                    : 'bg-white/60 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300',
                ].join(' ')}
                title={project.name}
                aria-label={`Select project ${project.name}`}
                data-testid="messages-project-rail-item"
                data-project-id={String(project.id)}
                data-selected={isSelected ? 'true' : 'false'}
              >
                <span className="text-xs font-semibold">
                  {getInitials(project.name)}
                </span>
                {isSelected && (
                  <span className="sr-only">Selected</span>
                )}
                {selectedIndex === idx && isSelected ? null : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
