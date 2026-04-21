'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuthStore } from '@/lib/authStore';
import {
  ProjectAPI,
  ProjectData,
} from '@/lib/api/projectApi';
import { useProjectStore } from '@/lib/projectStore';

interface OnboardingContextValue {
  needsOnboarding: boolean;
  checking: boolean;
  fetchError: string | null;
  projects: ProjectData[];
  activeProject: ProjectData | null;
  refreshProjects: () => Promise<void>;
  markCompleted: (project: ProjectData | null) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialized, loading } = useAuthStore();
  const {
    projects,
    activeProject,
    setProjects,
    setActiveProject,
    setLoading,
    setError,
    clearProjects,
  } = useProjectStore();

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const normalizeProjects = (data: unknown): ProjectData[] => {
    if (Array.isArray(data)) return data as ProjectData[];
    if (data && typeof data === 'object' && Array.isArray((data as any).results)) {
      return (data as any).results as ProjectData[];
    }
    return [];
  };

  const evaluateProjects = useCallback(
    (rawProjects: any, pendingInviteCount: number) => {
      const list = normalizeProjects(rawProjects);
      setProjects(list);

      if (list.length === 0) {
        // A user with no projects but a pending invitation should land on
        // /select-project (banner surfaces the invite) instead of being
        // forced into the onboarding wizard.
        setNeedsOnboarding(pendingInviteCount === 0);
        setActiveProject(null);
        return;
      }

      const currentActive = list.find((project) => project.id === activeProject?.id);
      const nextActive = currentActive || list[0];

      setActiveProject(nextActive);
      setNeedsOnboarding(false);
    },
    [activeProject?.id, setActiveProject, setNeedsOnboarding, setProjects]
  );

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) {
      setNeedsOnboarding(false);
      setFetchError(null);
      setLoading(false);
      return;
    }

    setChecking(true);
    setLoading(true);

    try {
      const [projectList, invitations] = await Promise.all([
        ProjectAPI.getProjects(),
        ProjectAPI.getMyPendingInvitations().catch(() => []),
      ]);
      const pendingCount = Array.isArray(invitations) ? invitations.length : 0;
      evaluateProjects(projectList, pendingCount);
      setFetchError(null);
      setError(null);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to load projects';
      setFetchError(message);
      setError(message);
      // If we cannot determine project membership, keep the UI blocked
      setNeedsOnboarding(true);
    } finally {
      setChecking(false);
      setLoading(false);
    }
  }, [evaluateProjects, isAuthenticated, setError, setLoading, setNeedsOnboarding]);

  useEffect(() => {
    if (!initialized || loading) return;

    if (!isAuthenticated) {
      setNeedsOnboarding(false);
      setFetchError(null);
      setLoading(false);
      setError(null);
      clearProjects();
      return;
    }

    refreshProjects();
  }, [
    initialized,
    loading,
    isAuthenticated,
    refreshProjects,
    clearProjects,
    setError,
    setFetchError,
    setLoading,
    setNeedsOnboarding,
  ]);

  const markCompleted = useCallback(
    (project: ProjectData | null) => {
      if (project) {
        const baseList = Array.isArray(projects) ? projects : [];
        const updatedList = baseList.filter((existing) => existing.id !== project.id);
        updatedList.unshift(project);
        setProjects(updatedList);
        setActiveProject(project);
        setNeedsOnboarding(false);
        setFetchError(null);
      } else {
        setNeedsOnboarding(false);
      }
    },
    [projects, setActiveProject, setFetchError, setNeedsOnboarding, setProjects]
  );

  const value = useMemo(
    () => ({
      needsOnboarding,
      checking,
      fetchError,
      projects,
      activeProject,
      refreshProjects,
      markCompleted,
    }),
    [
      needsOnboarding,
      checking,
      fetchError,
      projects,
      activeProject,
      refreshProjects,
      markCompleted,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextValue => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
