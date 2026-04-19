'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  FormEvent,
  Suspense,
} from 'react';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Loader2, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '@/components/layout/Layout';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type {
  MeetingCreateRequest,
  MeetingListQueryParams,
  PaginatedMeetingsList,
} from '@/types/meeting';
import { MeetingDateTimePicker } from '@/components/meetings/MeetingDateTimePicker';
import { ProjectAPI, type ProjectData, type ProjectMemberData } from '@/lib/api/projectApi';
import { meetingTimeToInput, normalizeTimeForApi } from '@/lib/meetingSchedule';
import { formatMeetingsApiError } from '@/lib/meetingsApiErrors';
import {
  buildSystemTemplateOptions,
  fetchUnifiedMeetingTemplateOptions,
  layoutConfigForNewMeetingFromSelection,
  type UnifiedMeetingTemplateOption,
} from '@/lib/meetings/unifiedMeetingTemplates';
import { MeetingSummaryPanel } from '@/components/meetings/MeetingSummaryPanel';
import { MeetingsWorkspaceShell } from '@/components/meetings/MeetingsWorkspaceShell';
import { useAuthStore } from '@/lib/authStore';
import {
  parseMeetingDiscoveryParams,
  hasActiveDiscoveryFilters,
  discoveryParamsToSearchParamsString,
  mergeMeetingDiscoveryPatch,
  activeMeetingDiscoveryFilterCount,
} from '@/lib/meetings/meetingDiscoveryUrl';
import { DEFAULT_MEETING_ORDERING } from '@/lib/meetings/meetingOrdering';
import { getNextWeekDateRange, getThisWeekDateRange } from '@/lib/meetings/meetingQuickRanges';
import {
  applyMeetingSort,
  DEFAULT_MEETING_SORT,
  type MeetingSortKey,
} from '@/lib/meetings/meetingSectionSort';
import {
  MeetingDiscoveryToolbar,
  type FilterChip,
} from '@/components/meetings/discovery/MeetingDiscoveryToolbar';
import {
  patchFromPopoverDraft,
  popoverDraftFromQuery,
  usePopoverDraftFromParams,
  type MeetingFilterPopoverDraft,
} from '@/components/meetings/discovery/MeetingFilterPopover';
import { MeetingResultsTable } from '@/components/meetings/discovery/MeetingResultsTable';
import { MeetingsLane } from '@/components/meetings/discovery/MeetingsLane';
import { splitMeetingRowsBySchedule } from '@/lib/meetings/meetingScheduleSplit';

const PAGE_SIZE = 20;

function MeetingsPageInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectIdParam = params?.projectId as string | undefined;
  const projectId = projectIdParam ? Number(projectIdParam) : NaN;
  const currentUserIdRaw = useAuthStore((state) => state.user?.id);
  const currentUserId = useMemo(() => {
    if (currentUserIdRaw == null) return undefined;
    const n = Number(currentUserIdRaw);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  }, [currentUserIdRaw]);

  const queryKey = searchParams.toString();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [availableProjects, setAvailableProjects] = useState<ProjectData[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberData[]>([]);
  const [listPage, setListPage] = useState<PaginatedMeetingsList | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState('Could not load meetings');

  const [creating, setCreating] = useState(false);
  const [unifiedTemplateOptions, setUnifiedTemplateOptions] = useState<
    UnifiedMeetingTemplateOption[]
  >(() => buildSystemTemplateOptions());
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [objective, setObjective] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [centerMode, setCenterMode] = useState<'list' | 'create'>('list');
  const [incomingSort, setIncomingSort] =
    useState<MeetingSortKey>(DEFAULT_MEETING_SORT);
  const [completedSort, setCompletedSort] =
    useState<MeetingSortKey>(DEFAULT_MEETING_SORT);

  const queryParams = useMemo(
    () => parseMeetingDiscoveryParams(new URLSearchParams(searchParams.toString())),
    [queryKey],
  );

  const listMeetingsApiParams = useMemo((): MeetingListQueryParams => {
    const { ordering: _ord, ...rest } = queryParams;
    return {
      ...rest,
      ordering: '-created_at',
    };
  }, [queryParams]);

  const listMeetingsFetchKey = useMemo(
    () => JSON.stringify(listMeetingsApiParams),
    [listMeetingsApiParams],
  );

  const [popoverDraft, setPopoverDraft] = usePopoverDraftFromParams(
    queryParams.has_generated_decisions,
    queryParams.has_generated_tasks,
    queryParams.is_archived,
  );

  const replaceDiscoveryParams = useCallback(
    (next: MeetingListQueryParams) => {
      const qs = discoveryParamsToSearchParamsString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router],
  );

  const patchDiscoveryParams = useCallback(
    (patch: Partial<MeetingListQueryParams>, resetPage = true) => {
      const current = parseMeetingDiscoveryParams(
        new URLSearchParams(searchParams.toString()),
      );
      replaceDiscoveryParams(
        mergeMeetingDiscoveryPatch(current, patch, {
          resetPage,
          defaultOrdering: DEFAULT_MEETING_ORDERING,
        }),
      );
    },
    [replaceDiscoveryParams, searchParams],
  );

  useEffect(() => {
    if (!projectId || Number.isNaN(projectId)) {
      setError('Project ID is required');
      setProject(null);
      setAvailableProjects([]);
      setPageLoading(false);
      return;
    }

    const run = async () => {
      try {
        setPageLoading(true);
        setError(null);
        setErrorTitle('Could not load meetings');

        const projects = await ProjectAPI.getProjects();
        setAvailableProjects(projects);
        let current = projects.find((p) => Number(p.id) === projectId) || null;
        if (!current) {
          try {
            current = await ProjectAPI.getProject(projectId);
          } catch {
            current = null;
          }
        }
        setProject(current);

        try {
          const members = await ProjectAPI.getAllProjectMembers(projectId);
          setProjectMembers(members.filter((m) => m.is_active));
        } catch {
          setProjectMembers([]);
        }
      } catch (err: unknown) {
        console.error('Failed to load meetings page:', err);
        setProject(null);
        setAvailableProjects([]);
        setErrorTitle('Could not load meetings');
        setError(formatMeetingsApiError(err, 'Failed to load meetings'));
      } finally {
        setPageLoading(false);
      }
    };

    void run();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || Number.isNaN(projectId)) return;
    void fetchUnifiedMeetingTemplateOptions()
      .then(setUnifiedTemplateOptions)
      .catch((err) => {
        console.error('Failed to load meeting templates for create form:', err);
        setUnifiedTemplateOptions(buildSystemTemplateOptions());
      });
  }, [projectId, centerMode]);

  useEffect(() => {
    if (!projectId || Number.isNaN(projectId)) {
      setListLoading(false);
      setListPage(null);
      return;
    }
    if (pageLoading) return;

    let cancelled = false;
    const run = async () => {
      setListLoading((prev) => prev || listPage === null);
      setListRefreshing(listPage !== null);
      try {
        const data = await MeetingsAPI.listMeetingsPaginated(
          projectId,
          listMeetingsApiParams,
        );
        if (!cancelled) {
          setListPage(data);
          setError(null);
        }
      } catch (meetErr: unknown) {
        if (cancelled) return;
        setListPage(null);
        const status = (meetErr as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setErrorTitle('No access to meetings');
          setError(
            'You are not a member of this project (or your session cannot access it). Open Projects and enter a project you belong to, or ask an admin to add you.',
          );
        } else {
          setErrorTitle('Could not load meetings');
          setError(formatMeetingsApiError(meetErr, 'Failed to load meetings'));
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
          setListRefreshing(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, listMeetingsFetchKey, pageLoading]);

  const refetchList = useCallback(async () => {
    if (!projectId || Number.isNaN(projectId)) return;
    try {
      const data = await MeetingsAPI.listMeetingsPaginated(
        projectId,
        listMeetingsApiParams,
      );
      setListPage(data);
    } catch {
      /* toast elsewhere */
    }
  }, [projectId, listMeetingsApiParams]);

  const handleProjectSelect = (nextProjectIdRaw: string) => {
    const nextProjectId = Number(nextProjectIdRaw);
    if (!Number.isFinite(nextProjectId) || Number.isNaN(nextProjectId)) return;
    if (nextProjectId === projectId) return;
    router.push(`/projects/${nextProjectId}/meetings`);
  };

  const projectsForSelect = useMemo(() => {
    if (!currentUserId) return availableProjects;
    const withOwnerInfo = availableProjects.filter((p) => p.owner?.id != null);
    if (withOwnerInfo.length === 0) return availableProjects;
    return withOwnerInfo.filter((p) => p.owner?.id === currentUserId);
  }, [availableProjects, currentUserId]);

  const memberLabel = useCallback(
    (userId: number) => {
      const m = projectMembers.find((x) => x.user.id === userId);
      if (!m) return `User ${userId}`;
      return (
        m.user.name || m.user.username || m.user.email || `User ${userId}`
      );
    },
    [projectMembers],
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || Number.isNaN(projectId)) {
      toast.error('Project ID is required');
      return;
    }
    if (!title.trim() || !meetingType.trim()) {
      toast.error('Please fill in title and select a template');
      return;
    }

    const templateOpt = unifiedTemplateOptions.find((o) => o.value === meetingType.trim());
    if (!templateOpt) {
      toast.error('Select a valid meeting type or template');
      return;
    }

    const { meeting_type, layout_config } = layoutConfigForNewMeetingFromSelection(templateOpt);
    const objectiveResolved =
      objective.trim() || `${templateOpt.label} meeting`;

    const payload: MeetingCreateRequest = {
      title: title.trim(),
      meeting_type,
      objective: objectiveResolved,
      layout_config,
    };
    if (scheduledDate.trim()) {
      payload.scheduled_date = scheduledDate.trim();
    }
    if (scheduledTime.trim()) {
      payload.scheduled_time = normalizeTimeForApi(scheduledTime);
    }

    setCreating(true);
    try {
      const meeting = await MeetingsAPI.createMeeting(projectId, payload);
      const nested = layout_config.nestedSections ?? [];
      const flatItems = nested.flatMap((s) => s.items);
      if (flatItems.length > 0) {
        try {
          let order = 0;
          for (const section of nested) {
            for (const item of section.items) {
              await MeetingsAPI.createAgendaItem(projectId, meeting.id, {
                content: item.text,
                order_index: order,
                is_priority: item.duration === '10m',
              });
              order += 1;
            }
          }
          const refreshed = await MeetingsAPI.listAgendaItems(projectId, meeting.id);
          const refreshedList = Array.isArray(refreshed) ? refreshed : [];
          let idx = 0;
          const nextNested = nested.map((section) => ({
            ...section,
            items: section.items.map((it) => {
              const agendaItem = refreshedList[idx];
              idx += 1;
              return {
                ...it,
                id: agendaItem ? String(agendaItem.id) : it.id,
              };
            }),
          }));
          await MeetingsAPI.patchMeeting(projectId, meeting.id, {
            layout_config: {
              blocks: layout_config.blocks,
              nestedSections: nextNested,
            },
          });
        } catch (seedErr) {
          console.error('Failed to seed agenda from template:', seedErr);
          toast.error('Meeting created, but the template agenda could not be fully applied.');
        }
      }

      toast.success('Meeting created');
      setTitle('');
      setMeetingType('');
      setObjective('');
      setScheduledDate('');
      setScheduledTime('');
      setCenterMode('list');
      setSelectedMeetingId(null);
      setRightPanelOpen(false);
      await refetchList();
      router.push(`/projects/${projectId}/meetings/${meeting.id}`);
    } catch (err: unknown) {
      console.error('Failed to create meeting:', err);
      toast.error(formatMeetingsApiError(err, 'Failed to create meeting'));
    } finally {
      setCreating(false);
    }
  };

  const rows = listPage?.results ?? [];
  const totalCount = listPage?.count ?? 0;
  const currentPage = queryParams.page ?? 1;

  const { incoming: incomingRaw, completed: completedRaw } = useMemo(
    () => splitMeetingRowsBySchedule(listPage?.results ?? []),
    [listPage],
  );

  const incomingRows = useMemo(
    () => applyMeetingSort(incomingRaw, incomingSort),
    [incomingRaw, incomingSort],
  );
  const completedRows = useMemo(
    () => applyMeetingSort(completedRaw, completedSort),
    [completedRaw, completedSort],
  );

  const thisWeekRange = useMemo(() => getThisWeekDateRange(), []);
  const nextWeekRange = useMemo(() => getNextWeekDateRange(), []);

  const quickIncludeMeActive = useMemo(
    () =>
      currentUserId != null &&
      (queryParams.participant?.includes(currentUserId) ?? false),
    [currentUserId, queryParams.participant],
  );
  const quickThisWeekActive = useMemo(
    () =>
      queryParams.date_from === thisWeekRange.date_from &&
      queryParams.date_to === thisWeekRange.date_to,
    [queryParams.date_from, queryParams.date_to, thisWeekRange],
  );
  const quickNextWeekActive = useMemo(
    () =>
      queryParams.date_from === nextWeekRange.date_from &&
      queryParams.date_to === nextWeekRange.date_to,
    [queryParams.date_from, queryParams.date_to, nextWeekRange],
  );
  const quickHasGenDecisionsActive = queryParams.has_generated_decisions === true;
  const quickHasGenTasksActive = queryParams.has_generated_tasks === true;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /** Lane badge: A/B from API only — never use `incomingRows.length` (page slice). */
  const incomingLaneTotal = listPage?.incomingLaneTotal;
  const incomingResultCount = listPage?.incomingResultCount;
  const completedLaneTotal = listPage?.completedLaneTotal;
  const completedResultCount = listPage?.completedResultCount;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.log('lane props source', {
      incomingResultCount,
      incomingLaneTotal,
      completedResultCount,
      completedLaneTotal,
    });
    console.log('meeting lane counts', {
      incomingLaneTotal,
      incomingResultCount,
      completedLaneTotal,
      completedResultCount,
      incomingMeetingsLength: incomingRows.length,
      completedMeetingsLength: completedRows.length,
    });
  }, [
    listPage,
    incomingLaneTotal,
    incomingResultCount,
    completedLaneTotal,
    completedResultCount,
    incomingRows.length,
    completedRows.length,
  ]);

  useEffect(() => {
    if (selectedMeetingId == null) return;
    const results = listPage?.results ?? [];
    if (!results.some((m) => m.id === selectedMeetingId)) {
      setSelectedMeetingId(null);
      setRightPanelOpen(false);
    }
  }, [listPage, selectedMeetingId]);

  const chips: FilterChip[] = useMemo(() => {
    const out: FilterChip[] = [];
    if (queryParams.q?.trim()) {
      out.push({
        id: 'q',
        label: `Search: ${queryParams.q.trim()}`,
        onRemove: () => patchDiscoveryParams({ q: undefined }, true),
      });
    }
    if (queryParams.tag) {
      out.push({
        id: 'tag',
        label: `Tags: ${queryParams.tag}`,
        onRemove: () => patchDiscoveryParams({ tag: undefined }, true),
      });
    }
    if (queryParams.participant?.length) {
      const names = queryParams.participant.map((id) => memberLabel(id));
      out.push({
        id: 'participant',
        label:
          names.length <= 2
            ? `Includes: ${names.join(', ')}`
            : `Includes: ${names.length} people`,
        onRemove: () => patchDiscoveryParams({ participant: undefined }, true),
      });
    }
    if (queryParams.exclude_participant?.length) {
      const names = queryParams.exclude_participant.map((id) => memberLabel(id));
      out.push({
        id: 'exclude_participant',
        label:
          names.length <= 2
            ? `Excludes: ${names.join(', ')}`
            : `Excludes: ${names.length} people`,
        onRemove: () =>
          patchDiscoveryParams({ exclude_participant: undefined }, true),
      });
    }
    if (queryParams.date_from) {
      out.push({
        id: 'df',
        label: `From ${queryParams.date_from}`,
        onRemove: () => patchDiscoveryParams({ date_from: undefined }, true),
      });
    }
    if (queryParams.date_to) {
      out.push({
        id: 'dt',
        label: `To ${queryParams.date_to}`,
        onRemove: () => patchDiscoveryParams({ date_to: undefined }, true),
      });
    }
    if (queryParams.is_archived === true) {
      out.push({
        id: 'arch',
        label: 'Archived only',
        onRemove: () => patchDiscoveryParams({ is_archived: undefined }, true),
      });
    }
    if (queryParams.is_archived === false) {
      out.push({
        id: 'active',
        label: 'Active only',
        onRemove: () => patchDiscoveryParams({ is_archived: undefined }, true),
      });
    }
    if (queryParams.has_generated_decisions === true) {
      out.push({
        id: 'hgd',
        label: 'Generated decisions: has any',
        onRemove: () =>
          patchDiscoveryParams({ has_generated_decisions: undefined }, true),
      });
    }
    if (queryParams.has_generated_decisions === false) {
      out.push({
        id: 'hgd0',
        label: 'Generated decisions: has none',
        onRemove: () =>
          patchDiscoveryParams({ has_generated_decisions: undefined }, true),
      });
    }
    if (queryParams.has_generated_tasks === true) {
      out.push({
        id: 'hgt',
        label: 'Generated tasks: has any',
        onRemove: () =>
          patchDiscoveryParams({ has_generated_tasks: undefined }, true),
      });
    }
    if (queryParams.has_generated_tasks === false) {
      out.push({
        id: 'hgt0',
        label: 'Generated tasks: has none',
        onRemove: () =>
          patchDiscoveryParams({ has_generated_tasks: undefined }, true),
      });
    }
    return out;
  }, [queryParams, patchDiscoveryParams, memberLabel]);

  const canClear =
    hasActiveDiscoveryFilters(queryParams) ||
    (queryParams.page != null && queryParams.page > 1);

  const clearAllFilters = () => {
    router.replace(pathname);
  };

  const onQuickIncludeMe = useCallback(() => {
    if (!currentUserId) return;
    const cur = queryParams.participant ?? [];
    if (quickIncludeMeActive) {
      const next = cur.filter((id) => id !== currentUserId);
      patchDiscoveryParams(
        { participant: next.length ? next : undefined },
        true,
      );
    } else {
      patchDiscoveryParams(
        { participant: [...new Set([...cur, currentUserId])] },
        true,
      );
    }
  }, [currentUserId, quickIncludeMeActive, patchDiscoveryParams, queryParams.participant]);

  const onQuickThisWeek = useCallback(() => {
    if (quickThisWeekActive) {
      patchDiscoveryParams({ date_from: undefined, date_to: undefined }, true);
    } else {
      patchDiscoveryParams(
        {
          date_from: thisWeekRange.date_from,
          date_to: thisWeekRange.date_to,
        },
        true,
      );
    }
  }, [quickThisWeekActive, patchDiscoveryParams, thisWeekRange]);

  const onQuickNextWeek = useCallback(() => {
    if (quickNextWeekActive) {
      patchDiscoveryParams({ date_from: undefined, date_to: undefined }, true);
    } else {
      patchDiscoveryParams(
        {
          date_from: nextWeekRange.date_from,
          date_to: nextWeekRange.date_to,
        },
        true,
      );
    }
  }, [quickNextWeekActive, patchDiscoveryParams, nextWeekRange]);

  const onQuickHasGenDecisions = useCallback(() => {
    patchDiscoveryParams(
      {
        has_generated_decisions:
          queryParams.has_generated_decisions === true ? undefined : true,
      },
      true,
    );
  }, [queryParams.has_generated_decisions, patchDiscoveryParams]);

  const onQuickHasGenTasks = useCallback(() => {
    patchDiscoveryParams(
      {
        has_generated_tasks:
          queryParams.has_generated_tasks === true ? undefined : true,
      },
      true,
    );
  }, [queryParams.has_generated_tasks, patchDiscoveryParams]);

  const onMeetingTypeSlugsChange = useCallback(
    (slugs: string[]) => {
      patchDiscoveryParams(
        { meeting_type: slugs.length ? slugs : undefined },
        true,
      );
    },
    [patchDiscoveryParams],
  );

  const onAdvancedFiltersApply = useCallback(
    (payload: {
      discovery: Partial<MeetingListQueryParams>;
      popoverDraft: MeetingFilterPopoverDraft;
    }) => {
      patchDiscoveryParams(
        {
          ...payload.discovery,
          ...patchFromPopoverDraft(payload.popoverDraft),
        },
        true,
      );
    },
    [patchDiscoveryParams],
  );

  const onPopoverCancel = useCallback(() => {
    setPopoverDraft(
      popoverDraftFromQuery(
        queryParams.has_generated_decisions,
        queryParams.has_generated_tasks,
        queryParams.is_archived,
      ),
    );
  }, [
    queryParams.has_generated_decisions,
    queryParams.has_generated_tasks,
    queryParams.is_archived,
  ]);

  const projectName = project?.name ?? `Project ${projectIdParam ?? ''}`;

  const discoveryBlock =
    centerMode === 'list' && !pageLoading && !error ? (
      <div className="mb-6 space-y-3" data-meeting-discovery>
        <MeetingDiscoveryToolbar
          qValue={queryParams.q ?? ''}
          onQDebouncedChange={(q) =>
            patchDiscoveryParams({ q: q?.trim() || undefined }, true)
          }
          searchDisabled={!!error}
          searchLoading={listRefreshing && !listLoading}
          filterBadgeCount={activeMeetingDiscoveryFilterCount(queryParams)}
          selectedMeetingTypeSlugs={queryParams.meeting_type ?? []}
          onMeetingTypeSlugsChange={onMeetingTypeSlugsChange}
          tagSlug={queryParams.tag ?? ''}
          participant={queryParams.participant}
          excludeParticipant={queryParams.exclude_participant}
          dateFrom={queryParams.date_from}
          dateTo={queryParams.date_to}
          members={projectMembers}
          memberLabel={memberLabel}
          currentUserId={currentUserId}
          popoverDraft={popoverDraft}
          onAdvancedFiltersApply={onAdvancedFiltersApply}
          onPopoverCancel={onPopoverCancel}
          quickIncludeMeActive={quickIncludeMeActive}
          quickThisWeekActive={quickThisWeekActive}
          quickNextWeekActive={quickNextWeekActive}
          quickHasGenDecisionsActive={quickHasGenDecisionsActive}
          quickHasGenTasksActive={quickHasGenTasksActive}
          onQuickIncludeMe={onQuickIncludeMe}
          onQuickThisWeek={onQuickThisWeek}
          onQuickNextWeek={onQuickNextWeek}
          onQuickHasGenDecisions={onQuickHasGenDecisions}
          onQuickHasGenTasks={onQuickHasGenTasks}
          onClearAll={clearAllFilters}
          canClear={canClear}
          disabled={!!error}
        />
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Active filters">
            {chips.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {c.label}
                <button
                  type="button"
                  onClick={c.onRemove}
                  className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  aria-label={`Remove filter ${c.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  const emptyFiltered =
    !listLoading &&
    totalCount === 0 &&
    hasActiveDiscoveryFilters(queryParams);

  return (
    <ProtectedRoute>
      <Layout mainScrollMode="page">
        <div className="flex min-h-[calc(100vh-7rem)] w-full flex-col">
          <MeetingsWorkspaceShell detailOpen={false} detail={null} sidebar={null} main={
              <div className="px-4 py-5 lg:px-8">
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      Meetings
                    </h1>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor="meetings-project-select">
                        Project
                      </label>
                      <select
                        id="meetings-project-select"
                        value={
                          Number.isFinite(projectId) &&
                          projectsForSelect.some((p) => p.id === projectId)
                            ? String(projectId)
                            : ''
                        }
                        disabled={pageLoading || projectsForSelect.length === 0}
                        onChange={(e) => handleProjectSelect(e.target.value)}
                        className="h-9 min-w-[10rem] max-w-[min(100%,20rem)] rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                        aria-label="Select project for meetings"
                      >
                        {projectsForSelect.length > 0 ? (
                          projectsForSelect.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            {projectName || 'Loading…'}
                          </option>
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setCenterMode('create');
                          setRightPanelOpen(false);
                          setSelectedMeetingId(null);
                        }}
                        className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>

                {!pageLoading && error ? (
                  <div
                    className="mb-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
                    role="alert"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">{errorTitle}</p>
                        <p className="mt-1 text-sm text-red-700">{error}</p>
                        <Link
                          href="/projects"
                          className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                        >
                          Go to Projects
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                {pageLoading ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <p className="mt-3 font-medium text-slate-900">Loading…</p>
                  </div>
                ) : null}

                {discoveryBlock}

                {centerMode === 'create' ? (
                  <form
                    onSubmit={handleCreate}
                    className="mx-auto max-w-2xl rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm sm:p-8"
                  >
                    <fieldset
                      disabled={!pageLoading && !!error}
                      className={`min-w-0 border-0 p-0 ${!pageLoading && error ? 'opacity-60' : ''}`}
                    >
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                          New meeting
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Add the basics now — you can invite people and add links after saving.
                        </p>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Title
                          </label>
                          <input
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Weekly Planning"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Meeting type
                          </label>
                          <select
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                            value={meetingType}
                            onChange={(e) => setMeetingType(e.target.value)}
                            aria-label="Meeting type"
                          >
                            <option value="">Select meeting type…</option>
                            {unifiedTemplateOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                                {!opt.is_system ? ' (saved)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Objective
                          </label>
                          <textarea
                            rows={4}
                            className="min-h-[120px] w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-base leading-relaxed text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            placeholder="What do you want to achieve in this meeting?"
                          />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            Schedule
                          </p>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Date &amp; time
                          </label>
                          <MeetingDateTimePicker
                            id="meeting-create-scheduled"
                            variant="comfortable"
                            dateValue={scheduledDate}
                            timeValue={scheduledTime}
                            disabled={creating}
                            onChange={(d, t) => {
                              setScheduledDate(d);
                              setScheduledTime(t);
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-8 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          disabled={creating}
                          onClick={() => setCenterMode('list')}
                          className="inline-flex min-h-[44px] min-w-[100px] items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={creating}
                          className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                        >
                          {creating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    </fieldset>
                  </form>
                ) : listLoading && rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-14">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      Loading meetings…
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-6">
                      <MeetingsLane
                        title="Incoming meetings"
                        headingId="meetings-incoming-heading"
                        sortValue={incomingSort}
                        onSortChange={setIncomingSort}
                        sortAriaContext="incoming meetings"
                        resultCount={incomingResultCount}
                        totalCount={incomingLaneTotal}
                        loading={listLoading}
                        disabled={!!error}
                      >
                        <MeetingResultsTable
                          variant="lane"
                          rows={incomingRows}
                          loading={listLoading}
                          selectedId={selectedMeetingId}
                          onSelect={(id) => {
                            setSelectedMeetingId(id);
                            setRightPanelOpen(true);
                          }}
                          memberLabel={memberLabel}
                          projectId={Number.isFinite(projectId) ? projectId : undefined}
                          count={incomingRows.length}
                          page={1}
                          pageSize={Math.max(1, incomingRows.length || 1)}
                          onPageChange={() => {}}
                          hidePagination
                          emptyTitle="No incoming meetings on this page"
                          emptySubtitle={
                            emptyFiltered
                              ? 'Try clearing filters or broadening your search.'
                              : totalCount === 0
                                ? 'Use Create in the header to add your first meeting.'
                                : 'Try another page or adjust filters — past meetings appear in Completed.'
                          }
                        />
                      </MeetingsLane>

                      <MeetingsLane
                        title="Completed meetings"
                        headingId="meetings-completed-heading"
                        sortValue={completedSort}
                        onSortChange={setCompletedSort}
                        sortAriaContext="completed meetings"
                        resultCount={completedResultCount}
                        totalCount={completedLaneTotal}
                        loading={listLoading}
                        disabled={!!error}
                      >
                        <MeetingResultsTable
                          variant="lane"
                          rows={completedRows}
                          loading={listLoading}
                          selectedId={selectedMeetingId}
                          onSelect={(id) => {
                            setSelectedMeetingId(id);
                            setRightPanelOpen(true);
                          }}
                          memberLabel={memberLabel}
                          projectId={Number.isFinite(projectId) ? projectId : undefined}
                          count={completedRows.length}
                          page={1}
                          pageSize={Math.max(1, completedRows.length || 1)}
                          onPageChange={() => {}}
                          hidePagination
                          emptyTitle="No completed meetings on this page"
                          emptySubtitle={
                            emptyFiltered
                              ? 'Try clearing filters or broadening your search.'
                              : 'Meetings with a scheduled day before today appear here.'
                          }
                        />
                      </MeetingsLane>
                    </div>

                    {totalPages > 1 ? (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() =>
                            patchDiscoveryParams(
                              { page: currentPage - 1 },
                              false,
                            )
                          }
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span className="text-sm text-slate-600">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() =>
                            patchDiscoveryParams(
                              { page: currentPage + 1 },
                              false,
                            )
                          }
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            }
          />
          <Dialog
            open={
              centerMode === 'list' &&
              selectedMeetingId != null &&
              rightPanelOpen &&
              Number.isFinite(projectId) &&
              !Number.isNaN(projectId)
            }
            onOpenChange={(open) => {
              if (!open) setRightPanelOpen(false);
            }}
          >
            <DialogContent
              hideCloseButton
              className="flex h-[min(90vh,900px)] max-h-[min(90vh,900px)] w-[min(100vw-2rem,56rem)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:rounded-lg"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">Meeting details</DialogTitle>
              {centerMode === 'list' &&
              selectedMeetingId != null &&
              Number.isFinite(projectId) &&
              !Number.isNaN(projectId) ? (
                <MeetingSummaryPanel
                  key={selectedMeetingId}
                  projectId={projectId}
                  meetingId={selectedMeetingId}
                  onClose={() => setRightPanelOpen(false)}
                  onMeetingUpdated={(_meeting) => {
                    void refetchList();
                  }}
                  onMeetingDeleted={() => {
                    setSelectedMeetingId(null);
                    setRightPanelOpen(false);
                    void refetchList();
                  }}
                />
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

export default function ProjectMeetingsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <Layout mainScrollMode="page">
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </Layout>
        </ProtectedRoute>
      }
    >
      <MeetingsPageInner />
    </Suspense>
  );
}
