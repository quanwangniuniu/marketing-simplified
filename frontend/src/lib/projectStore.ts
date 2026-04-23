'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectData } from './api/projectApi';

interface ProjectState {
  projects: ProjectData[];
  activeProject: ProjectData | null;
  activeProjectIds: number[];
  inactiveProjectIds: number[];
  completedProjectIds: number[];
  hasHydrated: boolean;
  loading: boolean;
  error: string | null;
  setProjects: (projects: ProjectData[]) => void;
  setActiveProject: (project: ProjectData | null) => void;
  setActiveProjectIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  toggleActiveProjectId: (id: number) => void;
  setInactiveProjectIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  addInactiveProjectId: (id: number) => void;
  toggleCompletedProjectId: (id: number) => void;
  setCompletedProjectIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearProjects: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProject: null,
      activeProjectIds: [],
      inactiveProjectIds: [],
      completedProjectIds: [],
      hasHydrated: false,
      loading: false,
      error: null,
      setProjects: (projects) => set({ projects }),
      setActiveProject: (activeProject) =>
        set((state) => ({
          activeProject,
          activeProjectIds: activeProject?.id
            ? Array.from(new Set([...state.activeProjectIds, activeProject.id]))
            : state.activeProjectIds,
          inactiveProjectIds: activeProject?.id
            ? state.inactiveProjectIds.filter((id) => id !== activeProject.id)
            : state.inactiveProjectIds,
        })),
      setActiveProjectIds: (ids) =>
        set((state) => {
          const resolvedIds = typeof ids === 'function' ? ids(state.activeProjectIds) : ids;
          const uniqueIds = Array.from(new Set(resolvedIds));
          return {
            activeProjectIds: uniqueIds,
            inactiveProjectIds: state.inactiveProjectIds.filter((id) => !uniqueIds.includes(id)),
          };
        }),
      toggleActiveProjectId: (id) =>
        set((state) => {
          const next = new Set(state.activeProjectIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return {
            activeProjectIds: Array.from(next),
            inactiveProjectIds: state.inactiveProjectIds.filter((item) => item !== id),
          };
        }),
      setInactiveProjectIds: (ids) =>
        set((state) => {
          const resolvedIds = typeof ids === 'function' ? ids(state.inactiveProjectIds) : ids;
          return { inactiveProjectIds: Array.from(new Set(resolvedIds)) };
        }),
      addInactiveProjectId: (id) =>
        set((state) => ({
          inactiveProjectIds: Array.from(new Set([...state.inactiveProjectIds, id])),
          activeProjectIds: state.activeProjectIds.filter((item) => item !== id),
        })),
      toggleCompletedProjectId: (id) =>
        set((state) => {
          const next = new Set(state.completedProjectIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { completedProjectIds: Array.from(next) };
        }),
      setCompletedProjectIds: (ids) =>
        set((state) => {
          const resolvedIds = typeof ids === 'function' ? ids(state.completedProjectIds) : ids;
          return { completedProjectIds: Array.from(new Set(resolvedIds)) };
        }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearProjects: () =>
        set({
          projects: [],
          activeProject: null,
          activeProjectIds: [],
          inactiveProjectIds: [],
          completedProjectIds: [],
          hasHydrated: true,
          loading: false,
          error: null,
        }),
    }),
    {
      name: 'project-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        activeProject: state.activeProject,
        activeProjectIds: state.activeProjectIds,
        inactiveProjectIds: state.inactiveProjectIds,
        completedProjectIds: state.completedProjectIds,
      }),
    }
  )
);
