"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Layout from "@/components/layout/Layout";
import useAuth from "@/hooks/useAuth";
import { useTaskData } from "@/hooks/useTaskData";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useBudgetPoolData } from "@/hooks/useBudgetPoolData";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AssetAPI } from "@/lib/api/assetApi";
import toast from "react-hot-toast";
import { TaskAPI } from "@/lib/api/taskApi";
import { BudgetAPI } from "@/lib/api/budgetApi";
import { RetrospectiveAPI } from "@/lib/api/retrospectiveApi";
import { ClientCommunicationAPI } from "@/lib/api/clientCommunicationApi";
import { DashboardAPI } from "@/lib/api/dashboardApi";
import Modal from "@/components/ui/Modal";
import { DecorativeGlow } from "@/components/ui/decorative-glow";
import { Skeleton } from "@/components/ui/skeleton";
import NewTaskForm from "@/components/tasks/NewTaskForm";
import TaskCreatePanel from "@/components/tasks/TaskCreatePanel";
import NewBudgetRequestForm from "@/components/tasks/NewBudgetRequestForm";
import NewAssetForm from "@/components/tasks/NewAssetForm";
import NewRetrospectiveForm from "@/components/tasks/NewRetrospectiveForm";
import { ScalingPlanForm } from "@/components/tasks/ScalingPlanForm";
import NewClientCommunicationForm from "@/components/tasks/NewClientCommunicationForm";
import AlertTaskForm from "@/components/tasks/AlertTaskForm";
import { OptimizationScalingAPI } from "@/lib/api/optimizationScalingApi";
import { ExperimentForm } from "@/components/tasks/ExperimentForm";
import { ExperimentAPI } from "@/lib/api/experimentApi";
import { AlertingAPI } from "@/lib/api/alertingApi";
import { OptimizationAPI } from "@/lib/api/optimizationApi";
import { OptimizationForm } from "@/components/tasks/OptimizationForm";
import { ReportForm } from "@/components/tasks/ReportForm";
import { ReportAPI } from "@/lib/api/reportApi";
import NewPlatformPolicyUpdateForm from "@/components/tasks/NewPlatformPolicyUpdateForm";
import { PolicyAPI } from "@/lib/api/policyApi";
import NewBudgetPool from "@/components/budget/NewBudgetPool";
import BudgetPoolList from "@/components/budget/BudgetPoolList";
// import { mockTasks } from "../../mock/mockTasks";
import { ProjectAPI } from "@/lib/api/projectApi";
import { MeetingsAPI } from "@/lib/api/meetingsApi";
import JiraBoardView from "@/components/jira-ticket/JiraBoardView";
import JiraSummaryView from "@/components/jira-ticket/JiraSummaryView";
import JiraTasksView from "@/components/jira-ticket/JiraTasksView";
import TimelineViewComponent from "@/components/tasks/timeline/TimelineView";
import {
  TASK_TYPE_CONFIG_STATIC,
  defaultReportContext,
} from "@/lib/taskTypeConfigRegistry";
import { useTaskFilterParams } from "@/hooks/useTaskFilterParams";
import { TaskFilterPanel } from "@/components/tasks/TaskFilterPanel";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";

const BOARD_TYPE_ORDER = [
  "task",
  "budget",
  "asset",
  "retrospective",
  "report",
  "scaling",
  "alert",
  "experiment",
  "optimization",
  "communication",
  "platform_policy_update",
];

const BOARD_TYPE_META = {
  task: {
    title: "Tasks",
    empty: "No tasks",
    icon: "task",
  },
  budget: {
    title: "Budget Requests",
    empty: "No budget requests",
    icon: "task",
  },
  asset: {
    title: "Assets",
    empty: "No asset tasks",
    icon: "task",
  },
  retrospective: {
    title: "Retrospectives",
    empty: "No retrospectives",
    icon: "story",
  },
  report: {
    title: "Reports",
    empty: "No report tasks",
    icon: "task",
  },
  scaling: {
    title: "Scaling",
    empty: "No scaling tasks",
    icon: "story",
  },
  alert: {
    title: "Alerts",
    empty: "No alert tasks",
    icon: "bug",
  },
  experiment: {
    title: "Experiments",
    empty: "No experiment tasks",
    icon: "story",
  },
  optimization: {
    title: "Optimizations",
    empty: "No optimization tasks",
    icon: "story",
  },
  communication: {
    title: "Communications",
    empty: "No communication tasks",
    icon: "task",
  },
  platform_policy_update: {
    title: "Platform Policy Update",
    empty: "No platform policy update tasks",
    icon: "task",
  },
};

/** Types that support create-modal prefill from a board column — mirrors TASK_TYPE_CONFIG_STATIC. */
const VALID_BOARD_WORK_TYPES = Object.keys(TASK_TYPE_CONFIG_STATIC);

const normalizeBoardTypeKey = (value) => {
  if (typeof value !== "string") return "task";
  const normalized = value.trim().toLowerCase();
  return normalized || "task";
};

