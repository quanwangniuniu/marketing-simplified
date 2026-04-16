'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { DerivedProjectStatus, ProjectFilter, useProjects } from '@/hooks/useProjects';
import { ProjectAPI, ProjectData, ProjectInvitationData } from '@/lib/api/projectApi';
import WorkspaceDashboard from '@/components/projects/WorkspaceDashboard';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Presentation,
  Trash2,
  Users,
} from 'lucide-react';
import CreateProjectModal from './CreateProjectModal';
import ProjectMembersModal from './ProjectMembersModal';
import Modal from '@/components/ui/Modal';
import { DecorativeGlow } from '@/components/ui/decorative-glow';

type ProjectWithStatus = ProjectData & {
  derivedStatus: DerivedProjectStatus;
  isActiveResolved?: boolean;
  isCompletedResolved?: boolean;
};

interface ProjectsPageProps {
  title: string;
  description: string;
  filter: ProjectFilter;
}

const formatRelativeDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return formatDistanceToNow(parsed, { addSuffix: true });
};

const getRoleBadgeClasses = (role?: string) => {
  switch (role) {
    case 'owner': return 'bg-zinc-900 text-white';
    case 'member': return 'bg-sky-100 text-sky-800';
    case 'viewer': return 'bg-slate-100 text-slate-700';
    case 'Approver': return 'bg-emerald-100 text-emerald-800';
    case 'Reviewer': return 'bg-amber-100 text-amber-800';
    case 'Organization Admin': return 'bg-violet-100 text-violet-800';
    case 'Super Administrator': return 'bg-black text-white';
    case 'Team Leader': return 'bg-fuchsia-100 text-fuchsia-800';
    case 'Campaign Manager': return 'bg-cyan-100 text-cyan-800';
    case 'Budget Controller': return 'bg-rose-100 text-rose-800';
    case 'Data Analyst': return 'bg-blue-100 text-blue-800';
    case 'Senior Media Buyer': return 'bg-indigo-100 text-indigo-800';
    case 'Specialist Media Buyer': return 'bg-purple-100 text-purple-800';
    case 'Junior Media Buyer': return 'bg-teal-100 text-teal-800';
    case 'Designer': return 'bg-pink-100 text-pink-800';
    case 'Copywriter': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const ProjectCard = ({
  project,
  onToggleActive,
  onDelete,
  onToggleCompleted,
  onManageMembers,
  updating,
  deleting,
  isExpanded,
  onToggleExpand,
}: {
  project: ProjectWithStatus;
  onToggleActive: (projectId: number, isActive: boolean) => void;
  onDelete: (projectId: number) => void;
  onToggleCompleted: (projectId: number) => void;
  onManageMembers: (project: ProjectWithStatus) => void;
  updating: boolean;
  deleting: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) => {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Card body */}
      <div className="relative flex flex-col p-5">
        <DecorativeGlow variant="subtle" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                {project.is_active && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Active project" />
                )}
              </div>
              <p className="text-sm text-gray-500">
                {project.organization?.name || 'No organization'} ·{' '}
                {project.owner?.name || project.owner?.email || 'Unassigned owner'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDelete(project.id)}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete project
          </button>
        </div>

        <p className="mt-3 min-h-[48px] text-sm text-gray-600">
          {project.description || 'No description provided for this project yet.'}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-gray-900">
              {typeof project.member_count === 'number' ? project.member_count : 0}
            </span>
            members
          </div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-gray-400" />
            Updated {formatRelativeDate(project.updated_at || project.created_at)}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <button
              onClick={() => onToggleCompleted(project.id)}
              className={`rounded-full px-3 py-1 font-semibold transition ${project.isCompletedResolved
                ? 'bg-slate-800 text-white hover:bg-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              {project.isCompletedResolved ? 'Completed' : 'Mark complete'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/projects/${project.id}/miro`}
              className="inline-flex items-center justify-center rounded-full p-2 text-blue-700 transition hover:bg-blue-50"
              aria-label="Miro Boards"
              title="Miro Boards"
            >
              <Presentation className="h-4 w-4" />
            </a>
            <a
              href={`/projects/${project.id}/spreadsheets`}
              className="inline-flex items-center justify-center rounded-full p-2 text-blue-700 transition hover:bg-blue-50"
              aria-label="Spreadsheets"
              title="Spreadsheets"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => onManageMembers(project)}
              className="inline-flex items-center justify-center rounded-full p-2 text-slate-700 transition hover:bg-slate-100"
              aria-label="Members"
              title="Members"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(project.id, !!project.isActiveResolved)}
              disabled={updating}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${project.isActiveResolved
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70'
                }`}
            >
              {updating && <Loader2 className="h-4 w-4 animate-spin" />}
              {project.isActiveResolved ? 'Active' : 'Mark active'}
            </button>
          </div>
        </div>

        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center justify-center gap-2 border-t border-gray-100 bg-gray-50 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide workspace
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show workspace
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const ProjectsPage = ({ title, description, filter }: ProjectsPageProps) => {
  const {
    projects,
    loading,
    error,
    fetchProjects,
    setActiveProject,
    updatingProjectId,
    activeProjectIds,
    deleteProject,
    deletingProjectId,
    toggleCompletedProjectId,
  } = useProjects();
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [pendingInvites, setPendingInvites] = useState<ProjectInvitationData[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<number | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<{ id: number; name: string } | null>(null);
  // Tracks which project's workspace dashboard is currently expanded
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const loadPendingInvites = useCallback(async () => {
    try {
      setInvitesLoading(true);
      setInvitesError(null);
      const data = await ProjectAPI.getMyPendingInvitations();
      setPendingInvites(data || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load invitations.';
      setInvitesError(message);
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingInvites();
  }, [loadPendingInvites]);

  const decoratedProjects: ProjectWithStatus[] = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        derivedStatus: project.derivedStatus || 'open',
        isActiveResolved: project.isActiveResolved,
      })),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    let list = decoratedProjects;
    if (filter === 'active') {
      list = list.filter((item) => item.derivedStatus === 'active');
    } else if (filter === 'completed') {
      list = list.filter((item) => item.derivedStatus === 'completed');
    }
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter((item) => {
      const name = item.name?.toLowerCase() || '';
      const descriptionMatch = (item.description || '').toLowerCase();
      const ownerMatch = (item.owner?.name || item.owner?.email || '').toLowerCase();
      return name.includes(term) || descriptionMatch.includes(term) || ownerMatch.includes(term);
    });
  }, [decoratedProjects, filter, search]);

  const totals = useMemo(() => {
    const activeCount = decoratedProjects.filter((item) => item.derivedStatus === 'active').length;
    const completedCount = decoratedProjects.filter((item) => item.derivedStatus === 'completed').length;
    return {
      total: decoratedProjects.length,
      active: activeCount,
      completed: completedCount,
      open: decoratedProjects.length - activeCount - completedCount,
    };
  }, [decoratedProjects]);

  const handleProjectCreated = useCallback(async () => {
    await fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!membersModalOpen || !selectedProject) return;
    const fresh = projects.find((p) => p.id === selectedProject.id);
    if (!fresh || fresh === selectedProject) return;
    setSelectedProject(fresh);
  }, [membersModalOpen, projects, selectedProject]);

  const handleAcceptInvite = async (invite: ProjectInvitationData) => {
    if (!invite.token) { toast.error('Missing invitation token.'); return; }
    if (!invite.approved) { toast.error('Invitation is pending approval.'); return; }
    try {
      setAcceptingInviteId(invite.id);
      await ProjectAPI.acceptInvitation(invite.token);
      toast.success('Invitation accepted.');
      await fetchProjects();
      await loadPendingInvites();
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to accept invitation.';
      toast.error(message);
    } finally {
      setAcceptingInviteId(null);
    }
  };

  const handleOpenMembers = (project: ProjectWithStatus) => {
    setSelectedProject(project);
    setMembersModalOpen(true);
  };

  const handleCloseMembers = () => {
    setMembersModalOpen(false);
    setSelectedProject(null);
  };

  const renderPendingInvites = () => {
    if (invitesLoading) {
      return (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Loading invitations...
        </div>
      );
    }
    if (invitesError) {
      return (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-red-200 bg-white px-4 py-4 text-sm text-red-600 shadow-sm">
          <span>{invitesError}</span>
          <button onClick={loadPendingInvites} className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">Retry</button>
        </div>
      );
    }
    if (pendingInvites.length === 0) return null;
    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Pending invitations</p>
            <p className="text-xs text-gray-500">Accept to join the project and appear in member lists.</p>
          </div>
          <button onClick={loadPendingInvites} className="text-xs font-medium text-blue-600 hover:text-blue-700">Refresh</button>
        </div>
        <div className="mt-4 space-y-3">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{invite.project?.name || 'Project'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Role:</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getRoleBadgeClasses(invite.role)}`}>{invite.role}</span>
                  {!invite.approved && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">Pending approval</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Invited by {invite.invited_by?.name || invite.invited_by?.email || 'Owner'}</p>
              </div>
              <button
                onClick={() => handleAcceptInvite(invite)}
                disabled={acceptingInviteId === invite.id || !invite.approved}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {acceptingInviteId === invite.id && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept invitation
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="mt-3 font-medium text-gray-900">Loading projects…</p>
          <p className="text-sm text-gray-600">Fetching your projects from the backend.</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
          <AlertCircle className="h-6 w-6" />
          <p className="mt-3 font-semibold">Could not load projects</p>
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => fetchProjects()} className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Retry</button>
        </div>
      );
    }
    if (filter === 'completed') {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-600">
          <FolderOpen className="h-7 w-7 text-gray-400" />
          <p className="mt-3 font-semibold text-gray-900">No completed projects yet</p>
          <p className="text-sm text-gray-500">Projects will show up here once the backend marks them as completed or archived.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-600">
        <FolderOpen className="h-7 w-7 text-gray-400" />
        <p className="mt-3 font-semibold text-gray-900">No projects to show</p>
        <p className="text-sm text-gray-500">Create or import a project to get started.</p>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm uppercase tracking-wide text-blue-700">
                <div className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4" />
                </div>
                Projects
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                    {filter === 'all' && (
                      <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-3 py-1.5 rounded text-white bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold"
                      >
                        Create Project
                      </button>
                    )}
                  </div>
                  <p className="text-gray-600">{description}</p>
                </div>
                <div className="flex gap-2 text-sm text-gray-600">
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200">
                    <span className="text-xs uppercase text-gray-500">Total</span>
                    <div className="text-base font-semibold text-gray-900">{totals.total}</div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200">
                    <span className="text-xs uppercase text-gray-500">Active</span>
                    <div className="text-base font-semibold text-gray-900">{totals.active}</div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200">
                    <span className="text-xs uppercase text-gray-500">Completed</span>
                    <div className="text-base font-semibold text-gray-900">{totals.completed}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, owner, or description"
                  className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchProjects()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : 'text-gray-400'}`} />
                  Refresh
                </button>
              </div>
            </div>

            {renderPendingInvites()}

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {filteredProjects.length === 0 ? (
                <div className="sm:col-span-2">{renderEmptyState()}</div>
              ) : (
                filteredProjects.map((project) => (
                  <Fragment key={project.id}>
                    <ProjectCard
                      project={project}
                      onToggleActive={setActiveProject}
                      onDelete={() => {
                        setDeleteConfirmProject({
                          id: project.id,
                          name: project.name || 'this project',
                        });
                      }}
                      onToggleCompleted={toggleCompletedProjectId}
                      onManageMembers={handleOpenMembers}
                      updating={updatingProjectId === project.id}
                      deleting={deletingProjectId === project.id}
                      isExpanded={expandedProjectId === project.id}
                      onToggleExpand={() =>
                        setExpandedProjectId(
                          expandedProjectId === project.id ? null : project.id
                        )
                      }
                    />
                    {/* Full-width workspace dashboard — spans both columns when expanded */}
                    {expandedProjectId === project.id && (
                      <div className="sm:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {project.name} — Workspace
                          </h3>
                          <button
                            onClick={() => setExpandedProjectId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            ✕ Close
                          </button>
                        </div>
                        <div className="p-6">
                          <WorkspaceDashboard projectId={project.id} />
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))
              )}
            </div>

            {membersModalOpen && selectedProject && (
              <div className="mt-8">
                <ProjectMembersModal
                  isOpen={true}
                  onClose={handleCloseMembers}
                  project={selectedProject}
                  onMembersUpdated={handleProjectCreated}
                  variant="panel"
                />
              </div>
            )}
          </div>
        </div>
      </Layout>
      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleProjectCreated}
      />
      {deleteConfirmProject && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (deletingProjectId !== deleteConfirmProject.id) setDeleteConfirmProject(null);
          }}
        >
          <div className="w-[min(420px,calc(100vw-2rem))]">
            <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100">
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Delete project</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Delete &quot;{deleteConfirmProject.name}&quot;? This cannot be undone.
                </p>
              </div>
              <div className="p-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmProject(null)}
                  className="rounded border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={deletingProjectId === deleteConfirmProject.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!deleteConfirmProject) return;
                    const id = deleteConfirmProject.id;
                    void deleteProject(id).finally(() => setDeleteConfirmProject(null));
                  }}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  disabled={deletingProjectId === deleteConfirmProject.id}
                >
                  {deletingProjectId === deleteConfirmProject.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {!membersModalOpen && null}
    </ProtectedRoute>
  );
};

export default ProjectsPage;