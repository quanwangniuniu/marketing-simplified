'use client';

import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ProjectAPI, ProjectData } from '@/lib/api/projectApi';
import { useProjectStore } from '@/lib/projectStore';

export type ProjectFilter = 'all' | 'active' | 'completed';
export type DerivedProjectStatus = 'active' | 'completed' | 'open';

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    'Failed to load projects'
  );
};

export const deriveProjectStatus = (
  project: ProjectData,
  activeProjectIds: number[] = [],
  inactiveProjectIds: number[] = [],
  completedProjectIds: number[] = []
): DerivedProjectStatus => {
  const isCompletedLocal = completedProjectIds.includes(project.id);
  const isManuallyInactive = inactiveProjectIds.includes(project.id);
  const isActiveLocal = activeProjectIds.includes(project.id);

  if (isCompletedLocal) {
    return 'completed';
  }

  if (isManuallyInactive) {
    if (project.status === 'completed' || project.status === 'archived' || (project as any)?.is_deleted) {
      return 'completed';
    }
    return 'open';
  }

  if (isActiveLocal || project.is_active) {
    return 'active';
  }

  if (project.status === 'completed' || project.status === 'archived' || (project as any)?.is_deleted) {
    return 'completed';
  }
  return 'open';
};

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingProjectId, setUpdatingProjectId] = useState<number | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const {
    activeProject,
    activeProjectIds,
    inactiveProjectIds,
    completedProjectIds,
    setActiveProject: setStoreActiveProject,
    setActiveProjectIds,
    toggleActiveProjectId,
    addInactiveProjectId,
    setInactiveProjectIds,
    toggleCompletedProjectId,
    setCompletedProjectIds,
  } = useProjectStore();

  const fetchProjects = useCallback(
    async (options?: { activeOnly?: boolean }) => {
      setLoading(true);
      try {
        const data = await ProjectAPI.getProjects(options);
        const list = Array.isArray(data) ? data : [];
        setProjects(list);

        // Use current store state to merge active IDs without causing dependency loops
        const { inactiveProjectIds: inactiveIds, activeProjectIds: activeIds } = useProjectStore.getState();
        const apiActiveIds = list
          .filter((item) => item.is_active && !inactiveIds.includes(item.id))
          .map((item) => item.id);
        const apiActiveProject =
          list.find((item) => item.is_active && !inactiveIds.includes(item.id)) ?? null;

        if (apiActiveIds.length > 0) {
          setActiveProjectIds((prev) => Array.from(new Set([...prev, ...apiActiveIds, ...activeIds])));
        }
        if (apiActiveProject) {
          setStoreActiveProject(apiActiveProject);
        } else if (activeProject?.id) {
          const matchingProject = list.find((item) => item.id === activeProject.id) ?? null;
          setStoreActiveProject(matchingProject);
        }
        // Capture backend-completed flags if present
        const apiCompletedIds = list
          .filter((item: any) => item.status === 'completed' || item.status === 'archived' || item.is_deleted)
          .map((item) => item.id);
        if (apiCompletedIds.length > 0) {
          setCompletedProjectIds((prev) => Array.from(new Set([...prev, ...apiCompletedIds])));
        }
        setError(null);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [activeProject?.id, setActiveProjectIds, setStoreActiveProject]
  );

  const setActiveProject = useCallback(
    async (projectId: number, isCurrentlyActive: boolean) => {
      // Toggle off locally if already active
      if (isCurrentlyActive) {
        toggleActiveProjectId(projectId);
        addInactiveProjectId(projectId);
        setProjects((prev) =>
          prev.map((project) =>
            project.id === projectId
              ? { ...project, is_active: false, isActiveResolved: false, derivedStatus: 'open' }
              : project
          )
        );
        return false;
      }

      setUpdatingProjectId(projectId);
      try {
        const selectedProject =
          projects.find((project) => project.id === projectId) ?? null;

        await ProjectAPI.setActiveProject(projectId);
        toast.success('Active project updated');
        setProjects((prev) =>
          prev.map((project) => ({
            ...project,
            is_active: project.id === projectId,
            isActiveResolved: project.id === projectId,
          }))
        );
        if (selectedProject) {
          setStoreActiveProject({ ...selectedProject, is_active: true });
        }
        setActiveProjectIds([projectId]);
        setInactiveProjectIds((prev) => prev.filter((id) => id !== projectId));
        await fetchProjects();
        return true;
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setUpdatingProjectId(null);
      }
    },
    [
      projects,
      activeProjectIds,
      fetchProjects,
      setStoreActiveProject,
      setActiveProjectIds,
      toggleActiveProjectId,
      addInactiveProjectId,
      setInactiveProjectIds,
    ]
  );

  const deleteProject = useCallback(
    async (projectId: number) => {
      setDeletingProjectId(projectId);
      try {
        const remainingProjects = projects.filter((project) => project.id !== projectId);
        const nextActiveProject =
          activeProject?.id === projectId ? remainingProjects[0] ?? null : null;

        await ProjectAPI.deleteProject(projectId);
        let nextProjects = remainingProjects;

        setCompletedProjectIds((prev) => prev.filter((id) => id !== projectId));

        if (nextActiveProject) {
          try {
            await ProjectAPI.setActiveProject(nextActiveProject.id);
            nextProjects = remainingProjects.map((project) => ({
              ...project,
              is_active: project.id === nextActiveProject.id,
              isActiveResolved: project.id === nextActiveProject.id,
            }));
            setStoreActiveProject({ ...nextActiveProject, is_active: true });
            setActiveProjectIds([nextActiveProject.id]);
            setInactiveProjectIds((prev) =>
              prev.filter((id) => id !== projectId && id !== nextActiveProject.id)
            );
          } catch {
            setStoreActiveProject(null);
            setActiveProjectIds((prev) => prev.filter((id) => id !== projectId));
            setInactiveProjectIds((prev) => prev.filter((id) => id !== projectId));
            toast.error('Project deleted, but failed to set a new active project.');
          }
        } else {
          setActiveProjectIds((prev) => prev.filter((id) => id !== projectId));
          setInactiveProjectIds((prev) => prev.filter((id) => id !== projectId));
          if (activeProject?.id === projectId) {
            setStoreActiveProject(null);
          }
        }

        setProjects(nextProjects);
        toast.success('Project deleted');
      } catch (err: any) {
        const status = err?.response?.status;
        const message =
          status === 403 || status === 401
            ? 'You do not have permission to delete this project.'
            : getErrorMessage(err);
        toast.error(message);
      } finally {
        setDeletingProjectId(null);
      }
    },
    [projects, activeProject?.id, setStoreActiveProject, setActiveProjectIds, setInactiveProjectIds, setCompletedProjectIds]
  );

  const derivedProjects = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        derivedStatus: deriveProjectStatus(project, activeProjectIds, inactiveProjectIds, completedProjectIds),
        isActiveResolved:
          (!inactiveProjectIds.includes(project.id) && (activeProjectIds.includes(project.id) || !!project.is_active)) ||
          false,
        isCompletedResolved:
          completedProjectIds.includes(project.id) ||
          project.status === 'completed' ||
          project.status === 'archived' ||
          (project as any)?.is_deleted ||
          false,
      })),
    [projects, activeProjectIds, inactiveProjectIds, completedProjectIds]
  );

  return {
    projects: derivedProjects,
    loading,
    error,
    updatingProjectId,
    activeProjectIds,
    inactiveProjectIds,
    fetchProjects,
    setActiveProject,
    deletingProjectId,
    deleteProject,
    toggleCompletedProjectId,
    completedProjectIds,
  };
};
