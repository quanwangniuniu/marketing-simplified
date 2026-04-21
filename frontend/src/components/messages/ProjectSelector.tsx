'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, Check } from 'lucide-react';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';

interface ProjectSelectorProps {
  loading?: boolean;
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;
}

export default function ProjectSelector({
  loading = false,
  selectedProjectId,
  onSelectProject,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onSelectProjectRef = useRef(onSelectProject);
  const delayedLoading = useMinimumLoading(loading || isLoading);

  useEffect(() => {
    onSelectProjectRef.current = onSelectProject;
  }, [onSelectProject]);

  // Fetch user's projects on mount
  useEffect(() => {
    if (loading || projects.length > 0) return;

    let mounted = true;

    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const projectList = await ProjectAPI.getProjects();
        if (!mounted) return;
        setProjects(projectList);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();
    return () => {
      mounted = false;
    };
  }, [loading, projects.length]);

  useEffect(() => {
    if (loading || selectedProjectId || projects.length === 0) return;

    const savedProjectId = localStorage.getItem('messages_selected_project');
    if (savedProjectId) {
      const savedId = parseInt(savedProjectId, 10);
      const exists = projects.some(p => p.id === savedId);
      if (exists) {
        onSelectProjectRef.current(savedId);
        return;
      }
    }

    onSelectProjectRef.current(projects[0].id);
  }, [loading, projects, selectedProjectId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = (projectId: number) => {
    onSelectProject(projectId);
    localStorage.setItem('messages_selected_project', String(projectId));
    setIsOpen(false);
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (delayedLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-32 h-4 rounded" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg">
        <FolderOpen className="w-5 h-5" />
        <span className="text-sm">No projects available</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[200px] shadow-sm"
      >
        <FolderOpen className="w-5 h-5 text-blue-600" />
        <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">
          {selectedProject?.name || 'Select Project'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[250px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                project.id === selectedProjectId ? 'bg-blue-50' : ''
              }`}
            >
              <FolderOpen
                className={`w-4 h-4 flex-shrink-0 ${
                  project.id === selectedProjectId ? 'text-blue-600' : 'text-gray-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    project.id === selectedProjectId ? 'text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {project.name}
                </p>
                {project.member_count && (
                  <p className="text-xs text-gray-500">
                    {project.member_count} member{project.member_count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {project.id === selectedProjectId && (
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