const formatBoardTypeLabel = (value) => {
  const normalized = normalizeBoardTypeKey(value);
  return normalized
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const getBoardColumnMeta = (typeKey) => {
  const normalized = normalizeBoardTypeKey(typeKey);
  const known = BOARD_TYPE_META[normalized];
  if (known) {
    return {
      key: normalized,
      title: known.title,
      empty: known.empty,
    };
  }
  const label = formatBoardTypeLabel(normalized);
  return {
    key: normalized,
    title: label,
    empty: `No ${label.toLowerCase()} tasks`,
  };
};

function TasksPageContent() {
  const { user, loading: userLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Get project_id from search params
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("project_id");
  const projectId = projectIdParam ? Number(projectIdParam) : null;

  // URL-backed filters (including project_id, status, priority, dates, etc.)
  const [filters, setFilters, clearFilters] = useTaskFilterParams();
  const [taskTypeOptions, setTaskTypeOptions] = useState([]);
  const authBootLoading = useMinimumLoading(userLoading);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await TaskAPI.getTaskTypes();
        setTaskTypeOptions(Array.isArray(types) ? types : []);
      } catch {
        setTaskTypeOptions([]);
      }
    };
    loadTypes();
  }, []);

  // Task data management
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    fetchTasks,
    createTask,
    updateTask,
    reloadTasks,
  } = useTaskData();

  // Budget pool data management
  const {
    createBudgetPool,
    loading: budgetPoolLoading,
    error: budgetPoolError,
    fetchBudgetPools,
  } = useBudgetPoolData();

  // Trigger to refresh budget pools list in NewBudgetRequestForm
  const [budgetPoolRefreshTrigger, setBudgetPoolRefreshTrigger] = useState(0);
  const delayedTasksLoading = useMinimumLoading(tasksLoading);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalExpanded, setCreateModalExpanded] = useState(false);
  /** When creating from a meeting deep link (`?create=1&origin_meeting_id=`). */
  const [createOriginMeetingId, setCreateOriginMeetingId] = useState(null);
  const [createOriginMeetingLabel, setCreateOriginMeetingLabel] =
    useState(null);
  const [draftEditingTaskId, setDraftEditingTaskId] = useState(null);
  /** Avoid re-applying meeting create deep link when only `view` etc. changes in the URL. */
  const lastMeetingDeepLinkKeyRef = useRef("");
  const [createBudgetPoolModalOpen, setCreateBudgetPoolModalOpen] =
    useState(false);
  const [manageBudgetPoolsModalOpen, setManageBudgetPoolsModalOpen] =
    useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false);
  const [projectOptionsError, setProjectOptionsError] = useState(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [recentProjectIds, setRecentProjectIds] = useState([]);
  const [pinnedProjectIds, setPinnedProjectIds] = useState([]);

  const getDefaultTaskDates = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return {
      start_date: today.toISOString().slice(0, 10),
      due_date: tomorrow.toISOString().slice(0, 10),
    };
  };

  const [taskData, setTaskData] = useState({
    project_id: null,
    type: "",
    summary: "",
    description: "",
    current_approver_id: null,
    ...getDefaultTaskDates(),
  });
  const [budgetData, setBudgetData] = useState({
    amount: "",
    currency: "",
    ad_channel: null,
    notes: "",
    budget_pool: null,
  });
  const [budgetPoolData, setBudgetPoolData] = useState({
    project: null,
    ad_channel: null,
    total_amount: "",
    currency: "",
  });
  const [assetData, setAssetData] = useState({
    tags: "",
    team: "",
    notes: "",
    file: null,
  });
  const [retrospectiveData, setRetrospectiveData] = useState({});
  const [scalingPlanData, setScalingPlanData] = useState({});
  const [alertData, setAlertData] = useState({
    alert_type: "spend_spike",
    severity: "medium",
    status: "open",
    metric_key: "spend",
    change_type: "percent",
    change_value: "",
    change_window: "daily",
    current_value: "",
    previous_value: "",
    affected_entities: [],
    assigned_to: "",
    acknowledged_by: "",
    investigation_notes: "",
    resolution_steps: "",
    related_references: [],
    postmortem_root_cause: "",
    postmortem_prevention: "",
  });
  const [experimentData, setExperimentData] = useState({});
  const [optimizationData, setOptimizationData] = useState({});

  const [communicationData, setCommunicationData] = useState({
    communication_type: "",
    stakeholders: "",
    impacted_areas: [],
    required_actions: "",
    client_deadline: null,
    notes: "",
  });
  const [policyData, setPolicyData] = useState({});

  const [reportData, setReportData] = useState({
    audience_type: "client",
    audience_details: "",
    context: defaultReportContext,
    outcome_summary: "",
    narrative_explanation: "",
    key_actions: [],
  });

  const loadProjectOptions = useCallback(async () => {
    try {
      setProjectOptionsLoading(true);
      setProjectOptionsError(null);
      const projects = await ProjectAPI.getProjects();
      setProjectOptions(projects || []);
    } catch (error) {
      setProjectOptionsError("Failed to load projects.");
    } finally {
      setProjectOptionsLoading(false);
    }
  }, []);

  const handlePickProject = (selectedProjectId) => {
    if (!selectedProjectId) return;
    setRecentProjectIds((prev) => {
      const next = [
        selectedProjectId,
        ...prev.filter((id) => id !== selectedProjectId),
      ].slice(0, 5);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("recentProjectIds", JSON.stringify(next));
      }
      return next;
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set("project_id", String(selectedProjectId));
    router.push(`${pathname}?${params.toString()}`);
  };

  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return projectOptions;
    const query = projectSearchQuery.trim().toLowerCase();
    return projectOptions.filter((project) => {
      const name = (project.name || "").toLowerCase();
      const idText = project.id ? String(project.id) : "";
      return name.includes(query) || idText.includes(query);
    });
  }, [projectOptions, projectSearchQuery]);

  const pinnedProjects = useMemo(() => {
    if (!pinnedProjectIds.length) return [];
    const byId = new Map(
      filteredProjects
        .filter((project) => project?.id)
        .map((project) => [project.id, project]),
    );
    return pinnedProjectIds.map((id) => byId.get(id)).filter(Boolean);
  }, [filteredProjects, pinnedProjectIds]);

  const recentProjects = useMemo(() => {
    if (!recentProjectIds.length) return [];
    const byId = new Map(
      filteredProjects
        .filter((project) => project?.id)
        .map((project) => [project.id, project]),
    );
    return recentProjectIds
      .map((id) => byId.get(id))
      .filter((project) => project && !pinnedProjectIds.includes(project.id));
  }, [filteredProjects, recentProjectIds, pinnedProjectIds]);

  const otherProjects = useMemo(() => {
    const recentSet = new Set(recentProjectIds);
    const pinnedSet = new Set(pinnedProjectIds);
    return filteredProjects.filter(
      (project) => !recentSet.has(project?.id) && !pinnedSet.has(project?.id),
    );
  }, [filteredProjects, recentProjectIds, pinnedProjectIds]);

  // Toggle this to switch between mock and real backend
  const USE_MOCK_FALLBACK = false; // false = no fallback for testing

  // Smart fallback logic - use mock data for demo if enabled
  const tasksWithFallback = projectId
    ? USE_MOCK_FALLBACK
      ? Array.isArray(tasks) && tasks.length > 0
        ? tasks
        : []
      : Array.isArray(tasks)
      ? tasks
      : []
    : [];

  const parentTasksOnly = useMemo(() => {
    return tasksWithFallback.filter((task) => {
      // Exclude tasks that are subtasks (check is_subtask field)
      return !task.is_subtask;
    });
  }, [tasksWithFallback]);

  const [taskType, setTaskType] = useState("");
  const [contentType, setContentType] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitGuard = useRef(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingSummary, setEditingSummary] = useState("");
  const [boardData, setBoardData] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState(null);
  const delayedBoardLoading = useMinimumLoading(boardLoading);
  const [isBoardRecentExpanded, setIsBoardRecentExpanded] = useState(false);

  // View mode: 'broad' | 'list'
  const [viewMode, setViewMode] = useState("broad");
  const hasInitializedViewMode = useRef(false);
  const [loadedBoardProjectId, setLoadedBoardProjectId] = useState(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  const taskFetchKey = useMemo(
    () =>
      JSON.stringify({
        ...filters,
        project_id: projectId ?? filters.project_id,
      }),
    [filters, projectId],
  );

  const taskFetchRequest = useMemo(
    () => JSON.parse(taskFetchKey),
    [taskFetchKey],
  );

  useEffect(() => {
    if (hasInitializedViewMode.current) return;
    const fromQuery = searchParams.get("view");
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("tasksViewMode")
        : null;
    const validModes = ["broad", "list", "timeline"];
    const initialMode = validModes.includes(fromQuery)
      ? fromQuery
      : validModes.includes(stored)
      ? stored
      : "broad";
    setViewMode(initialMode);
    hasInitializedViewMode.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!hasInitializedViewMode.current) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tasksViewMode", viewMode);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", viewMode);
    router.replace(`${pathname}?${params.toString()}`);
  }, [viewMode, router, searchParams, pathname]);

  // When the project_id in the URL changes, fetch the tasks list according to it
  useEffect(() => {
    if (userLoading) return;
    if (projectOptions.length === 0 && !projectOptionsLoading) {
      loadProjectOptions();
    }
  }, [userLoading, projectOptions.length, projectOptionsLoading, loadProjectOptions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("recentProjectIds");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentProjectIds(parsed.filter((id) => Number.isFinite(id)));
      }
    } catch (error) {
      // ignore parse error
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("pinnedProjectIds");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setPinnedProjectIds(parsed.filter((id) => Number.isFinite(id)));
      }
    } catch (error) {
      // ignore parse error
    }
  }, []);

  const togglePinProject = (projectIdValue) => {
    if (!projectIdValue) return;
    setPinnedProjectIds((prev) => {
      const next = prev.includes(projectIdValue)
        ? prev.filter((id) => id !== projectIdValue)
        : [projectIdValue, ...prev].slice(0, 8);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pinnedProjectIds", JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (userLoading) return;
    if (!projectId) return;
    const loadTasks = async () => {
      try {
        await fetchTasks(taskFetchRequest);
      } catch (error) {
        // error is handled in useTaskData
      }
    };

    loadTasks();
  }, [userLoading, projectId, fetchTasks, taskFetchKey, taskFetchRequest]);

  const selectedProject = useMemo(() => {
    if (!projectId) return null;
    return projectOptions.find((project) => project.id === projectId) || null;
  }, [projectId, projectOptions]);

  const fetchBoardData = useCallback(async () => {
    if (userLoading) return;
    if (!projectId) {
      setBoardData(null);
      setLoadedBoardProjectId(null);
      setBoardError("Project summary requires a project.");
      return;
    }

    try {
      setBoardLoading(true);
      setBoardError(null);
      const response = await DashboardAPI.getSummary({ project_id: projectId });
      if (!response.data) {
        throw new Error("No data received from server");
      }
      setBoardData(response.data);
      setLoadedBoardProjectId(projectId);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to load board data";
      setBoardError(message);
      toast.error(message);
    } finally {
      setBoardLoading(false);
    }
  }, [userLoading, projectId]);

  useEffect(() => {
    setBoardData(null);
    setBoardError(null);
    setLoadedBoardProjectId(null);
  }, [projectId]);

  useEffect(() => {
    if (userLoading) return;
    if (activeTab !== "summary") return;
    fetchBoardData();
  }, [userLoading, activeTab, fetchBoardData]);

  const handleTabChange = useCallback(
    (nextTab) => {
      if (
        nextTab === "summary" &&
        projectId &&
        loadedBoardProjectId !== projectId
      ) {
        setBoardLoading(true);
      }
      setActiveTab(nextTab);
    },
    [loadedBoardProjectId, projectId],
  );

  // Ensure that the project_id in the form defaults to the project_id in the URL when creating a new task
  useEffect(() => {
    if (!projectId) return;

    setTaskData((prev) => ({
      ...prev,
      // If the user has already manually selected the project_id, don't overwrite it; otherwise use the project_id in the URL
      project_id: prev.project_id || projectId,
    }));
  }, [projectId]);

  // Form validation rules
  const taskValidationRules = {
    project_id: (value) => (!value || value == 0 ? "Project is required" : ""),
    type: (value) => (!value ? "Work type is required" : ""),
    summary: (value) => (!value ? "Task summary is required" : ""),
    // Only require approver when type is 'budget'
    current_approver_id: () => "",
    // Require dates when type is 'experiment'
    start_date: (value) =>
      taskData.type === "experiment" && !value
        ? "Start date is required for experiment tasks"
        : "",
    due_date: (value) =>
      taskData.type === "experiment" && !value
        ? "Due date is required for experiment tasks"
        : "",
  };

  const budgetValidationRules = {};

  const budgetPoolValidationRules = {
    project: (value) => (!value || value === 0 ? "Project is required" : ""),
    ad_channel: (value) =>
      !value || value === 0 ? "Advertising channel is required" : "",
    total_amount: (value) => {
      if (!value || value.trim() === "") return "Total amount is required";
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0)
        return "Total amount must be a positive number";
      return "";
    },
    currency: (value) => {
      if (!value || value.trim() === "") return "Currency is required";
      if (value.length !== 3)
        return "Currency must be 3 characters (e.g., AUD, USD)";
      return "";
    },
  };

  // TODO: Add validation rules for asset
  const assetValidationRules = {};
  const retrospectiveValidationRules = {};

  const alertValidationRules = {
    alert_type: (value) => (!value ? "Alert type is required" : ""),
    severity: (value) => (!value ? "Severity is required" : ""),
  };

  const experimentValidationRules = {};

  const communicationValidationRules = {};

  const policyValidationRules = {};

  // Initialize validation hooks
  const taskValidation = useFormValidation(taskValidationRules);
  const budgetValidation = useFormValidation(budgetValidationRules);
  const budgetPoolValidation = useFormValidation(budgetPoolValidationRules);
  const assetValidation = useFormValidation(assetValidationRules);
  const retrospectiveValidation = useFormValidation(
    retrospectiveValidationRules,
  );
  const alertValidation = useFormValidation(alertValidationRules);
  const experimentValidation = useFormValidation(experimentValidationRules);
  const communicationValidation = useFormValidation(
    communicationValidationRules,
  );
  const policyValidation = useFormValidation(policyValidationRules);

  // Task type configuration from shared registry; pages wire in local form state and validation
  const taskTypeConfig = useMemo(() => {
    const formStateByType = {
      budget: { formData: budgetData, setFormData: setBudgetData, validation: budgetValidation },
      asset: { formData: assetData, setFormData: setAssetData, validation: assetValidation },
      retrospective: {
        formData: retrospectiveData,
        setFormData: setRetrospectiveData,
        validation: retrospectiveValidation,
      },
      scaling: {
        formData: scalingPlanData,
        setFormData: setScalingPlanData,
        validation: null,
      },
      alert: { formData: alertData, setFormData: setAlertData, validation: alertValidation },
      communication: {
        formData: communicationData,
        setFormData: setCommunicationData,
        validation: communicationValidation,
      },
      experiment: {
        formData: experimentData,
        setFormData: setExperimentData,
        validation: experimentValidation,
      },
      optimization: {
        formData: optimizationData,
        setFormData: setOptimizationData,
        validation: null,
      },
      report: {
        formData: reportData,
        setFormData: setReportData,
        validation: null,
      },
      platform_policy_update: {
        formData: policyData,
        setFormData: setPolicyData,
        validation: policyValidation,
      },
    };
    const config = {};
    for (const [key, staticConfig] of Object.entries(TASK_TYPE_CONFIG_STATIC)) {
      const { formData, setFormData, validation } = formStateByType[key] || {};
      config[key] = {
        ...staticConfig,
        formData,
        setFormData,
        validation: validation ?? null,
        getPayload: (createdTask) =>
          staticConfig.getPayload(formData, taskData, createdTask),
      };
    }
    return config;
  }, [
    budgetData,
    assetData,
    retrospectiveData,
    scalingPlanData,
    alertData,
    communicationData,
    experimentData,
    optimizationData,
    reportData,
    policyData,
    taskData,
    budgetValidation,
    assetValidation,
    retrospectiveValidation,
    alertValidation,
    experimentValidation,
    communicationValidation,
    policyValidation,
  ]);

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return parentTasksOnly;

    const query = searchQuery.toLowerCase();
    return parentTasksOnly.filter(
      (task) =>
        task.summary?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.id?.toString().includes(query) ||
        task.owner?.username?.toLowerCase().includes(query) ||
        task.project?.name?.toLowerCase().includes(query) ||
        task.status?.toLowerCase().includes(query) ||
        task.type?.toLowerCase().includes(query),
    );
  }, [parentTasksOnly, searchQuery]);

  // Timeline gets tasks with backendStatus so Draft badge can show (status may be missing in some paths)
  const tasksForTimeline = useMemo(
    () =>
      (filteredTasks || []).map((task) => ({
        ...task,
        backendStatus: task.status,
      })),
    [filteredTasks],
  );

  const configuredBoardTypeKeys = Object.keys(taskTypeConfig).map(
    normalizeBoardTypeKey,
  );

  const boardTypeKeys = useMemo(() => {
    const allKeys = new Set(configuredBoardTypeKeys);

    (filteredTasks || []).forEach((task) => {
      allKeys.add(normalizeBoardTypeKey(task?.type));
    });

    const ordered = [];
    BOARD_TYPE_ORDER.forEach((typeKey) => {
      if (allKeys.has(typeKey)) {
        ordered.push(typeKey);
        allKeys.delete(typeKey);
      }
    });

    const remaining = Array.from(allKeys).sort((a, b) =>
      formatBoardTypeLabel(a).localeCompare(formatBoardTypeLabel(b)),
    );

    return [...ordered, ...remaining];
  }, [configuredBoardTypeKeys, filteredTasks]);

  const tasksByType = useMemo(() => {
    const grouped = boardTypeKeys.reduce((acc, typeKey) => {
      acc[typeKey] = [];
      return acc;
    }, {});

    (filteredTasks || []).forEach((task) => {
      const columnKey = normalizeBoardTypeKey(task?.type);
      if (!grouped[columnKey]) {
        grouped[columnKey] = [];
      }
      grouped[columnKey].push(task);
    });

    return grouped;
  }, [boardTypeKeys, filteredTasks]);

  function mapTaskDataToJiraTaskItem(task) {
    const statusMap = {
      DRAFT: "TODO",
      SUBMITTED: "SUBMITTED",
      UNDER_REVIEW: "IN_REVIEW",
      APPROVED: "DONE",
      REJECTED: "TODO",
      LOCKED: "TODO",
      CANCELLED: "TODO",
    };

    const dueDate = task.due_date
      ? new Date(task.due_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

    const projectName = task.project?.name || "TASK";
    const projectKey = projectName
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toUpperCase();
    const issueKey = `${projectKey || "TASK"}-${task.id}`;

    const jiraTaskItem = {
      id: task.id,
      summary: task.summary,
      type: task.type || "task",
      status: statusMap[task.status] || "TODO",
      statusRaw: task.status,
      backendStatus: task.status,
      owner: task.owner?.username,
      ownerId: task.owner?.id,
      approver: task.current_approver?.username || task.current_approver_id,
      approverId: task.current_approver?.id,
      dueDate: dueDate,
      dueDateRaw: task.due_date,
      project: task.project?.name,
      projectId: task.project?.id,
      description: task.description,
      issueKey,
      content_type: task.content_type,
      object_id: task.object_id,
    };

    return jiraTaskItem;
  }

  const jiraTasks = useMemo(() => {
    if (!parentTasksOnly) return [];
    return parentTasksOnly.map(mapTaskDataToJiraTaskItem);
  }, [parentTasksOnly]);

  const filteredJiraTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = !query
      ? jiraTasks
      : jiraTasks.filter((task) => {
          const searchable = [
            task.id ? String(task.id) : "",
            task.summary || "",
            task.description || "",
            task.type || "",
            task.status || "",
            task.owner || "",
            task.approver || "",
            task.project || "",
            task.issueKey || "",
          ]
            .join(" ")
            .toLowerCase();
          return searchable.includes(query);
        });

    // List-only pinning: drafts first, then newest first.
    return [...base].sort((a, b) => {
      const aDraft = a.backendStatus === "DRAFT";
      const bDraft = b.backendStatus === "DRAFT";
      if (aDraft !== bDraft) return aDraft ? -1 : 1;
      const aId = typeof a.id === "number" ? a.id : Number(a.id) || 0;
      const bId = typeof b.id === "number" ? b.id : Number(b.id) || 0;
      return bId - aId;
    });
  }, [jiraTasks, searchQuery]);

  const summaryMetrics = useMemo(() => {
    const metrics = boardData?.time_metrics;
    return [
      {
        key: "completed",
        label: "completed",
        value: metrics?.completed_last_7_days ?? 0,
        subtitle: "in the last 7 days",
        tone: "success",
      },
      {
        key: "updated",
        label: "updated",
        value: metrics?.updated_last_7_days ?? 0,
        subtitle: "in the last 7 days",
        tone: "info",
      },
      {
        key: "created",
        label: "created",
        value: metrics?.created_last_7_days ?? 0,
        subtitle: "in the last 7 days",
        tone: "info",
      },
      {
        key: "due-soon",
        label: "due soon",
        value: metrics?.due_soon ?? 0,
        subtitle: "in the next 7 days",
        tone: "warning",
      },
    ];
  }, [boardData]);

  const statusOverview = useMemo(() => {
    const palette = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#64748b"];
    const typeBreakdown = boardData?.types_of_work || [];
    const totalFromTypes = typeBreakdown.reduce(
      (sum, item) => sum + (item.count || 0),
      0,
    );
    const fallbackTotal = boardData?.status_overview?.total_work_items || 0;
    return {
      total: totalFromTypes || fallbackTotal,
      breakdown: typeBreakdown.map((item, index) => ({
        label: item.display_name || item.type,
        count: item.count || 0,
        color: palette[index % palette.length],
      })),
    };
  }, [boardData]);

  const workTypes = useMemo(() => {
    const palette = ["#3b82f6", "#a855f7", "#22c55e", "#64748b"];
    const list = boardData?.types_of_work || [];
    return list.map((item, index) => ({
      label: item.display_name || item.type,
      percentage: item.percentage || 0,
      color: palette[index % palette.length],
    }));
  }, [boardData]);

  const boardColumns = useMemo(
    () => boardTypeKeys.map((typeKey) => getBoardColumnMeta(typeKey)),
    [boardTypeKeys],
  );

  const getTicketKey = (task) => {
    if (!task?.id) return "TASK-NEW";
    const projectName = task.project?.name || "TASK";
    const prefix = projectName
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toUpperCase();
    return `${prefix || "TASK"}-${task.id}`;
  };

  const getBoardTypeIcon = (type) => {
    const normalized = normalizeBoardTypeKey(type);
    return BOARD_TYPE_META[normalized]?.icon || "custom";
  };

  const formatBoardDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDueTone = (dateString) => {
    if (!dateString) return "default";
    const due = new Date(dateString);
    if (Number.isNaN(due.getTime())) return "default";
    const today = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    if (dueDay < todayDay) return "danger";
    return "warning";
  };

  const startBoardEdit = (task) => {
    if (!task?.id) return;
    setEditingTaskId(task.id);
    setEditingSummary(task.summary || "");
  };

  const cancelBoardEdit = () => {
    setEditingTaskId(null);
    setEditingSummary("");
  };

  const saveBoardEdit = (task) => {
    if (!task?.id) return;
    updateTask(task.id, { ...task, summary: editingSummary });
    setEditingTaskId(null);
  };

  const handleTaskDataChange = (newTaskData) => {
    if (
      draftEditingTaskId &&
      newTaskData.type &&
      newTaskData.type !== taskData.type
    ) {
      return;
    }
    setTaskData((prev) => ({ ...prev, ...newTaskData }));

    // If task type is changed, update the task type
    if (newTaskData.type && newTaskData.type !== taskData.type) {
      setTaskType(newTaskData.type);
    }
  };

  const handleBudgetDataChange = (newBudgetData) => {
    setBudgetData((prev) => ({ ...prev, ...newBudgetData }));
  };

  const handleAssetDataChange = (newAssetData) => {
    setAssetData((prev) => ({ ...prev, ...newAssetData }));
  };

  const handleRetrospectiveDataChange = (newRetrospectiveData) => {
    setRetrospectiveData((prev) => ({ ...prev, ...newRetrospectiveData }));
  };

  const handleAlertDataChange = (newAlertData) => {
    setAlertData((prev) => ({ ...prev, ...newAlertData }));
  };

  const handleBudgetPoolDataChange = (newBudgetPoolData) => {
    setBudgetPoolData((prev) => ({ ...prev, ...newBudgetPoolData }));
  };

  const handleCommunicationDataChange = (newCommunicationData) => {
    setCommunicationData((prev) => ({
      ...prev,
      ...newCommunicationData,
    }));
  };

  const handlePolicyDataChange = (newPolicyData) => {
    setPolicyData((prev) => ({ ...prev, ...newPolicyData }));
  };

  // Handle task card click
  const handleTaskClick = (task) => {
    // Navigate to task detail page without preserving list view query params
    router.push(`/tasks/${task.id}`);
  };

  // Generic function to create task type specific object
  const createTaskTypeObject = async (taskType, createdTask) => {
    const config = taskTypeConfig[taskType];
    if (!config || !config.api) {
      return null;
    }

    const payload = config.getPayload(createdTask);
    if (payload === null) {
      return null;
    }

    try {
      const response = await config.api(payload);
      // Handle different response formats:
      // - Some APIs return {data: object}
      // - Some APIs (like AssetAPI.createAsset) return the object directly
      const createdObject = response?.data || response;
      return createdObject;
    } catch (error) {
      // Handle case where retrospective already exists
      if (taskType === "retrospective" && error.response?.status === 400) {
        const errorData = error.response.data;
        // Check if error is about retrospective already existing
        if (
          (errorData.campaign &&
            Array.isArray(errorData.campaign) &&
            errorData.campaign[0]?.includes("already exists")) ||
          (typeof errorData.campaign === "string" &&
            errorData.campaign.includes("already exists"))
        ) {
          // Try to find existing retrospective for this campaign
          try {
            const campaignId = payload.campaign;
            const retrospectivesResponse =
              await RetrospectiveAPI.getRetrospectives({
                campaign: campaignId,
              });
            if (
              retrospectivesResponse.data &&
              retrospectivesResponse.data.length > 0
            ) {
              return retrospectivesResponse.data[0];
            }
          } catch (findError) {
          }
        }
      }
      // Re-throw the error if we couldn't handle it
      throw error;
    }
  };

  // Generic function to reset form data. initialWorkType: when opening from a board column, pre-fill Work Type.
  const resetFormData = (
    projectOverride = projectId ?? null,
    initialWorkType = "",
    initialSummary = "",
  ) => {
    const defaultDates = getDefaultTaskDates();
    const workType =
      initialWorkType && VALID_BOARD_WORK_TYPES.includes(initialWorkType)
        ? initialWorkType
        : "";
    const summary =
      typeof initialSummary === "string" ? initialSummary : "";
    setTaskData({
      project_id: projectOverride,
      type: workType,
      summary,
      description: "",
      current_approver_id: null,
      start_date: defaultDates.start_date,
      due_date: defaultDates.due_date,
    });
    setBudgetData({
      amount: "",
      currency: "",
      ad_channel: null,
      notes: "",
      budget_pool: null,
    });
    setBudgetPoolData({
      project: null,
      ad_channel: null,
      total_amount: "",
      currency: "",
    });
    setAssetData({
      tags: "",
      team: "",
      notes: "",
      file: null,
    });
    setRetrospectiveData({});
    setScalingPlanData({});
    setAlertData({
      alert_type: "spend_spike",
      severity: "medium",
      status: "open",
      metric_key: "spend",
      change_type: "percent",
      change_value: "",
      change_window: "daily",
      current_value: "",
      previous_value: "",
      affected_entities: [],
      assigned_to: "",
      acknowledged_by: "",
      investigation_notes: "",
      resolution_steps: "",
      related_references: [],
      postmortem_root_cause: "",
      postmortem_prevention: "",
    });
    setExperimentData({});
    setOptimizationData({});
    setCommunicationData({
      communication_type: "",
      stakeholders: "",
      impacted_areas: [],
      required_actions: "",
      client_deadline: null,
      notes: "",
    });
    setTaskType(workType);
    setReportData({
      audience_type: "client",
      audience_details: "",
      context: defaultReportContext,
      outcome_summary: "",
      narrative_explanation: "",
      key_actions: [],
    });
    setPolicyData({});
    setContentType("");
  };

  // Generic function to clear validation errors
  const clearAllValidationErrors = () => {
    taskValidation.clearErrors();
    budgetValidation.clearErrors();
    budgetPoolValidation.clearErrors();
    assetValidation.clearErrors();
    retrospectiveValidation.clearErrors();
    alertValidation.clearErrors();
    policyValidation.clearErrors();
    experimentValidation.clearErrors();
  };

  /** Drop meeting create deep-link params after cancel or success (single flow exit). */
  const clearTaskCreateQueryFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("create") && !params.has("origin_meeting_id")) {
      return;
    }
    params.delete("create");
    params.delete("origin_meeting_id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  /**
   * Opens create modal. By default clears meeting origin (header, board column).
   * Timeline "Create Task" passes `{ preserveMeetingOrigin: true }` so a meeting
   * deep link (`?create=1&origin_meeting_id=`) is not wiped when opening the panel again.
   */
  const openGenericCreateTaskModal = (
    projectIdOverrideOrSectionKey,
    sectionKeyOrSummaryPrefill,
    summaryWhenProjectIdFirst,
    options = {},
  ) => {
    const preserveMeetingOrigin = options?.preserveMeetingOrigin === true;
    setDraftEditingTaskId(null);
    if (!preserveMeetingOrigin) {
      setCreateOriginMeetingId(null);
      setCreateOriginMeetingLabel(null);
      clearTaskCreateQueryFromUrl();
    } else {
      const rawOrigin =
        searchParams.get("origin_meeting_id") ??
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("origin_meeting_id")
          : null);
      const originNum = rawOrigin ? Number(rawOrigin) : NaN;
      if (Number.isFinite(originNum) && originNum >= 1) {
        setCreateOriginMeetingId(originNum);
      }
    }

    const isSectionKeyOnly =
      typeof projectIdOverrideOrSectionKey === "string" &&
      projectIdOverrideOrSectionKey.length > 0;
    const resolvedProjectId = isSectionKeyOnly
      ? projectId ?? null
      : typeof projectIdOverrideOrSectionKey === "number"
        ? projectIdOverrideOrSectionKey
        : projectId ?? null;
    const initialWorkType = isSectionKeyOnly
      ? projectIdOverrideOrSectionKey
      : sectionKeyOrSummaryPrefill ?? "";
    const initialSummary = isSectionKeyOnly
      ? typeof sectionKeyOrSummaryPrefill === "string"
        ? sectionKeyOrSummaryPrefill
        : ""
      : typeof summaryWhenProjectIdFirst === "string"
        ? summaryWhenProjectIdFirst
        : "";

    resetFormData(resolvedProjectId, initialWorkType, initialSummary);
    clearAllValidationErrors();
    setCreateModalOpen(true);
    setCreateModalExpanded(false);
  };

  const closeCreatePanel = () => {
    clearTaskCreateQueryFromUrl();
    setCreateModalOpen(false);
    setCreateModalExpanded(false);
    setDraftEditingTaskId(null);
    setCreateOriginMeetingId(null);
    setCreateOriginMeetingLabel(null);
  };

  const meetingOriginForCreatePayload = () => {
    const rawUrl =
      searchParams.get("origin_meeting_id") ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("origin_meeting_id")
        : null);
    const urlNum = rawUrl ? Number(rawUrl) : NaN;
    const fromUrl =
      Number.isFinite(urlNum) && urlNum >= 1 ? urlNum : null;
    const oid =
      createOriginMeetingId != null &&
      Number.isFinite(createOriginMeetingId) &&
      createOriginMeetingId >= 1
        ? createOriginMeetingId
        : fromUrl;
    return oid != null ? { origin_meeting_id: oid } : {};
  };

  useEffect(() => {
    if (!createOriginMeetingId || !projectId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const m = await MeetingsAPI.getMeeting(projectId, createOriginMeetingId);
        if (!cancelled) {
          setCreateOriginMeetingLabel(
            m.title?.trim() || `Meeting ${createOriginMeetingId}`,
          );
        }
      } catch {
        if (!cancelled) {
          setCreateOriginMeetingLabel(`Meeting ${createOriginMeetingId}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOriginMeetingId, projectId]);

  // When `origin_meeting_id` is present without `create=1`, still mirror it into state
  // so a later "Create Task" (e.g. timeline) can attach provenance.
  useEffect(() => {
    if (!projectId || !Number.isFinite(projectId)) return;
    const rawOrigin =
      searchParams.get("origin_meeting_id") ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("origin_meeting_id")
        : null);
    if (rawOrigin == null || rawOrigin === "") return;
    const originNum = Number(rawOrigin);
    if (!Number.isFinite(originNum) || originNum < 1) return;
    setCreateOriginMeetingId((prev) =>
      prev === originNum ? prev : originNum,
    );
  }, [searchParams, projectId]);

  // Meeting deep link: `/tasks?project_id=&view=timeline&create=1&origin_meeting_id=`
  // Keep query in the URL until cancel or successful create; form state mirrors `origin_meeting_id`.
  useEffect(() => {
    const rawCreate =
      searchParams.get("create") ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("create")
        : null);
    const wantCreate =
      rawCreate === "1" ||
      rawCreate === "true" ||
      (rawCreate && String(rawCreate).toLowerCase() === "yes");

    if (!wantCreate || !projectId || !Number.isFinite(projectId)) {
      lastMeetingDeepLinkKeyRef.current = "";
      return;
    }

    const rawOrigin =
      searchParams.get("origin_meeting_id") ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("origin_meeting_id")
        : null);
    const originNum = rawOrigin ? Number(rawOrigin) : NaN;
    const validOrigin =
      Number.isFinite(originNum) && originNum >= 1 ? originNum : null;

    const deepKey = `${String(rawCreate)}|${rawOrigin ?? ""}|${projectId}`;
    if (deepKey === lastMeetingDeepLinkKeyRef.current) {
      return;
    }
    lastMeetingDeepLinkKeyRef.current = deepKey;

    setDraftEditingTaskId(null);
    setCreateOriginMeetingId(validOrigin);
    setCreateOriginMeetingLabel(null);
    handleTabChange("tasks");
    resetFormData(projectId, "", "");
    clearAllValidationErrors();
    setCreateModalOpen(true);
    setCreateModalExpanded(false);
  }, [searchParams, projectId, handleTabChange]);

  const buildDraftPayload = useCallback(() => {
    return {
      version: 1,
      taskData: {
        ...taskData,
        current_approver_id: taskData.current_approver_id ?? null,
      },
      forms: {
        budgetData,
        budgetPoolData,
        assetData: { ...assetData, file: null },
        retrospectiveData,
        scalingPlanData,
        alertData,
        experimentData,
        optimizationData,
        communicationData,
        reportData,
        policyData,
      },
      updatedAt: Date.now(),
    };
  }, [
    alertData,
    assetData,
    budgetData,
    budgetPoolData,
    communicationData,
    experimentData,
    optimizationData,
    policyData,
    reportData,
    retrospectiveData,
    scalingPlanData,
    taskData,
  ]);

  const applyDraftPayload = useCallback(
    (payload) => {
      if (!payload || typeof payload !== "object") return;
      const draftTaskData = payload.taskData || {};
      const forms = payload.forms || {};

      setTaskData((prev) => ({
        ...prev,
        ...draftTaskData,
        current_approver_id: draftTaskData.current_approver_id ?? null,
      }));
      if (draftTaskData.type) {
        setTaskType(draftTaskData.type);
      }

      if (forms.budgetData) setBudgetData(forms.budgetData);
      if (forms.budgetPoolData) setBudgetPoolData(forms.budgetPoolData);
      if (forms.assetData) setAssetData({ ...forms.assetData, file: null });
      if (forms.retrospectiveData) setRetrospectiveData(forms.retrospectiveData);
      if (forms.scalingPlanData) setScalingPlanData(forms.scalingPlanData);
      if (forms.alertData) setAlertData(forms.alertData);
      if (forms.experimentData) setExperimentData(forms.experimentData);
      if (forms.optimizationData) setOptimizationData(forms.optimizationData);
      if (forms.communicationData) setCommunicationData(forms.communicationData);
      if (forms.reportData) setReportData(forms.reportData);
      if (forms.policyData) setPolicyData(forms.policyData);
    },
    [
      setAlertData,
      setAssetData,
      setBudgetData,
      setBudgetPoolData,
      setCommunicationData,
      setExperimentData,
      setOptimizationData,
      setPolicyData,
      setReportData,
      setRetrospectiveData,
      setScalingPlanData,
      setTaskData,
    ],
  );

  const openDraftForEdit = useCallback(
    async (taskId) => {
      if (!taskId) return;
      try {
        setCreateOriginMeetingId(null);
        setCreateOriginMeetingLabel(null);
        clearTaskCreateQueryFromUrl();

        const resp = await TaskAPI.getTask(Number(taskId));
        const serverTask = resp?.data;
        const payload = serverTask?.draft_payload;

        setDraftEditingTaskId(Number(taskId));

        const resolvedProjectId =
          payload?.taskData?.project_id ?? serverTask?.project?.id ?? null;
        const resolvedWorkType = payload?.taskData?.type ?? serverTask?.type ?? "";
        resetFormData(resolvedProjectId, resolvedWorkType);

        if (payload) {
          applyDraftPayload(payload);
        } else {
          // Fallback: at least restore core task fields.
          setTaskData((prev) => ({
            ...prev,
            project_id: serverTask?.project?.id ?? prev.project_id ?? null,
            type: serverTask?.type ?? prev.type ?? "",
            summary: serverTask?.summary ?? prev.summary ?? "",
            description: serverTask?.description ?? prev.description ?? "",
            current_approver_id:
              serverTask?.current_approver?.id ??
              serverTask?.current_approver_id ??
              null,
            start_date: serverTask?.start_date ?? prev.start_date ?? null,
            due_date: serverTask?.due_date ?? prev.due_date ?? null,
          }));
          if (serverTask?.type) setTaskType(serverTask.type);
        }

        clearAllValidationErrors();
        setCreateModalOpen(true);
        setCreateModalExpanded(false);
      } catch (error) {
        toast.error("Failed to open draft. Please try again.");
      }
    },
    [
      applyDraftPayload,
      clearAllValidationErrors,
      clearTaskCreateQueryFromUrl,
      resetFormData,
    ],
  );

  const handleCreateAsDraft = async () => {
    if (isSubmitting) return;

    const requiredDraftFields = ["project_id", "type", "summary"];
    if (!taskValidation.validateForm(taskData, requiredDraftFields)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const draftPayload = buildDraftPayload();
      const taskPayload = {
        project_id: taskData.project_id,
        type: taskData.type,
        summary: taskData.summary,
        description: taskData.description || "",
        current_approver_id: taskData.current_approver_id || null,
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || null,
        create_as_draft: true,
        draft_payload: draftPayload,
        ...meetingOriginForCreatePayload(),
      };

      await createTask(taskPayload);

      resetFormData();
      closeCreatePanel();
      clearAllValidationErrors();
      await reloadTasks();
      toast.success("Draft created.");
    } catch (error) {
      toast.error("Failed to create draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftEditingTaskId || isSubmitting) return;

    const requiredDraftFields = ["project_id", "type", "summary"];
    if (!taskValidation.validateForm(taskData, requiredDraftFields)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const draftPayload = buildDraftPayload();
      await TaskAPI.updateTask(draftEditingTaskId, {
        summary: taskData.summary,
        description: taskData.description || "",
        current_approver_id: taskData.current_approver_id || null,
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || null,
        draft_payload: draftPayload,
      });
      await reloadTasks();
      toast.success("Draft saved.");
    } catch (error) {
      toast.error("Failed to save draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!draftEditingTaskId || isSubmitting) return;

    const requiredTaskFields = ["project_id", "type", "summary"];
    if (!taskValidation.validateForm(taskData, requiredTaskFields)) {
      submitGuard.current = false;
      return;
    }

    const config = taskTypeConfig[taskData.type];
    if (config && config.validation && config.requiredFields.length > 0) {
      if (!config.validation.validateForm(config.formData, config.requiredFields)) {
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Persist latest draft state before creating type-specific objects.
      const draftPayload = buildDraftPayload();
      await TaskAPI.updateTask(draftEditingTaskId, {
        summary: taskData.summary,
        description: taskData.description || "",
        current_approver_id: taskData.current_approver_id || null,
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || null,
        draft_payload: draftPayload,
      });

      const existingTask = { id: draftEditingTaskId };
      setContentType(config?.contentType || "");

      // Check if type-specific object already exists (e.g. resubmit after rejection).
      // The backend rejects duplicate creation, so skip create + link when object_id is set.
      const taskResp = await TaskAPI.getTask(draftEditingTaskId);
      const hasLinkedObject = taskResp?.data?.object_id;

      if (!hasLinkedObject) {
        const createdObject = await createTaskTypeObject(taskData.type, existingTask);
        if (createdObject && config?.contentType) {
          await TaskAPI.linkTask(
            existingTask.id,
            config.contentType,
            createdObject.id.toString(),
          );
        }
      }

      await TaskAPI.submitTask(draftEditingTaskId);
      await TaskAPI.updateTask(draftEditingTaskId, { draft_payload: null });

      resetFormData();
      closeCreatePanel();
      clearAllValidationErrors();
      await reloadTasks();
      toast.success("Draft submitted.");
    } catch (error) {
      toast.error("Failed to submit draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJiraTaskClick = (task) => {
    if (task?.backendStatus === "DRAFT") {
      openDraftForEdit(task.id);
      return;
    }
    router.push(`/tasks/${task.id}`);
  };

  // Submit method to create task and related objects
  const handleSubmit = async () => {
    if (submitGuard.current || isSubmitting) return;
    submitGuard.current = true;

    // Original logic for other task types
    // Validate task form first
    // Only require approver when type is 'budget'
    const requiredTaskFields = ["project_id", "type", "summary"];
    if (!taskValidation.validateForm(taskData, requiredTaskFields)) {
      return;
    }

    // Validate task type specific form if config exists
    const config = taskTypeConfig[taskData.type];
    if (config && config.validation && config.requiredFields.length > 0) {
      if (
        !config.validation.validateForm(config.formData, config.requiredFields)
      ) {
        submitGuard.current = false;
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Step 1: Create the task
      const taskPayload = {
        project_id: taskData.project_id,
        type: taskData.type,
        summary: taskData.summary,
        description: taskData.description || "",
        // For report tasks, set the current user as the approver
        current_approver_id:
          taskData.type === "report" ? user?.id : taskData.current_approver_id,
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || null,
        ...meetingOriginForCreatePayload(),
      };

      const createdTask = await createTask(taskPayload);

      // Step 2: Create the specific type object
      setContentType(config?.contentType || "");

      const createdObject = await createTaskTypeObject(
        taskData.type,
        createdTask,
      );

      // Step 3: Link the task to the specific type object
      if (createdObject && config?.contentType) {
        try {
          // Link the task to the specific type object
          // Use the API for all types including report
          await TaskAPI.linkTask(
            createdTask.id,
            config.contentType,
            createdObject.id.toString(),
          );

          // Update the task with linked object info
          const updatedTask = {
            ...createdTask,
            content_type: config.contentType,
            object_id: createdObject.id.toString(),
            linked_object: createdObject,
          };

          // Update the task in the store
          updateTask(createdTask.id, updatedTask);
        } catch (linkError) {
          // Don't fail the entire creation if linking fails
          // The asset is already created with task reference (asset.task field)
          const errorMsg =
            linkError.response?.data?.error ||
            linkError.response?.data?.message ||
            linkError.message ||
            "Unknown error";
          const typeLabel = BOARD_TYPE_META[taskData.type]?.title || taskData.type;
          // Link failed silently - task was still created successfully
        }
      }

      // Step 4: For asset tasks, upload initial version file if provided
      if (taskData.type === "asset" && createdObject && assetData.file) {
        try {
          await AssetAPI.createAssetVersion(String(createdObject.id), {
            file: assetData.file,
          });
        } catch (error) {
          // Don't fail the entire task creation if file upload fails
          // User can upload the file later
          toast.error(
            "Asset created, but failed to upload initial version file. You can upload it later.",
          );
        }
      }

      // Reset form and close modal
      resetFormData();
      closeCreatePanel();

      // Clear validation errors
      clearAllValidationErrors();

      // Refresh tasks list
      await reloadTasks();
      const successMsg = config?.successMessage || "Task created successfully";
      toast.success(successMsg);
    } catch (error) {
      // Show more detailed error message
      let errorMessage = "Failed to create task";
      if (error.response?.data) {
        // Handle validation errors - check for common fields first
        const errorData = error.response.data;

        // Collect all error messages
        const errorMessages = [];

        // Check for specific field errors
        const fieldMappings = {
          campaign: "Campaign",
          decision: "Decision",
          confidence_level: "Confidence level",
          primary_assumption: "Primary assumption",
          scheduled_at: "Scheduled at",
          status: "Status",
          project_id: "Project",
          current_approver_id: "Approver",
          type: "Task type",
          summary: "Summary",
          impacted_areas: "Impacted areas",
          communication_type: "Communication type",
          required_actions: "Required actions",
        };

        for (const [field, label] of Object.entries(fieldMappings)) {
          if (errorData[field]) {
            const fieldError = Array.isArray(errorData[field])
              ? errorData[field][0]
              : errorData[field];
            errorMessages.push(`${label}: ${fieldError}`);
          }
        }

        // Handle non_field_errors if present
        if (errorData.non_field_errors) {
          const nonFieldErrors = Array.isArray(errorData.non_field_errors)
            ? errorData.non_field_errors
            : [errorData.non_field_errors];
          errorMessages.push(...nonFieldErrors);
        }

        // Handle generic error/message fields
        if (errorData.error) {
          errorMessages.push(errorData.error);
          if (errorData.detail) {
            if (typeof errorData.detail === "object") {
              const detailErrors = Object.values(errorData.detail);
              if (detailErrors.length > 0) {
                errorMessages.push(String(detailErrors[0]));
              }
            } else if (typeof errorData.detail === "string") {
              errorMessages.push(errorData.detail);
            }
          }
        } else if (errorData.message) {
          errorMessages.push(errorData.message);
        }

        // If no specific errors found, try to extract from object
        if (errorMessages.length === 0 && typeof errorData === "object") {
          const firstError = Object.values(errorData)[0];
          if (Array.isArray(firstError)) {
            errorMessages.push(firstError[0] || "Validation error");
          } else if (typeof firstError === "string") {
            errorMessages.push(firstError);
          } else if (typeof firstError === "object") {
            errorMessages.push(
              "Validation error: " + JSON.stringify(firstError),
            );
          } else {
            errorMessages.push(String(firstError) || "Validation error");
          }
        }

        errorMessage =
          errorMessages.length > 0
            ? errorMessages.join(". ")
            : "Validation error occurred";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      submitGuard.current = false;
      setIsSubmitting(false);
    }
  };

  // Submit method to create budget pool
  const handleSubmitBudgetPool = async () => {
    // Validate budget pool form
    const isValid = budgetPoolValidation.validateForm(budgetPoolData, [
      "project",
      "ad_channel",
      "total_amount",
      "currency",
    ]);

    if (!isValid) {
      return;
    }

    try {
      const createdBudgetPool = await createBudgetPool(budgetPoolData);

      // Show success message
      toast.success("Budget pool created successfully!");

      // Refresh budget pools list by incrementing trigger
      setBudgetPoolRefreshTrigger((prev) => prev + 1);

      // Automatically select the newly created budget pool if it matches current filters
      if (
        createdBudgetPool.project === taskData.project_id &&
        createdBudgetPool.ad_channel === budgetData.ad_channel &&
        createdBudgetPool.currency === budgetData.currency
      ) {
        handleBudgetDataChange({
          ...budgetData,
          budget_pool: createdBudgetPool.id,
        });
      }

      // Close budget pool modal and return to task creation modal
      setCreateBudgetPoolModalOpen(false);
      setCreateModalOpen(true);
      setCreateModalExpanded(true);

      // Reset budget pool form data
      setBudgetPoolData({
        project: null,
        ad_channel: null,
        total_amount: "",
        currency: "",
      });

      // Clear validation errors
      budgetPoolValidation.clearErrors();
    } catch (error) {
      toast.error("Failed to create budget pool. Please try again.");
    }
  };

  const handleUserAction = async (action) => {
    if (action === "settings") {
      // Handle settings
    } else if (action === "logout") {
      await logout();
    }
  };

  const handleCreateBudgetPool = () => {
    // Pre-fill the budget pool form with the current project and selected currency/ad_channel
    setBudgetPoolData({
      project: taskData.project_id,
      ad_channel: budgetData.ad_channel,
      total_amount: "",
      currency: budgetData.currency || "",
    });
    setCreateBudgetPoolModalOpen(true);
    setManageBudgetPoolsModalOpen(false);
    closeCreatePanel();
  };

  const handleManageBudgetPools = () => {
    setManageBudgetPoolsModalOpen(true);
    setCreateBudgetPoolModalOpen(false);
    closeCreatePanel();
  };

  const layoutUser = user
    ? {
        name: user.username || user.email,
        email: user.email,
        role: user.roles && user.roles.length > 0 ? user.roles[0] : undefined,
      }
    : undefined;
  const showProjectPickerLoading = authBootLoading || projectOptionsLoading;
  const showSelectedProjectNameSkeleton =
    authBootLoading || (projectOptionsLoading && !selectedProject);
  const summaryContentLoading =
    authBootLoading ||
    delayedBoardLoading ||
    (activeTab === "summary" &&
      projectId != null &&
      loadedBoardProjectId !== projectId &&
      !boardError);
  const taskContentLoading = authBootLoading || delayedTasksLoading;
  const boardContentLoading = authBootLoading || delayedTasksLoading;
  const projectPickerSkeletonRows = [
    {
      name: "w-40",
      description: "w-60",
      key: "w-12",
      lead: "w-20",
      status: "w-16",
    },
    {
      name: "w-48",
      description: "w-48",
      key: "w-14",
      lead: "w-24",
      status: "w-20",
    },
    {
      name: "w-36",
      description: "w-64",
      key: "w-10",
      lead: "w-24",
      status: "w-14",
    },
    {
      name: "w-44",
      description: "w-52",
      key: "w-12",
      lead: "w-20",
      status: "w-16",
    },
    {
      name: "w-52",
      description: "w-44",
      key: "w-14",
      lead: "w-28",
      status: "w-20",
    },
  ];

  return (
    <Layout
      user={layoutUser}
      onUserAction={handleUserAction}
      mainScrollMode="page"
    >
      <div className="min-h-full bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex flex-row gap-4 items-center mb-4">
              {projectId && (
                <h1 className="text-3xl font-bold text-gray-900">
                  {showSelectedProjectNameSkeleton ? (
                    <span className="inline-flex items-center gap-2">
                      <Skeleton className="h-9 w-48" />
                    </span>
                  ) : (
                    `${selectedProject?.name || "Project"} - Tasks`
                  )}
                </h1>
              )}
              {projectId && activeTab !== "board" && (
                <button
                  type="button"
                  onClick={() => openGenericCreateTaskModal()}
                  className="px-3 py-1.5 rounded text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Task
                </button>
              )}
            </div>

            {projectId && (
              <div className="mb-4 border-b border-gray-200">
                <nav data-testid="workspace-tab-nav" className="flex space-x-8">
                  <button
                    data-testid="tab-summary"
                    onClick={() => handleTabChange("summary")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "summary"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    data-testid="tab-tasks"
                    onClick={() => handleTabChange("tasks")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "tasks"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Tasks
                  </button>
                  <button
                    data-testid="tab-board"
                    onClick={() => handleTabChange("board")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "board"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Board
                  </button>
                </nav>
              </div>
            )}

            {projectId && (
              <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-900">
                      Project selected
                    </div>
                    <p className="text-sm text-gray-600">
                      Switch projects to see a different task workspace.
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      Current project:
                      {showSelectedProjectNameSkeleton ? (
                        <Skeleton className="h-4 w-40" />
                      ) : (
                        `#${projectId} ${
                          projectOptions.find(
                            (project) => project.id === projectId,
                          )?.name || "Unknown"
                        }`
                      )}
                    </div>
                  </div>
                  <div className="w-full sm:max-w-xs">
                    <button
                      type="button"
                      onClick={() => router.push("/tasks")}
                      className="flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      Switch project
                    </button>
                    {projectOptionsError && (
                      <p className="mt-2 text-sm text-red-600">
                        {projectOptionsError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!projectId && (
              <div className="mx-auto max-w-5xl">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select project
                </h2>

                <div className="mt-4">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={projectSearchQuery}
                      onChange={(event) =>
                        setProjectSearchQuery(event.target.value)
                      }
                      placeholder="Search by project name or ID..."
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm transition focus:border-gray-300 focus:bg-white focus:ring-1 focus:ring-gray-200"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  {showProjectPickerLoading && (
                    <div className="space-y-3 py-2">
                      {projectPickerSkeletonRows.map((row, index) => (
                        <div
                          key={`task-project-loading-${index}`}
                          className="w-full border-b border-gray-200 py-3"
                        >
                          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] sm:items-center sm:gap-3">
                            <Skeleton className="h-6 w-6 rounded-md" />
                            <div className="min-w-0 space-y-2">
                              <Skeleton className={`h-4 ${row.name}`} />
                              <Skeleton className={`h-4 ${row.description}`} />
                            </div>
                            <Skeleton className={`h-4 ${row.key}`} />
                            <Skeleton className={`h-4 ${row.lead}`} />
                            <Skeleton className={`h-6 rounded-full ${row.status}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!showProjectPickerLoading && projectOptionsError && (
                    <div className="py-8 text-center text-sm text-red-600">
                      {projectOptionsError}
                    </div>
                  )}
                  {!showProjectPickerLoading &&
                    !projectOptionsError &&
                    filteredProjects.length === 0 && (
                      <div className="py-8 text-center text-sm text-gray-500">
                        No projects found.
                      </div>
                    )}
                  {!showProjectPickerLoading &&
                    !projectOptionsError &&
                    filteredProjects.length > 0 && (
                      <div className="mb-3 hidden grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] items-center gap-3 border-b border-gray-200 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:grid">
                        <span />
                        <span>Name</span>
                        <span>Key</span>
                        <span>Lead</span>
                        <span>Status</span>
                      </div>
                    )}
                  {!showProjectPickerLoading &&
                    !projectOptionsError &&
                    pinnedProjects.length > 0 && (
                      <div>
                        {pinnedProjects.map((project) => (
                          <button
                            key={`pinned-${project.id}`}
                            onClick={() => handlePickProject(project.id)}
                            className="group w-full border-b border-gray-200 bg-amber-50/40 py-3 text-left transition hover:bg-amber-50/60"
                          >
                            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] sm:items-center sm:gap-3">
                              <div
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  togglePinProject(project.id);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Unpin project"
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    togglePinProject(project.id);
                                  }
                                }}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.2 3.69a1 1 0 00.95.69h3.882c.969 0 1.371 1.24.588 1.81l-3.141 2.282a1 1 0 00-.364 1.118l1.2 3.69c.3.921-.755 1.688-1.54 1.118l-3.14-2.282a1 1 0 00-1.176 0l-3.14 2.282c-.785.57-1.84-.197-1.54-1.118l1.2-3.69a1 1 0 00-.364-1.118L2.43 9.117c-.783-.57-.38-1.81.588-1.81H6.9a1 1 0 00.95-.69l1.2-3.69z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {project.name || "Untitled Project"}
                                  </span>
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    Pinned
                                  </span>
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-500">
                                  {project.description || "No description"}
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="sm:hidden">Key: </span>
                                <span className="font-medium text-gray-700">
                                  P-{project.id}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="sm:hidden">Lead: </span>
                                {project.owner?.name ||
                                  project.owner?.username ||
                                  project.owner?.email ||
                                  "Unassigned"}
                              </div>
                              <div className="text-xs">
                                <span className="sm:hidden">Status: </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    project.is_active
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {project.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  {!showProjectPickerLoading &&
                    !projectOptionsError &&
                    recentProjects.length > 0 && (
                      <div>
                        {recentProjects.map((project) => (
                          <button
                            key={`recent-${project.id}`}
                            onClick={() => handlePickProject(project.id)}
                            className="group w-full border-b border-gray-200 py-3 text-left transition hover:bg-gray-50"
                          >
                            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] sm:items-center sm:gap-3">
                              <div
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  togglePinProject(project.id);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Pin project"
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    togglePinProject(project.id);
                                  }
                                }}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 5l7 7M4 4l8 0 0 8"
                                  />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {project.name || "Untitled Project"}
                                  </span>
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-500">
                                  {project.description || "No description"}
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="sm:hidden">Key: </span>
                                <span className="font-medium text-gray-700">
                                  P-{project.id}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="sm:hidden">Lead: </span>
                                {project.owner?.name ||
                                  project.owner?.username ||
                                  project.owner?.email ||
                                  "Unassigned"}
                              </div>
                              <div className="text-xs">
                                <span className="sm:hidden">Status: </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    project.is_active
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {project.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  {!showProjectPickerLoading &&
                    !projectOptionsError &&
                    otherProjects.length > 0 && (
                      <div>
                        {otherProjects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handlePickProject(project.id)}
                            className="group w-full border-b border-gray-200 py-3 text-left transition hover:bg-gray-50"
                          >
                            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] sm:items-center sm:gap-3">
                              <div
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  togglePinProject(project.id);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Pin project"
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    togglePinProject(project.id);
                                  }
                                }}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 5l7 7M4 4l8 0 0 8"
                                  />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {project.name || "Untitled Project"}
                                  </span>
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-500">
                                  {project.description || "No description"}
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="sm:hidden">Key: </span>
                                <span className="font-medium text-gray-700">
                                  P-{project.id}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="sm:hidden">Lead: </span>
                                {project.owner?.name ||
                                  project.owner?.username ||
                                  project.owner?.email ||
                                  "Unassigned"}
                              </div>
                              <div className="text-xs">
                                <span className="sm:hidden">Status: </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    project.is_active
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {project.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {projectId && activeTab === "summary" && (
            <div data-testid="tab-content-summary" className="mt-6 space-y-6">
              {!summaryContentLoading && boardError ? (
                <div className="text-center py-8">
                  <p className="text-red-600">{boardError}</p>
                  <button
                    onClick={fetchBoardData}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <JiraSummaryView
                  metrics={summaryMetrics}
                  statusOverview={statusOverview}
                  workTypes={workTypes}
                  loading={summaryContentLoading}
                  onViewWorkItems={() => {
                    handleTabChange("tasks");
                    setViewMode("list");
                  }}
                  onViewItems={() => {
                    handleTabChange("board");
                  }}
                />
              )}
            </div>
          )}

          {projectId && activeTab === "board" && (
            <div className="mt-6 space-y-6">
              <JiraBoardView
                boardColumns={boardColumns}
                tasksByType={tasksByType}
                loading={boardContentLoading}
                onCreateTask={openGenericCreateTaskModal}
                onTaskClick={handleTaskClick}
                getTicketKey={getTicketKey}
                getBoardTypeIcon={getBoardTypeIcon}
                formatBoardDate={formatBoardDate}
                getDueTone={getDueTone}
                editingTaskId={editingTaskId}
                editingSummary={editingSummary}
                setEditingSummary={setEditingSummary}
                startBoardEdit={startBoardEdit}
                cancelBoardEdit={cancelBoardEdit}
                saveBoardEdit={saveBoardEdit}
                currentUser={user || undefined}
                externalFilters={
                  <TaskFilterPanel
                    filters={filters}
                    onChange={setFilters}
                    onClearAll={clearFilters}
                    projectOptions={projectOptions}
                    typeOptions={taskTypeOptions}
                  />
                }
              />
            </div>
          )}

          {/* Error State */}
          {projectId && activeTab === "tasks" && tasksError && !taskContentLoading && (
            <div className="text-center py-8">
              <p className="text-red-600">
                Error loading tasks: {tasksError.message}
              </p>
              <button
                onClick={() => {
                  fetchTasks(taskFetchRequest);
                }}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* Tasks Display */}
          {projectId &&
            activeTab === "tasks" &&
            (taskContentLoading || !tasksError) && (
            <div className="min-h-screen bg-[#f8f9fb] px-6 py-6">
              <div className="mx-auto max-w-6xl space-y-4">
                <JiraTasksView
                  tasks={filteredJiraTasks}
                  loading={taskContentLoading}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Search tasks..."
                  rightOfSearch={
                    <TaskFilterPanel
                      filters={filters}
                      onChange={setFilters}
                      onClearAll={clearFilters}
                      projectOptions={projectOptions}
                      typeOptions={taskTypeOptions}
                    />
                  }
                  onTaskClick={handleJiraTaskClick}
                  onTaskUpdate={reloadTasks}
                  renderTimeline={() => (
                    <TimelineViewComponent
                      tasks={tasksForTimeline}
                      onTaskClick={handleTaskClick}
                      reloadTasks={reloadTasks}
                      onCreateTask={(projectIdOverride) =>
                        openGenericCreateTaskModal(
                          projectIdOverride,
                          undefined,
                          undefined,
                          { preserveMeetingOrigin: true },
                        )
                      }
                      currentUser={user || undefined}
                    />
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project picker now renders as full page when no project is selected */}

      {/* Create Task Panel */}
      <TaskCreatePanel
        isOpen={createModalOpen}
        isExpanded={createModalExpanded}
        onClose={closeCreatePanel}
        onExpand={() => setCreateModalExpanded(true)}
        onCollapse={() => setCreateModalExpanded(false)}
        title={draftEditingTaskId ? "Edit draft" : "Create Task"}
        footer={
          <>
            <button
              onClick={closeCreatePanel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={draftEditingTaskId ? handleSaveDraft : handleCreateAsDraft}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : draftEditingTaskId
                  ? "Save draft"
                  : "Create as draft"}
            </button>
            <button
              onClick={draftEditingTaskId ? handleSubmitDraft : handleSubmit}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? draftEditingTaskId
                  ? "Submitting..."
                  : "Creating..."
                : draftEditingTaskId
                  ? "Submit"
                  : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-8">
          {createOriginMeetingLabel ? (
            <div className="rounded-md border border-indigo-100/80 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
              <span className="text-indigo-800/85">Origin meeting: </span>
              <span className="font-medium">{createOriginMeetingLabel}</span>
            </div>
          ) : null}
          {/* Task info */}
          <NewTaskForm
            onTaskDataChange={handleTaskDataChange}
            taskData={taskData}
            validation={taskValidation}
            lockProject={Boolean(projectId)}
            projectName={selectedProject?.name}
          />

          {/* Task Type specific forms - conditionally render based on chosen task type */}
          {taskType === "budget" && (
            <NewBudgetRequestForm
              onBudgetDataChange={handleBudgetDataChange}
              budgetData={budgetData}
              taskData={taskData}
              validation={budgetValidation}
              onCreateBudgetPool={handleCreateBudgetPool}
              onManageBudgetPools={handleManageBudgetPools}
              refreshTrigger={budgetPoolRefreshTrigger}
            />
          )}
          {taskType === "asset" && (
            <NewAssetForm
              onAssetDataChange={handleAssetDataChange}
              assetData={assetData}
              taskData={taskData}
              validation={assetValidation}
            />
          )}
          {taskType === "retrospective" && (
            <NewRetrospectiveForm
              onRetrospectiveDataChange={handleRetrospectiveDataChange}
              retrospectiveData={retrospectiveData}
              taskData={taskData}
              validation={retrospectiveValidation}
            />
          )}

          {taskType === "alert" && (
            <AlertTaskForm
              initialData={alertData}
              onChange={handleAlertDataChange}
              projectId={taskData.project_id}
            />
          )}

          {taskType === "communication" && (
            <NewClientCommunicationForm
              communicationData={communicationData}
              onCommunicationDataChange={handleCommunicationDataChange}
              validation={communicationValidation}
            />
          )}

          {taskType === "scaling" && (
            <ScalingPlanForm
              mode="create"
              initialPlan={scalingPlanData}
              onChange={setScalingPlanData}
            />
          )}

          {taskType === "experiment" && (
            <ExperimentForm
              mode="create"
              initialData={experimentData}
              onChange={setExperimentData}
            />
          )}

          {taskType === "optimization" && (
            <OptimizationForm
              mode="create"
              initialData={optimizationData}
              onChange={setOptimizationData}
            />
          )}

          {taskType === "report" && (
            <ReportForm
              mode="create"
              initialData={reportData}
              onChange={(data) =>
                setReportData((prev) => ({ ...prev, ...data }))
              }
            />
          )}

          {taskType === "platform_policy_update" && (
            <NewPlatformPolicyUpdateForm
              onPolicyDataChange={handlePolicyDataChange}
              policyData={policyData}
              taskData={taskData}
              validation={policyValidation}
            />
          )}
        </div>
      </TaskCreatePanel>

      {/* Manage Budget Pools Modal */}
      <Modal
        isOpen={manageBudgetPoolsModalOpen}
        onClose={() => {
          setManageBudgetPoolsModalOpen(false);
          setCreateModalOpen(true);
          setCreateModalExpanded(true);
        }}
      >
        <div className="flex flex-col justify-center items-center p-8 gap-6 bg-white rounded-md min-w-[600px]">
          {/* Header */}
          <div className="flex flex-col gap-2 w-full">
            <h2 className="text-lg font-bold">Manage Budget Pools</h2>
            <p className="text-sm text-gray-500">
              View, select, and manage all budget pools
            </p>
          </div>

          {/* Budget Pool List */}
          <div className="w-full">
            <BudgetPoolList
              projectId={taskData.project_id}
              onCreatePool={handleCreateBudgetPool}
              refreshTrigger={budgetPoolRefreshTrigger}
            />
          </div>

          {/* Close Button */}
          <div className="flex flex-row justify-end gap-4 w-full">
            <button
              onClick={() => {
                setManageBudgetPoolsModalOpen(false);
                setCreateModalOpen(true);
                setCreateModalExpanded(true);
              }}
              className="px-3 py-1.5 rounded text-white bg-gray-500 hover:bg-gray-600"
            >
              Back to Task Creation
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Budget Pool Modal */}
      <Modal
        isOpen={createBudgetPoolModalOpen}
        onClose={() => {
          setCreateBudgetPoolModalOpen(false);
          setManageBudgetPoolsModalOpen(true);
        }}
      >
        <div className="flex flex-col justify-center items-center p-8 gap-10 bg-white rounded-md">
          {/* Header */}
          <div className="flex flex-col gap-2 w-full">
            <h2 className="text-lg font-bold">Create Budget Pool</h2>
          </div>

          {/* Budget Pool Form */}
          <NewBudgetPool
            onBudgetPoolDataChange={handleBudgetPoolDataChange}
            budgetPoolData={budgetPoolData}
            validation={budgetPoolValidation}
            loading={budgetPoolLoading}
            onSubmit={(formData) => {
              setBudgetPoolData(formData);
              // Use setTimeout to ensure state is updated before validation
              setTimeout(() => {
                handleSubmitBudgetPool();
              }, 0);
            }}
          />

          {/* Validation Errors Display */}
          {Object.keys(budgetPoolValidation.errors).length > 0 && (
            <div className="w-full p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              <p className="text-sm font-semibold mb-2">Validation Errors:</p>
              <ul className="list-disc list-inside text-sm">
                {Object.entries(budgetPoolValidation.errors).map(
                  ([field, error]) =>
                    error ? (
                      <li key={field}>
                        {field}: {error}
                      </li>
                    ) : null,
                )}
              </ul>
            </div>
          )}

          {/* API Error Display */}
          {budgetPoolError && (
            <div className="w-full p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              <p className="text-sm">
                Error:{" "}
                {budgetPoolError.response?.data?.message ||
                  budgetPoolError.message}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-row flex-between gap-4">
            <button
              onClick={() => {
                setCreateBudgetPoolModalOpen(false);
                setManageBudgetPoolsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded text-white bg-gray-500 hover:bg-gray-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                // Get the latest form data from the form element
                const form = e.target
                  .closest(".flex.flex-col")
                  ?.querySelector("form");
                if (form) {
                  const latestData = {
                    project:
                      budgetPoolData.project ||
                      Number(form.querySelector('[name="project"]')?.value) ||
                      null,
                    ad_channel:
                      budgetPoolData.ad_channel ||
                      Number(
                        form.querySelector('[name="ad_channel"]')?.value,
                      ) ||
                      null,
                    total_amount:
                      budgetPoolData.total_amount ||
                      form.querySelector('[name="total_amount"]')?.value ||
                      "",
                    currency:
                      budgetPoolData.currency ||
                      form.querySelector('[name="currency"]')?.value ||
                      "",
                  };
                  setBudgetPoolData(latestData);
                  // Use setTimeout to ensure state is updated
                  setTimeout(() => {
                    handleSubmitBudgetPool();
                  }, 100);
                } else {
                  handleSubmitBudgetPool();
                }
              }}
              className="px-3 py-1.5 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
              disabled={budgetPoolLoading}
            >
              {budgetPoolLoading ? "Creating..." : "Submit"}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

export default function TasksPage() {
  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <TasksPageContent />
    </ProtectedRoute>
  );
}
