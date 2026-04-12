'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowLeft,
  FilePenLine,
  Trash2,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { ProjectAPI, type ProjectData } from '@/lib/api/projectApi';
import { useAuthStore } from '@/lib/authStore';
import DecisionEditModal from '@/components/decisions/DecisionEditModal';
import DecisionLinkEditor from '@/components/decisions/DecisionLinkEditor';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { OriginMeetingBlock } from '@/components/meetings/OriginMeetingBlock';
import type { DecisionGraphResponse, DecisionListItem } from '@/types/decision';

type PendingDelete =
  | { type: 'tree'; node: DecisionGraphResponse['nodes'][number]; projectId: number }
  | { type: 'list'; decision: DecisionListItem; projectId: number };

/**
 * Merging `listDecisions` per project can duplicate the same row if the API returns
 * overlapping results for each project scope (e.g. same global list per call).
 * Decision ids are unique — keep a single row per id.
 */
function dedupeDecisionListItems(items: DecisionListItem[]): DecisionListItem[] {
  const byId = new Map<number, DecisionListItem>();
  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

const statusColor = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-amber-100 text-amber-800';
    case 'AWAITING_APPROVAL':
      return 'bg-blue-100 text-blue-800';
    case 'COMMITTED':
      return 'bg-emerald-100 text-emerald-800';
    case 'REVIEWED':
      return 'bg-purple-100 text-purple-800';
    case 'ARCHIVED':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
};

const ROLE_LEVELS: Record<string, number> = {
  owner: 1,
  'Super Administrator': 1,
  'Organization Admin': 2,
  'Team Leader': 3,
  'Campaign Manager': 4,
  'Budget Controller': 5,
  Approver: 6,
  Reviewer: 7,
  'Data Analyst': 8,
  member: 8,
  'Senior Media Buyer': 9,
  'Specialist Media Buyer': 10,
  'Junior Media Buyer': 11,
  Designer: 12,
  Copywriter: 13,
  viewer: 999,
};

const APPROVAL_REVIEW_MAX_LEVEL = 8;
const EDIT_MAX_LEVEL = 13;
const DEFAULT_SORT_MODE = 'SEQ' as const;
const COMPACT_PAGE_SIZE = 24;

const DecisionsPage = () => {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [decisions, setDecisions] = useState<DecisionListItem[]>([]);
  const [graphsByProject, setGraphsByProject] = useState<
    Record<number, DecisionGraphResponse>
  >({});
  const [decisionsByProject, setDecisionsByProject] = useState<Record<number, DecisionListItem[]>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [projectRoles, setProjectRoles] = useState<Record<number, string>>({});
  const [collapsedTrees, setCollapsedTrees] = useState<Record<number, boolean>>({});
  const [collapsedLists, setCollapsedLists] = useState<Record<number, boolean>>({});
  const [creatingProjectId, setCreatingProjectId] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDecisionId, setEditDecisionId] = useState<number | null>(null);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [paginationByProject, setPaginationByProject] = useState<
    Record<number, { pageIndex: number; pageSize: number }>
  >({});
  const [sortByProject, setSortByProject] = useState<
    Record<number, 'UPDATED' | 'STATUS' | 'RISK' | 'SEQ'>
  >({});
  const [sortDirByProject, setSortDirByProject] = useState<Record<number, 'asc' | 'desc'>>(
    {}
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(null);
  /** Project scope for detail API calls — must match the project of `selectedDecisionId`. */
  const [selectedDecisionProjectId, setSelectedDecisionProjectId] = useState<number | null>(
    null
  );
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [selectedSignals, setSelectedSignals] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const clearDecisionSelection = () => {
    setSelectedDecisionId(null);
    setSelectedDecisionProjectId(null);
  };

  const selectDecisionInProject = (decisionId: number, projectId: number) => {
    setSelectedDecisionId(decisionId);
    setSelectedDecisionProjectId(projectId);
  };

  const handleCreateDecision = async (project: ProjectData) => {
    setCreatingProjectId(project.id);
    try {
      const draft = await DecisionAPI.createDraft(project.id);
      router.push(`/decisions/${draft.id}?project_id=${project.id}`);
    } catch (error) {
      console.error('Failed to create decision draft:', error);
      toast.error('Failed to create decision draft.');
    } finally {
      setCreatingProjectId(null);
    }
  };

  const handleCreateDecisionModal = async (project: ProjectData) => {
    setCreatingProjectId(project.id);
    try {
      const draft = await DecisionAPI.createDraft(project.id);
      if (draft?.id != null) handleOpenEditModal(draft.id, project.id);
    } catch (error) {
      console.error('Failed to create decision draft:', error);
      toast.error('Failed to create decision draft.');
    } finally {
      setCreatingProjectId(null);
    }
  };

  const handleOpenEditModal = (decisionId: number, projectId?: number | null) => {
    setEditDecisionId(decisionId);
    setEditProjectId(projectId ?? null);
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditDecisionId(null);
    setEditProjectId(null);
  };

  const handleDeleteFromTree = (node: DecisionGraphResponse['nodes'][number], projectId: number) => {
    setPendingDelete({ type: 'tree', node, projectId });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteDecision = (decision: DecisionListItem, projectId: number) => {
    setPendingDelete({ type: 'list', decision, projectId });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteDecision = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.type === 'tree' ? pendingDelete.node.id : pendingDelete.decision.id;
    const projectId = pendingDelete.projectId;
    setDeleting(true);
    try {
      await DecisionAPI.deleteDecision(id, projectId);
      if (selectedDecisionId === id) {
        clearDecisionSelection();
      }
      await fetchProjectsAndDecisions();
      toast.success('Decision deleted.');
    } catch (error: any) {
      console.error('Failed to delete decision:', error);
      const message = error?.response?.data?.detail || 'Failed to delete decision.';
      toast.error(message);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  const fetchProjectsAndDecisions = async () => {
    setLoading(true);
    try {
      const projectList = await ProjectAPI.getProjects();
      setProjects(projectList);
      if (projectList.length === 0) {
        setDecisions([]);
        setDecisionsByProject({});
        setLoading(false);
        return;
      }
      const listResponses = await Promise.all(
        projectList.map((project) => DecisionAPI.listDecisions(project.id))
      );
      const items = dedupeDecisionListItems(
        listResponses.flatMap((response) => response.items || [])
      );
      setDecisions(items);
      const graphEntries = await Promise.all(
        projectList.map(async (project): Promise<[number, DecisionGraphResponse]> => {
          try {
            const graph = await DecisionAPI.getDecisionGraph(project.id);
            return [project.id, graph];
          } catch (error) {
            console.warn('Failed to load graph for project:', project.id, error);
            return [
              project.id,
              { nodes: [], edges: [] } as DecisionGraphResponse,
            ] as const;
          }
        })
      );
      const graphs = graphEntries.reduce<Record<number, DecisionGraphResponse>>(
        (acc, [id, graph]) => {
          acc[id] = graph;
          return acc;
        },
        {}
      );
      setGraphsByProject(graphs);
    } catch (error) {
      console.error('Failed to load decisions:', error);
      toast.error('Failed to load decisions.');
      setProjects([]);
      setDecisions([]);
      setGraphsByProject({});
      setDecisionsByProject({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectsAndDecisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      if (!currentUserId) return;
      if (projects.length === 0) return;
      try {
        const entries = await Promise.all(
          projects.map(async (project) => {
            const id = project.id;
            const members = await ProjectAPI.getProjectMembers(id);
            const current = members.find((member) => member.user?.id === currentUserId);
            return [id, current?.role || 'member'] as const;
          })
        );
        const next = entries.reduce<Record<number, string>>((acc, [id, role]) => {
          acc[id] = role;
          return acc;
        }, {});
        setProjectRoles(next);
      } catch (error) {
        console.warn('Failed to load project roles:', error);
      }
    };
    loadRoles();
  }, [projects, currentUserId]);

  useEffect(() => {
    const next: Record<number, DecisionListItem[]> = {};
    projects.forEach((project) => {
      next[project.id] = [];
    });
    decisions.forEach((item) => {
      if (!item.projectId) return;
      if (!next[item.projectId]) {
        next[item.projectId] = [];
      }
      next[item.projectId].push(item);
    });
    setDecisionsByProject(next);
  }, [decisions, projects]);

  useEffect(() => {
    if (loading) return;
    const nextPagination: Record<number, { pageIndex: number; pageSize: number }> = {};
    projects.forEach((project) => {
      const items = decisionsByProject[project.id] || [];
      const pageSize = COMPACT_PAGE_SIZE;
      const paging = paginationByProject[project.id] || {
        pageIndex: 0,
        pageSize,
      };
      const totalPages = Math.max(1, Math.ceil(items.length / paging.pageSize));
      const clampedIndex = Math.min(paging.pageIndex, totalPages - 1);
      if (
        !paginationByProject[project.id] ||
        clampedIndex !== paging.pageIndex ||
        paging.pageSize !== pageSize
      ) {
        nextPagination[project.id] = {
          pageIndex: clampedIndex,
          pageSize,
        };
      }
    });
    if (Object.keys(nextPagination).length > 0) {
      setPaginationByProject((prev) => ({
        ...prev,
        ...nextPagination,
      }));
    }
  }, [loading, projects, decisionsByProject, paginationByProject]);

  useEffect(() => {
    if (selectedDecisionId == null) {
      setSelectedDecision(null);
      setSelectedSignals([]);
      return;
    }
    const projectId =
      selectedDecisionProjectId ??
      decisions.find((d) => d.id === selectedDecisionId)?.projectId ??
      null;
    if (projectId == null) {
      setSelectedDecision(null);
      setSelectedSignals([]);
      setLoadingDetail(false);
      toast.error('Could not determine project for this decision.');
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    const fetchDetail = async () => {
      try {
        let decision: any;
        try {
          decision = await DecisionAPI.getDecision(selectedDecisionId, projectId);
        } catch {
          decision = await DecisionAPI.getDraft(selectedDecisionId, projectId);
        }
        if (cancelled) return;
        setSelectedDecision(decision);
        try {
          const signalsResponse = await DecisionAPI.listSignals(selectedDecisionId, projectId);
          if (!cancelled) setSelectedSignals(signalsResponse.items || []);
        } catch {
          if (!cancelled) setSelectedSignals([]);
        }
      } catch {
        if (!cancelled) {
          setSelectedDecision(null);
          setSelectedSignals([]);
          toast.error('Failed to load decision details.');
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [selectedDecisionId, selectedDecisionProjectId, decisions]);

  const seqByDecisionId = useMemo(() => {
    const map = new Map<number, number>();
    Object.values(graphsByProject).forEach((g) => {
      g.nodes.forEach((n) => {
        if (n.projectSeq != null) map.set(n.id, n.projectSeq);
      });
    });
    return map;
  }, [graphsByProject]);

  const listContent = useMemo(() => {
    if (loading) {
      return (
        <div className="text-sm text-gray-500">Loading decisions...</div>
      );
    }

    if (projects.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No projects found for your account.
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {projects.map((project) => {
          const groupKey = `project-${project.id}`;
          const isTreeCollapsed = collapsedTrees[project.id] ?? false;
          const isListCollapsed = collapsedLists[project.id] ?? false;
          const roleLabel = projectRoles[project.id] || 'member';
          const roleLevel = ROLE_LEVELS[roleLabel] ?? ROLE_LEVELS.member;
          const canReview = roleLevel <= APPROVAL_REVIEW_MAX_LEVEL;
          const canDelete = roleLevel <= EDIT_MAX_LEVEL;
          const decisions = decisionsByProject[project.id] || [];
          const graph =
            graphsByProject[project.id] ??
            ({ nodes: [], edges: [] } as DecisionGraphResponse);
          return (
          <div
            key={groupKey}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4"
              data-project-header={project.id}
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
                <p className="text-xs text-gray-500">
                  {decisions.length} decision{decisions.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateDecision(project)}
                  disabled={creatingProjectId === project.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FilePenLine className="h-3.5 w-3.5" />
                  {creatingProjectId === project.id ? 'Creating...' : 'Create Decision'}
                </button>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                  {roleLabel}
                </span>
              </div>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="leading-tight">
                    <h3 className="text-sm font-semibold text-gray-900">Decision Tree</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Tip: Drag from one decision to another to create a link. Click a link to remove it.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedTrees((prev) => ({
                      ...prev,
                      [project.id]: !isTreeCollapsed,
                    }))
                  }
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
                >
                  {isTreeCollapsed ? '▼' : '▲'}
                </button>
              </div>
              {!isTreeCollapsed && (
                <DecisionLinkEditor
                  variant="inline"
                  projectId={project.id}
                  onSaved={fetchProjectsAndDecisions}
                  onClose={() =>
                    setCollapsedTrees((prev) => ({ ...prev, [project.id]: true }))
                  }
                  onEditDecision={(node) => handleOpenEditModal(node.id, project.id)}
                  onCreateDecision={() => handleCreateDecisionModal(project)}
                  selectedNodeId={selectedDecisionId}
                  onSelectNode={(id) => selectDecisionInProject(id, project.id)}
                  onDelete={(node) => handleDeleteFromTree(node, project.id)}
                  canReview={canReview}
                  canDelete={canDelete}
                  autoFocusToday
                />
              )}

              <div className="h-px bg-gray-200" />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">Decisions</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600">
                      <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                      <select
                        value={sortByProject[project.id] || DEFAULT_SORT_MODE}
                        onChange={(event) =>
                          setSortByProject((prev) => ({
                            ...prev,
                            [project.id]: event.target.value as
                              | 'UPDATED'
                              | 'STATUS'
                              | 'RISK'
                              | 'SEQ',
                          }))
                        }
                        className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none"
                      >
                        <option value="UPDATED">Updated</option>
                        <option value="STATUS">Status</option>
                        <option value="RISK">Risk</option>
                        <option value="SEQ">Seq</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setSortDirByProject((prev) => {
                            const current = prev[project.id] || 'desc';
                            const next = current === 'asc' ? 'desc' : 'asc';
                            return { ...prev, [project.id]: next };
                          })
                        }
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-gray-300"
                        title="Toggle sort direction"
                      >
                        {(sortDirByProject[project.id] || 'desc') === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedLists((prev) => ({
                        ...prev,
                        [project.id]: !isListCollapsed,
                      }))
                    }
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
                  >
                    {isListCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>
              </div>

              {!isListCollapsed ? (
                selectedDecisionId != null ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => clearDecisionSelection()}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to list
                    </button>
                    {loadingDetail ? (
                      <div className="text-sm text-gray-500">Loading decision details...</div>
                    ) : selectedDecision ? (
                      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {selectedDecision.projectSeq ? `#${selectedDecision.projectSeq} ` : ''}
                            {selectedDecision.title || 'Untitled'}
                          </h3>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusColor(selectedDecision.status)}`}>
                              {selectedDecision.status}
                            </span>
                            {selectedDecision.riskLevel ? (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                {selectedDecision.riskLevel}
                              </span>
                            ) : null}
                            <span className="text-gray-500">
                              Created {formatDate(selectedDecision.createdAt)}
                            </span>
                          </div>
                        </div>

                        {selectedDecision.origin_meeting ? (
                          <div data-testid="decisions-list-preview-origin-meeting">
                            <OriginMeetingBlock origin={selectedDecision.origin_meeting} />
                          </div>
                        ) : null}

                        {selectedSignals.length > 0 ? (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Signals</h4>
                            <div className="space-y-2">
                              {selectedSignals.map((signal: any) => (
                                <div key={signal.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                  <div className="font-semibold">{signal.metric} &middot; {signal.movement?.replace(/_/g, ' ').toLowerCase()} &middot; {signal.period?.replace(/_/g, ' ').toLowerCase()}</div>
                                  {signal.scopeValue ? (
                                    <div className="mt-0.5 text-gray-500">{signal.scopeType}: {signal.scopeValue}</div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {selectedDecision.contextSummary ? (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Context Summary</h4>
                            <p className="whitespace-pre-wrap text-sm text-gray-700">{selectedDecision.contextSummary}</p>
                          </div>
                        ) : null}

                        {selectedDecision.options && selectedDecision.options.length > 0 ? (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Options</h4>
                            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                              {selectedDecision.options.map((opt: any, idx: number) => (
                                <li key={opt.id ?? idx}>
                                  {opt.text || '(empty)'}
                                  {opt.isSelected ? (
                                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Selected</span>
                                  ) : null}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}

                        {selectedDecision.reasoning ? (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Reasoning</h4>
                            <p className="whitespace-pre-wrap text-sm text-gray-700">{selectedDecision.reasoning}</p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                          {selectedDecision.riskLevel ? (
                            <span>Risk Level: <span className="font-semibold">{selectedDecision.riskLevel}</span></span>
                          ) : null}
                          {selectedDecision.confidenceScore != null ? (
                            <span>Confidence: <span className="font-semibold">{selectedDecision.confidenceScore}</span></span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            onClick={() => router.push(`/decisions/${selectedDecisionId}${project.id ? `?project_id=${project.id}` : ''}`)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const listItem = decisions.find((d) => d.id === selectedDecisionId);
                              if (listItem) handleDeleteDecision(listItem, project.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:border-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Decision not found.</div>
                    )}
                  </div>
                ) : (
                <>
                  {decisions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                      No decisions for this project yet.
                    </div>
                  ) : null}
                  {(() => {
                    const sortMode = sortByProject[project.id] || DEFAULT_SORT_MODE;
                    const sortDir =
                      sortDirByProject[project.id] ||
                      (sortMode === 'UPDATED' || sortMode === 'SEQ' ? 'desc' : 'asc');
                    const seqByDecisionId = new Map<number, number>();
                    graph.nodes.forEach((node) => {
                      if (node.id && node.projectSeq !== undefined && node.projectSeq !== null) {
                        seqByDecisionId.set(node.id, node.projectSeq);
                      }
                    });
                    const statusRank: Record<string, number> = {
                      DRAFT: 1,
                      AWAITING_APPROVAL: 2,
                      COMMITTED: 3,
                      REVIEWED: 4,
                      ARCHIVED: 5,
                    };
                    const riskRank: Record<string, number> = {
                      HIGH: 1,
                      MEDIUM: 2,
                      LOW: 3,
                    };
                    const sorted = [...decisions].sort((a, b) => {
                      let diff = 0;
                      if (sortMode === 'STATUS') {
                        const aRank = statusRank[a.status] ?? 999;
                        const bRank = statusRank[b.status] ?? 999;
                        diff = aRank - bRank;
                      }
                      if (sortMode === 'RISK') {
                        const aRisk =
                          'riskLevel' in a && (a as any).riskLevel
                            ? (a as any).riskLevel
                            : undefined;
                        const bRisk =
                          'riskLevel' in b && (b as any).riskLevel
                            ? (b as any).riskLevel
                            : undefined;
                        const aRank = aRisk ? riskRank[aRisk] ?? 999 : 999;
                        const bRank = bRisk ? riskRank[bRisk] ?? 999 : 999;
                        diff = aRank - bRank;
                      }
                      if (sortMode === 'SEQ') {
                        const aSeq = a.projectSeq ?? seqByDecisionId.get(a.id) ?? 999999;
                        const bSeq = b.projectSeq ?? seqByDecisionId.get(b.id) ?? 999999;
                        diff = aSeq - bSeq;
                      }
                      if (sortMode === 'UPDATED') {
                        const aTime = new Date(
                          a.updatedAt || a.createdAt || 0
                        ).getTime();
                        const bTime = new Date(
                          b.updatedAt || b.createdAt || 0
                        ).getTime();
                        diff = aTime - bTime;
                      }
                      if (diff !== 0) {
                        return sortDir === 'asc' ? diff : -diff;
                      }
                      const aTime = new Date(
                        a.updatedAt || a.createdAt || 0
                      ).getTime();
                      const bTime = new Date(
                        b.updatedAt || b.createdAt || 0
                      ).getTime();
                      return bTime - aTime;
                    });
                    const pageSize = COMPACT_PAGE_SIZE;
                    const paging =
                      paginationByProject[project.id] || {
                        pageIndex: 0,
                        pageSize,
                      };
                    const totalPages = Math.max(
                      1,
                      Math.ceil(sorted.length / paging.pageSize)
                    );
                    const pageIndex = Math.min(paging.pageIndex, totalPages - 1);
                    const start = pageIndex * paging.pageSize;
                    const end = start + paging.pageSize;
                    const visible = sorted.slice(start, end);
                    const setPageIndex = (nextIndex: number) => {
                      setPaginationByProject((prev) => ({
                        ...prev,
                        [project.id]: { ...paging, pageIndex: nextIndex },
                      }));
                    };

                    return (
                      <>
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                          <div className="grid grid-cols-[70px_minmax(220px,1fr)_105px_105px] gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <div>#Seq</div>
                            <div>Title</div>
                            <div className="flex justify-center">Status</div>
                            <div className="flex justify-center">Risk</div>
                          </div>
                          <div className="divide-y divide-gray-200 bg-white">
                            {visible.map((decision) => {
                              const seq = decision.projectSeq ?? seqByDecisionId.get(decision.id);
                              return (
                              <div
                                key={decision.id}
                                onClick={() => selectDecisionInProject(decision.id, project.id)}
                                className={`grid cursor-pointer grid-cols-[70px_minmax(220px,1fr)_105px_105px] items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 ${
                                  selectedDecisionId === decision.id ? 'border-l-2 border-blue-500 bg-blue-50' : ''
                                }`}
                              >
                                <div className="text-[11px] font-semibold text-gray-500">
                                  {typeof seq === 'number' ? `#${seq}` : '—'}
                                </div>
                                <div className="truncate font-semibold text-gray-900">
                                  {decision.title || 'Untitled'}
                                </div>
                                <div className="flex justify-center">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(
                                      decision.status
                                    )}`}
                                  >
                                    {decision.status}
                                  </span>
                                </div>
                                <div className="text-center text-[11px] font-semibold text-slate-600">
                                  {'riskLevel' in decision && (decision as any).riskLevel
                                    ? (decision as any).riskLevel
                                    : '—'}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600">
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .querySelector(`[data-project-header='${project.id}']`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }
                            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
                          >
                            Back to header
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                              disabled={pageIndex === 0}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                pageIndex === 0
                                  ? 'cursor-not-allowed border-gray-200 text-gray-300'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              &lt;
                            </button>
                            <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                              <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={pageIndex + 1}
                                onChange={(event) => {
                                  const raw = Number(event.target.value);
                                  if (!Number.isFinite(raw)) return;
                                  const clamped = Math.min(
                                    Math.max(1, Math.floor(raw)),
                                    totalPages
                                  );
                                  setPageIndex(clamped - 1);
                                }}
                                className="w-12 rounded-md border border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-700 focus:border-blue-500 focus:outline-none"
                              />
                              <span>/</span>
                              <span>{totalPages}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPageIndex(Math.min(totalPages - 1, pageIndex + 1))
                              }
                              disabled={pageIndex >= totalPages - 1}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                pageIndex >= totalPages - 1
                                  ? 'cursor-not-allowed border-gray-200 text-gray-300'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              &gt;
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
                )
              ) : (
                <div className="text-sm text-gray-500">
                  {decisions.length} decision{decisions.length === 1 ? '' : 's'} hidden.
                </div>
              )}
            </div>
          </div>
        );
        })}
      </div>
    );
  }, [
    decisionsByProject,
    loading,
    projectRoles,
    collapsedTrees,
    collapsedLists,
    currentUserId,
    projects,
    graphsByProject,
    seqByDecisionId,
    paginationByProject,
    sortByProject,
    sortDirByProject,
    selectedDecisionId,
    selectedDecision,
    selectedSignals,
    loadingDetail,
  ]);

  return (
    <Layout>
      <ProtectedRoute>
        <div className="flex h-full flex-col gap-6 bg-gray-50 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Decisions</h1>
              <p className="mt-1 text-sm text-gray-500">
                Review and open decisions across your projects.
              </p>
            </div>
                <div />
          </div>

          {listContent}
        </div>
      </ProtectedRoute>
      <DecisionEditModal
        decisionId={editDecisionId}
        projectId={editProjectId}
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        onSaved={fetchProjectsAndDecisions}
      />
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteConfirmOpen(false);
            setPendingDelete(null);
          }
        }}
        onConfirm={confirmDeleteDecision}
        title="Delete decision"
        message={
          pendingDelete
            ? `Are you sure you want to delete decision "${pendingDelete.type === 'tree' ? pendingDelete.node.title || 'Untitled' : pendingDelete.decision.title || 'Untitled'}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </Layout>
  );
};

export default DecisionsPage;
