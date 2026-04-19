"use client";

import {
  useEffect,
  useState,
  useMemo,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../ui/accordion";
import { TaskData, TaskComment, ApprovalChainProgress } from "@/types/task";
import { RemovablePicker } from "../ui/RemovablePicker";
import { ProjectAPI } from "@/lib/api/projectApi";
import { TaskAPI } from "@/lib/api/taskApi";
import { BudgetRequestData, BudgetPoolData } from "@/lib/api/budgetApi";
import { BudgetAPI } from "@/lib/api/budgetApi";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useTaskStore } from "@/lib/taskStore";
import AssetDetail from "./AssetDetail";
import RetrospectiveDetail from "./RetrospectiveDetail";
import BudgetRequestDetail from "./BudgetRequestDetail";
import LinkedWorkItems from "./LinkedWorkItems";
import Subtasks from "./Subtasks";
import Attachments from "./Attachments";
import { toast } from "react-hot-toast";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import AutoResizeTextarea from "@/components/ui/AutoResizeTextarea";
import ScalingDetail from "./ScalingDetail";
import ExperimentDetail from "./ExperimentDetail";
import AlertDetail from "./AlertDetail";
import OptimizationDetail from "./OptimizationDetail";
import {
  OptimizationScalingAPI,
  ScalingPlan,
} from "@/lib/api/optimizationScalingApi";
import { ExperimentAPI, Experiment } from "@/lib/api/experimentApi";
import { ChevronDown, Share2, Trash2 } from "lucide-react";
import { OptimizationAPI, Optimization } from "@/lib/api/optimizationApi";
import { ClientCommunicationAPI } from "@/lib/api/clientCommunicationApi";
import type { ClientCommunicationPayload } from "@/lib/api/clientCommunicationApi";
import { AlertingAPI, AlertTask } from "@/lib/api/alertingApi";
import { ReportAPI } from "@/lib/api/reportApi";
import type { ReportTask } from "@/types/report";
import {
  RetrospectiveAPI,
  RetrospectiveTaskData,
  UpdateRetrospectiveData,
} from "@/lib/api/retrospectiveApi";
import ReportDetail from "./ReportDetail";
import PlatformPolicyUpdateDetail from "./PlatformPolicyUpdateDetail";
import { PolicyAPI, PlatformPolicyUpdateData } from "@/lib/api/policyApi";
import {
  JiraDueDateBadge,
  JiraBoardDueTone,
} from "@/components/jira-ticket/JiraBoard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { OriginMeetingBlock } from "@/components/meetings/OriginMeetingBlock";
import { useChatData } from "@/hooks/useChatData";
import { createChat, findPrivateChat, sendMessage } from "@/lib/api/chatApi";
import ShareTaskDialog from "./ShareTaskDialog";

interface TaskDetailProps {
  task: TaskData;
  currentUser?: {
    id?: string | number;
    username: string;
    email: string;
    is_staff?: boolean;
  };
  onTaskUpdate?: (updatedTask: TaskData) => void;
  onTaskDeleted?: () => void;
}

interface ApprovalRecord {
  id: number;
  task: number;
  approved_by: {
    id: number;
    username: string;
  };
  is_approved: boolean;
  comment: string;
  step_number: number;
  decided_time: string;
  role_name?: string | null;
  // SMP-501: revision tracking fields
  revision_round?: number;
  revision_label?: string;
  resubmitted_after_reject?: boolean;
}

interface ClientCommunicationData
  extends Omit<ClientCommunicationPayload, "task"> {
  id: number;
  task: number;
  created_at?: string;
  updated_at?: string;
}

const COMMUNICATION_TYPE_OPTIONS: {
  value: ClientCommunicationPayload["communication_type"];
  label: string;
}[] = [
  { value: "budget_change", label: "Budget Change" },
  { value: "creative_approval", label: "Creative Approval" },
  { value: "kpi_update", label: "KPI Update" },
  { value: "targeting_change", label: "Targeting Change" },
  { value: "other", label: "Other" },
];

const IMPACTED_AREA_OPTIONS: {
  value: ClientCommunicationPayload["impacted_areas"][number];
  label: string;
}[] = [
  { value: "budget", label: "Budget" },
  { value: "creative", label: "Creative" },
  { value: "kpi", label: "KPIs" },
  { value: "targeting", label: "Targeting" },
];

const sharedCommentLikeTextareaClass =
  "w-full resize-none overflow-hidden px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-indigo-500";

type CommentStyleTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "ref" | "className"
> & {
  textareaRef?: Ref<HTMLTextAreaElement>;
};

function CommentStyleTextarea({
  textareaRef,
  ...props
}: CommentStyleTextareaProps) {
  return (
    <textarea
      ref={textareaRef}
      className={sharedCommentLikeTextareaClass}
      {...props}
    />
  );
}

export default function TaskDetail({
  task,
  currentUser,
  onTaskUpdate,
  onTaskDeleted,
}: TaskDetailProps) {
  const { updateTask } = useTaskStore();
  const { startReview: startBudgetReview, makeDecision: makeBudgetDecision } =
    useBudgetData();
  const projectId = task.project?.id ?? task.project_id;
  const currentUserId = currentUser?.id !== undefined ? Number(currentUser.id) : null;
  const { chats } = useChatData({ projectId, autoFetch: Boolean(projectId) });

  const [summaryDraft, setSummaryDraft] = useState(task.summary || "");
  const [descriptionDraft, setDescriptionDraft] = useState(
    task.description || "",
  );
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingApprover, setEditingApprover] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [ownerId, setOwnerId] = useState<string>(
    task.owner?.id?.toString() || "",
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(task?.status ?? "");
  const [savingOwner, setSavingOwner] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingTask, setSharingTask] = useState(false);
  const {
    textareaRef: descriptionTextareaRef,
    resizeTextarea: resizeDescriptionTextarea,
  } = useAutoResizeTextarea(descriptionDraft, {
    enabled: editingDescription,
    minHeight: 84,
  });

  const [isReviewing, setIsReviewing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [approvers, setApprovers] = useState<
    { id: number; username: string; email: string }[]
  >([]);
  const [nextApprover, setNextApprover] = useState<string | null>(null);
  const [currentApproverId, setCurrentApproverId] = useState<string>(
    task.current_approver?.id?.toString() || "",
  );
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  // start_date and due_date
  const [startDateInput, setStartDateInput] = useState(task.start_date ?? "");
  const [dueDateInput, setDueDateInput] = useState(task.due_date ?? "");
  const [savingDates, setSavingDates] = useState(false);

  // Budget request and budget pool data
  const [budgetRequest, setBudgetRequest] = useState<BudgetRequestData | null>(
    null,
  );
  const [budgetPool, setBudgetPool] = useState<BudgetPoolData | null>(null);
  const [loadingBudgetData, setLoadingBudgetData] = useState(false);

  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskCommentsLoading, setTaskCommentsLoading] = useState(false);
  const [taskCommentsError, setTaskCommentsError] = useState<string | null>(
    null,
  );
  const [taskCommentInput, setTaskCommentInput] = useState("");
  const {
    textareaRef: taskCommentTextareaRef,
    resizeTextarea: resizeTaskCommentTextarea,
  } = useAutoResizeTextarea(taskCommentInput, {
    minHeight: 84,
  });
  const [taskCommentSubmitting, setTaskCommentSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Scaling plan data (for scaling tasks)
  const [scalingPlan, setScalingPlan] = useState<ScalingPlan | null>(null);
  const [scalingPlanLoading, setScalingPlanLoading] = useState(false);

  // Alert data (for alert tasks)
  const [alertTask, setAlertTask] = useState<AlertTask | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  // Experiment data (for experiment tasks)
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [experimentLoading, setExperimentLoading] = useState(false);

  // Optimization data (for optimization tasks)
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);

  // Report data (for report tasks)
  const [report, setReport] = useState<ReportTask | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Platform policy update data (for platform_policy_update tasks)
  const [policyUpdate, setPolicyUpdate] =
    useState<PlatformPolicyUpdateData | null>(null);
  const [policyUpdateLoading, setPolicyUpdateLoading] = useState(false);

  // Retrospective data (for retrospective tasks)
  const [retrospective, setRetrospective] =
    useState<RetrospectiveTaskData | null>(null);
  const [retrospectiveLoading, setRetrospectiveLoading] = useState(false);

  // Client communication data (for communication tasks)
  const [communication, setCommunication] =
    useState<ClientCommunicationData | null>(null);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [communicationError, setCommunicationError] = useState<string | null>(
    null,
  );
  const [editingCommunication, setEditingCommunication] = useState(false);
  const [savingCommunication, setSavingCommunication] = useState(false);
  const [communicationDraft, setCommunicationDraft] = useState<Omit<
    ClientCommunicationPayload,
    "task"
  > | null>(null);

  useEffect(() => {
    setSummaryDraft(task.summary || "");
    setDescriptionDraft(task.description || "");
  }, [task.summary, task.description]);

  useEffect(() => {
    if (!communication) {
      setCommunicationDraft(null);
      setEditingCommunication(false);
      return;
    }
    if (editingCommunication) return;
    setCommunicationDraft({
      communication_type: communication.communication_type,
      stakeholders: communication.stakeholders || "",
      impacted_areas: Array.isArray(communication.impacted_areas)
        ? [...communication.impacted_areas]
        : [],
      required_actions: communication.required_actions || "",
      client_deadline: communication.client_deadline || null,
      notes: communication.notes || "",
    });
  }, [communication, editingCommunication]);

  const handleSaveSummary = async () => {
    if (!task.id) return;
    try {
      setSavingSummary(true);
      const response = await TaskAPI.updateTask(task.id, {
        summary: summaryDraft,
      });
      updateTask(task.id, response.data);
      onTaskUpdate?.(response.data);

      setEditingSummary(false);
    } catch (error) {
      console.error("Error updating task name:", error);
      toast.error("Failed to update task name.");
    } finally {
      setSavingSummary(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!task.id) return;
    try {
      setSavingDescription(true);
      const response = await TaskAPI.updateTask(task.id, {
        description: descriptionDraft,
      });
      updateTask(task.id, response.data);
      onTaskUpdate?.(response.data);
      setEditingDescription(false);
    } catch (error) {
      console.error("Error updating task description:", error);
      toast.error("Failed to update task description.");
    } finally {
      setSavingDescription(false);
    }
  };

  const loadScalingPlan = async () => {
    if (!task.id || task.type !== "scaling") {
      setScalingPlan(null);
      return;
    }
    setScalingPlanLoading(true);
    try {
      let plan: ScalingPlan | null = null;
      if (task.content_type === "scalingplan" && task.object_id) {
        const planId = Number(task.object_id);
        if (!Number.isNaN(planId)) {
          const resp = await OptimizationScalingAPI.getScalingPlan(planId);
          plan = resp.data as any;
        }
      }
      if (!plan) {
        const resp = await OptimizationScalingAPI.listScalingPlans({
          task_id: task.id,
        });
        const plans = resp.data || [];
        plan = (plans[0] as any) || null;
      }
      setScalingPlan(plan);
    } catch (e) {
      console.error("Error loading scaling plan in TaskDetail:", e);
      setScalingPlan(null);
    } finally {
      setScalingPlanLoading(false);
    }
  };

  const loadAlertTask = async () => {
    if (!task.id || task.type !== "alert") {
      setAlertTask(null);
      return;
    }
    setAlertLoading(true);
    try {
      let detail = null;
      if (task.content_type === "alerttask" && task.object_id) {
        const alertId = Number(task.object_id);
        if (!Number.isNaN(alertId)) {
          const resp = await AlertingAPI.getAlertTask(alertId);
          detail = resp.data as any;
        }
      }
      if (!detail) {
        const resp = await AlertingAPI.listAlertTasks({ task_id: task.id });
        const items = resp.data || [];
        const score = (item: AlertTask) => {
          let value = 0;
          if (item.affected_entities && item.affected_entities.length > 0)
            value += 3;
          if (item.related_references && item.related_references.length > 0)
            value += 2;
          if (item.investigation_notes) value += 2;
          if (item.resolution_steps) value += 2;
          if (item.postmortem_root_cause) value += 1;
          if (item.postmortem_prevention) value += 1;
          return value;
        };
        const sorted = [...items].sort((a, b) => {
          const scoreDiff = score(b) - score(a);
          if (scoreDiff !== 0) return scoreDiff;
          const aTime = Date.parse(a.updated_at || a.created_at || "");
          const bTime = Date.parse(b.updated_at || b.created_at || "");
          return (
            (Number.isNaN(bTime) ? 0 : bTime) -
            (Number.isNaN(aTime) ? 0 : aTime)
          );
        });
        detail = sorted[0] || null;
      }
      if (!detail) {
        try {
          const created = await AlertingAPI.createAlertTask({
            task: task.id,
            alert_type: "spend_spike",
            severity: "medium",
            status: "open",
          } as any);
          detail = created.data as any;
        } catch (createError) {
          const fallback = await AlertingAPI.listAlertTasks({
            task_id: task.id,
          });
          const items = fallback.data || [];
          const score = (item: AlertTask) => {
            let value = 0;
            if (item.affected_entities && item.affected_entities.length > 0)
              value += 3;
            if (item.related_references && item.related_references.length > 0)
              value += 2;
            if (item.investigation_notes) value += 2;
            if (item.resolution_steps) value += 2;
            if (item.postmortem_root_cause) value += 1;
            if (item.postmortem_prevention) value += 1;
            return value;
          };
          const sorted = [...items].sort((a, b) => {
            const scoreDiff = score(b) - score(a);
            if (scoreDiff !== 0) return scoreDiff;
            const aTime = Date.parse(a.updated_at || a.created_at || "");
            const bTime = Date.parse(b.updated_at || b.created_at || "");
            return (
              (Number.isNaN(bTime) ? 0 : bTime) -
              (Number.isNaN(aTime) ? 0 : aTime)
            );
          });
          detail = sorted[0] || null;
        }
      }
      setAlertTask(detail);
    } catch (e) {
      console.error("Error loading alert task in TaskDetail:", e);
      setAlertTask(null);
    } finally {
      setAlertLoading(false);
    }
  };

  const loadExperiment = async () => {
    if (!task.id || task.type !== "experiment") {
      setExperiment(null);
      return;
    }
    setExperimentLoading(true);
    try {
      let exp: Experiment | null = null;
      if (task.object_id) {
        const experimentId = Number(task.object_id);
        if (!Number.isNaN(experimentId)) {
          const resp = await ExperimentAPI.getExperiment(experimentId);
          exp = resp.data as any;
        }
      }
      if (!exp) {
        const resp = await ExperimentAPI.listExperiments({});
        const experiments = Array.isArray(resp.data)
          ? resp.data
          : (resp.data as any)?.results || [];
        exp = experiments.find((e: Experiment) => e.task === task.id) || null;
      }
      setExperiment(exp);
    } catch (e) {
      console.error("Error loading experiment in TaskDetail:", e);
      setExperiment(null);
    } finally {
      setExperimentLoading(false);
    }
  };

  const loadOptimization = async () => {
    if (!task.id || task.type !== "optimization") {
      setOptimization(null);
      return;
    }
    setOptimizationLoading(true);
    try {
      let opt: Optimization | null = null;
      if (task.object_id) {
        const optimizationId = Number(task.object_id);
        if (!Number.isNaN(optimizationId)) {
          const resp = await OptimizationAPI.getOptimization(optimizationId);
          opt = resp.data as any;
        }
      }
      if (!opt) {
        const resp = await OptimizationAPI.listOptimizations({
          task_id: task.id,
        });
        const optimizations = Array.isArray(resp.data)
          ? resp.data
          : (resp.data as any)?.results || [];
        opt =
          optimizations.find((o: Optimization) => o.task === task.id) || null;
      }
      setOptimization(opt);
    } catch (e) {
      console.error("Error loading optimization in TaskDetail:", e);
      setOptimization(null);
    } finally {
      setOptimizationLoading(false);
    }
  };

  const loadReport = async () => {
    if (!task.id || task.type !== "report") {
      setReport(null);
      return;
    }
    setReportLoading(true);
    try {
      let reportData: ReportTask | null = null;
      if (task.object_id) {
        const reportId = Number(task.object_id);
        if (!Number.isNaN(reportId)) {
          try {
            const resp = await ReportAPI.getReport(reportId);
            reportData = resp.data;
          } catch (e) {
            console.warn(
              "Report object_id lookup failed, falling back to task lookup:",
              e,
            );
          }
        }
      }
      if (!reportData) {
        const resp = await ReportAPI.listReports({ task: task.id });
        const raw = resp.data as
          | ReportTask[]
          | { results?: ReportTask[] }
          | null
          | undefined;
        const list = Array.isArray(raw) ? raw : raw?.results ?? [];
        reportData =
          list.find(
            (item) =>
              Number((item as ReportTask & { task?: number }).task) === task.id,
          ) ??
          list[0] ??
          null;
      }
      setReport(reportData);
    } catch (e) {
      console.error("Error loading report in TaskDetail:", e);
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const loadPolicyUpdate = async () => {
    if (!task.id || task.type !== "platform_policy_update") {
      setPolicyUpdate(null);
      return;
    }
    setPolicyUpdateLoading(true);
    try {
      let update: PlatformPolicyUpdateData | null = null;
      if (task.content_type === "platformpolicyupdate" && task.object_id) {
        const resp = await PolicyAPI.get(Number(task.object_id));
        update = resp.data;
      }
      if (!update) {
        const resp = await PolicyAPI.list({ task_id: task.id });
        const updates = resp.data?.results || [];
        update = updates[0] || null;
      }
      setPolicyUpdate(update);
    } catch (e) {
      console.error("Error loading policy update:", e);
      setPolicyUpdate(null);
    } finally {
      setPolicyUpdateLoading(false);
    }
  };

  const loadRetrospective = async () => {
    if (!task.id || task.type !== "retrospective") {
      setRetrospective(null);
      return;
    }
    setRetrospectiveLoading(true);
    try {
      let detail: RetrospectiveTaskData | null = null;
      const projectId = task.project_id ?? task.project?.id;
      const linkedContentType = task.content_type;

      // task.object_id should only be used as retrospective id when the link is to a retrospective.
      if (linkedContentType === "retrospectivetask" && task.object_id) {
        const retrospectiveId = String(task.object_id);
        const resp = await RetrospectiveAPI.getRetrospective(retrospectiveId);
        detail = resp.data as RetrospectiveTaskData;
      }

      // Defensive fallback: decision-linked retrospective tasks store decision id in object_id.
      if (!detail && projectId != null) {
        if (linkedContentType && linkedContentType !== "retrospectivetask") {
          console.warn(
            "Retrospective task is not linked to retrospectivetask content type; falling back to campaign lookup.",
            {
              taskId: task.id,
              contentType: linkedContentType,
              objectId: task.object_id,
              projectId,
            },
          );
        }

        const listResp = await RetrospectiveAPI.getRetrospectives({
          campaign: String(projectId),
        });
        const items = Array.isArray(listResp.data)
          ? listResp.data
          : listResp.data?.results || [];
        detail =
          (Array.isArray(items) && (items[0] as RetrospectiveTaskData)) || null;
      }
      setRetrospective(detail);
    } catch (e) {
      console.error("Error loading retrospective in TaskDetail:", e);
      setRetrospective(null);
    } finally {
      setRetrospectiveLoading(false);
    }
  };

  const handleSaveRetrospective = async (payload: UpdateRetrospectiveData) => {
    if (!retrospective?.id) {
      throw new Error("Retrospective not loaded.");
    }
    try {
      await RetrospectiveAPI.updateRetrospective(
        String(retrospective.id),
        payload,
      );
      await loadRetrospective();
      toast.success("Retrospective updated.");
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update retrospective.";
      toast.error(message);
      throw error;
    }
  };

  // Sync start_date and due_date with task data when task data changes
  useEffect(() => {
    setStartDateInput(task.start_date ?? "");
    setDueDateInput(task.due_date ?? "");
  }, [task.start_date, task.due_date]);

  // Sync owner and approver selects with task data when they change
  useEffect(() => {
    setOwnerId(task.owner?.id?.toString() || "");
  }, [task.owner?.id]);
  useEffect(() => {
    setCurrentStatus(task?.status ?? "");
  }, [task?.status]);
  useEffect(() => {
    setCurrentApproverId(task.current_approver?.id?.toString() || "");
  }, [task.current_approver?.id]);

  const currentApproverLabel = useMemo(() => {
    if (!currentApproverId) return "Unassigned";
    const matched = approvers.find(
      (approver) => approver.id.toString() === currentApproverId,
    );
    if (matched?.username) return matched.username;
    if (matched?.email) return matched.email;
    return task.current_approver?.username || "Unassigned";
  }, [approvers, currentApproverId, task.current_approver?.username]);

  const cancelApproverEdit = () => {
    setCurrentApproverId(task.current_approver?.id?.toString() || "");
    setEditingApprover(false);
  };

  const handleOwnerChange = async (value: string) => {
    setOwnerId(value);
    try {
      const payload: Partial<TaskData> = {
        owner_id: value ? Number(value) : null,
      };
      const response = await TaskAPI.updateTask(task.id!, payload);
      const updatedTask: TaskData = response.data;
      Object.assign(task, updatedTask);
      updateTask(task.id!, updatedTask);
      toast.success("Owner updated.");
      onTaskUpdate?.(updatedTask);
    } catch (error: any) {
      const message =
        error?.response?.data?.owner_id?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update owner.";
      toast.error(message);
      setOwnerId(task.owner?.id?.toString() || "");
    }
  };

  const handleStatusChange = async (targetStatus: string) => {
    if (!task.id) return;
    if (targetStatus === task.status) return;
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["SUBMITTED", "CANCELLED"],
      SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
      UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
      APPROVED: ["LOCKED", "CANCELLED"],
      REJECTED: ["DRAFT", "CANCELLED"],
      LOCKED: ["UNLOCK"],
      CANCELLED: ["DRAFT"],
    };
    const allowed = validTransitions[task.status ?? ""] ?? [];
    if (!allowed.includes(targetStatus)) {
      toast.error(`Cannot change status from ${task.status} to ${targetStatus}`);
      return;
    }
    setSavingStatus(true);
    try {
      let response: any;
      if (targetStatus === "SUBMITTED") {
        response = await TaskAPI.submitTask(task.id);
      } else if (targetStatus === "UNDER_REVIEW") {
        response = await TaskAPI.startReview(task.id);
      } else if (targetStatus === "APPROVED") {
        response = await TaskAPI.makeApproval(task.id, { action: "approve" });
      } else if (targetStatus === "REJECTED") {
        response = await TaskAPI.makeApproval(task.id, { action: "reject" });
      } else if (targetStatus === "LOCKED") {
        response = await TaskAPI.lock(task.id);
      } else if (targetStatus === "CANCELLED") {
        response = await TaskAPI.cancelTask(task.id);
      } else if (targetStatus === "DRAFT") {
        response = await TaskAPI.revise(task.id);
      } else if (targetStatus === "UNLOCK") {
        response = await TaskAPI.unlock(task.id);
      } else {
        toast.error("Invalid status transition");
        return;
      }
      const updatedTask: TaskData = (response?.data?.task ??
        response?.data) as TaskData;
      Object.assign(task, updatedTask);
      updateTask(task.id!, updatedTask);
      toast.success("Status updated.");
      setCurrentStatus(updatedTask.status ?? "");
      onTaskUpdate?.(updatedTask);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update status.";
      toast.error(message);
    } finally {
      setSavingStatus(false);
    }
  };

  const cancelDateEdits = () => {
    setStartDateInput(task.start_date ?? "");
    setDueDateInput(task.due_date ?? "");
    setEditingStartDate(false);
    setEditingDueDate(false);
  };

  const buildTaskShareContent = () => {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    const taskUrl = `${origin}/tasks/${task.id}`;
    const title = task.summary || `Task #${task.id}`;
    return `Task shared: ${title}\n${taskUrl}`;
  };

  const handleShareTask = async (
    targetChatIds: number[],
    targetUserIds: number[],
  ) => {
    if (!task?.id || !projectId || !currentUserId) {
      toast.error("Unable to share task right now.");
      return;
    }
    if (targetChatIds.length === 0 && targetUserIds.length === 0) {
      toast.error("Select at least one chat or user.");
      return;
    }

    setSharingTask(true);
    try {
      const messageContent = buildTaskShareContent();
      const resolvedChatIds: number[] = [...targetChatIds];
      const numericProjectId = Number(projectId);

      for (const userId of targetUserIds) {
        const existingChat = await findPrivateChat(numericProjectId, userId);
        if (existingChat) {
          resolvedChatIds.push(existingChat.id);
          continue;
        }

        const newChat = await createChat({
          type: "private",
          project_id: numericProjectId,
          participant_ids: [userId],
        });
        resolvedChatIds.push(newChat.id);
      }

      const uniqueChatIds = Array.from(new Set(resolvedChatIds));
      await Promise.all(
        uniqueChatIds.map((chatId) =>
          sendMessage({ chat_id: chatId, content: messageContent }),
        ),
      );

      toast.success("Task shared successfully.");
      setShareDialogOpen(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to share task.";
      toast.error(message);
    } finally {
      setSharingTask(false);
    }
  };

  useEffect(() => {
    const loadTaskComments = async () => {
      if (!task.id) return;
      try {
        setTaskCommentsLoading(true);
        setTaskCommentsError(null);
        const list = await TaskAPI.getComments(task.id);
        setTaskComments(list);
      } catch (error: any) {
        console.error("Error loading task comments:", error);
        const message =
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to load comments. Please try again.";
        setTaskCommentsError(message);
      } finally {
        setTaskCommentsLoading(false);
      }
    };

    loadTaskComments();
  }, [task.id]);

  // Load scaling plan for scaling tasks
  useEffect(() => {
    if (task.type === "scaling") {
      loadScalingPlan();
    } else {
      setScalingPlan(null);
    }
  }, [task.id, task.type, task.content_type, task.object_id]);

  // Load alert details for alert tasks
  useEffect(() => {
    if (task.type === "alert") {
      loadAlertTask();
    } else {
      setAlertTask(null);
    }
  }, [task.id, task.type]);

  // Load experiment for experiment tasks
  useEffect(() => {
    if (task.type === "experiment") {
      loadExperiment();
    } else {
      setExperiment(null);
    }
  }, [task.id, task.type, task.object_id]);

  // Load optimization for optimization tasks
  useEffect(() => {
    if (task.type === "optimization") {
      loadOptimization();
    } else {
      setOptimization(null);
    }
  }, [task.id, task.type, task.object_id]);

  // Load report for report tasks
  useEffect(() => {
    if (task.type === "report") {
      loadReport();
    } else {
      setReport(null);
    }
  }, [task.id, task.type, task.object_id]);

  // Load policy update for platform_policy_update tasks
  useEffect(() => {
    if (task.type === "platform_policy_update") {
      loadPolicyUpdate();
    } else {
      setPolicyUpdate(null);
    }
  }, [task.id, task.type, task.object_id]);

  // Load retrospective for retrospective tasks
  useEffect(() => {
    if (task.type === "retrospective") {
      loadRetrospective();
    } else {
      setRetrospective(null);
    }
  }, [task.id, task.type, task.object_id]);

  useEffect(() => {
    const shouldRenderRetrospective = task?.type === "retrospective";
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/d1c5a812-8fba-4f4b-91ec-d69ecfc99679", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "taskdetail-retro-render-check-v1",
        hypothesisId: "H1",
        location: "TaskDetail.tsx:renderStateEffect",
        message: "Render state snapshot for retrospective section",
        data: {
          taskId: task?.id ?? null,
          taskType: task?.type ?? null,
          shouldRenderRetrospective,
          retrospectiveLoading,
          hasRetrospectiveData: Boolean(retrospective),
          taskObjectId: task?.object_id ?? null,
          taskContentType: task?.content_type ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [
    task?.id,
    task?.type,
    retrospectiveLoading,
    retrospective,
    task?.object_id,
    task?.content_type,
  ]);

  // Load client communication for communication tasks
  useEffect(() => {
    const loadCommunication = async () => {
      if (!task.id || task.type !== "communication") {
        setCommunication(null);
        return;
      }

      try {
        setCommunicationLoading(true);
        setCommunicationError(null);

        const resp = await ClientCommunicationAPI.listByTask(task.id);
        const data = (resp.data as any) || [];
        const list: ClientCommunicationData[] = Array.isArray(data)
          ? data
          : data.results || [];

        setCommunication(list[0] || null);
      } catch (error: any) {
        console.error("Error loading client communication:", error);
        const message =
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to load client communication details.";
        setCommunicationError(message);
        setCommunication(null);
      } finally {
        setCommunicationLoading(false);
      }
    };

    loadCommunication();
  }, [task.id, task.type, task.content_type, task.object_id]);

  const handleSaveDates = async () => {
    try {
      setSavingDates(true);

      const response = await TaskAPI.updateTask(task.id!, {
        start_date: startDateInput || undefined,
        due_date: dueDateInput || undefined,
      });

      const updatedTask: TaskData = response.data;

      // Sync task object and global store
      Object.assign(task, updatedTask);
      updateTask(task.id!, updatedTask);

      // Sync input boxes again to prevent backend returning slightly different formats
      setStartDateInput(updatedTask.start_date ?? "");
      setDueDateInput(updatedTask.due_date ?? "");

      // Success toast
      toast.success("Dates saved successfully.");
      setEditingStartDate(false);
      setEditingDueDate(false);
    } catch (error: any) {
      console.error("Error updating task dates:", error);

      // Try to get a more friendly message from backend error
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update task dates. Please try again.";

      // Failure toast
      toast.error(message);
    } finally {
      setSavingDates(false);
    }
  };

  // Conditional rendering based on task status
  useEffect(() => {
    if (task.type === "asset") {
      setIsReviewing(false);
      setIsLocked(false);
      setShowRevise(false);
      return;
    }

    const canReview = canReviewTask();
    const canRevise = canReviseTask();

    if (task.status === "UNDER_REVIEW") {
      if (canReview) {
        setIsReviewing(true);
      } else {
        setIsReviewing(false);
      }
    } else if (task.status === "LOCKED") {
      setIsReviewing(false);
      setIsLocked(true);
    } else if (task.status === "REJECTED") {
      if (canRevise) {
        setShowRevise(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.status, task.type, task.current_approver?.id, currentUser?.id]);

  // Get approvers list - project-based (same project as the task)
  useEffect(() => {
    const fetchApprovers = async () => {
      // If the task has no project yet, clear approver list
      if (!task.project?.id) {
        setApprovers([]);
        return;
      }

      try {
        setLoadingApprovers(true);
        const members = await ProjectAPI.getProjectMembers(task.project.id);
        const approverList =
          members?.map((member) => ({
            id: member.user.id,
            username: member.user.username || member.user.email || "",
            email: member.user.email || "",
          })) || [];
        setApprovers(approverList);
      } catch (error) {
        console.error("Error fetching approvers:", error);
        setApprovers([]);
      } finally {
        setLoadingApprovers(false);
      }
    };
    fetchApprovers();
  }, [task.project?.id]);

  // Update current approver of the task
  const handleCurrentApproverChange = async (value: string) => {
    setCurrentApproverId(value);

    try {
      const payload: any = {
        current_approver_id: value ? Number(value) : null,
      };

      const response = await TaskAPI.updateTask(task.id!, payload);
      const updatedTask: TaskData = response.data;

      // Sync task object and global store
      Object.assign(task, updatedTask);
      updateTask(task.id!, updatedTask);

      toast.success("Current approver updated.");
      setEditingApprover(false);
    } catch (error: any) {
      console.error("Error updating current approver:", error);

      const message =
        error?.response?.data?.current_approver_id?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update current approver. Please try again.";

      toast.error(message);

      // Revert select value to previous state on failure
      setCurrentApproverId(task.current_approver?.id?.toString() || "");
    }
  };

  // Get approval history
  useEffect(() => {
    const fetchApprovalHistory = async () => {
      try {
        setLoadingHistory(true);
        const response = await TaskAPI.getApprovalHistory(task.id!);
        setApprovalHistory(response.data.history || []);
      } catch (error) {
        console.error("Error fetching approval history:", error);
        setApprovalHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchApprovalHistory();
  }, [task.id]);

  // Get budget request and budget pool data if task type is budget
  useEffect(() => {
    const fetchBudgetData = async () => {
      if (task.type !== "budget" || !task.object_id) return;

      try {
        setLoadingBudgetData(true);

        // Get budget request
        const budgetResponse = await BudgetAPI.getBudgetRequest(
          Number(task.object_id),
        );
        const budgetData = budgetResponse.data;
        setBudgetRequest(budgetData);

        // Get budget pool if budget request has budget_pool
        if (budgetData.budget_pool) {
          const poolResponse = await BudgetAPI.getBudgetPool(
            budgetData.budget_pool,
          );
          const poolData = poolResponse.data;
          setBudgetPool(poolData);
        }
      } catch (error) {
        console.error("Error fetching budget data:", error);
      } finally {
        setLoadingBudgetData(false);
      }
    };

    fetchBudgetData();
  }, [task.type, task.object_id, budgetRequest?.status]);

  // Helper function to get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-50 text-green-800";
      case "UNDER_REVIEW":
        return "bg-blue-50 text-blue-800";
      case "SUBMITTED":
        return "bg-amber-50 text-amber-800";
      case "REJECTED":
        return "bg-red-50 text-red-800";
      case "DRAFT":
        return "bg-slate-50 text-slate-800";
      case "LOCKED":
        return "bg-slate-50 text-slate-800";
      default:
        return "bg-slate-50 text-slate-800";
    }
  };

  // Helper function to get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 text-red-800";
      case "MEDIUM":
        return "bg-orange-100 text-orange-800";
      case "LOW":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const communicationTypeLabel = useMemo(() => {
    const mapping: Record<string, string> = {
      budget_change: "Budget Change",
      creative_approval: "Creative Approval",
      kpi_update: "KPI Update",
      targeting_change: "Targeting Change",
      other: "Other",
    };
    if (!communication?.communication_type) return "Not set";
    return (
      mapping[communication.communication_type] ||
      communication.communication_type
    );
  }, [communication?.communication_type]);

  const formatImpactedAreas = () => {
    if (
      !communication?.impacted_areas ||
      communication.impacted_areas.length === 0
    ) {
      return "None selected";
    }
    const mapping: Record<string, string> = {
      budget: "Budget",
      creative: "Creative",
      kpi: "KPIs",
      targeting: "Targeting",
    };
    return communication.impacted_areas
      .map((area) => mapping[area] || area)
      .join(", ");
  };

  const updateCommunicationDraftField = <
    K extends keyof Omit<ClientCommunicationPayload, "task">,
  >(
    field: K,
    value: Omit<ClientCommunicationPayload, "task">[K],
  ) => {
    setCommunicationDraft((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev,
    );
  };

  const toggleCommunicationImpactedArea = (
    area: ClientCommunicationPayload["impacted_areas"][number],
  ) => {
    setCommunicationDraft((prev) => {
      if (!prev) return prev;
      const hasArea = prev.impacted_areas.includes(area);
      return {
        ...prev,
        impacted_areas: hasArea
          ? prev.impacted_areas.filter((value) => value !== area)
          : [...prev.impacted_areas, area],
      };
    });
  };

  const handleSaveCommunication = async () => {
    if (!communication || !communicationDraft) return;

    const requiredActions = (communicationDraft.required_actions || "").trim();
    const stakeholders = (communicationDraft.stakeholders || "").trim();
    const notes = (communicationDraft.notes || "").trim();

    if (!communicationDraft.communication_type) {
      toast.error("Communication type is required.");
      return;
    }
    if (communicationDraft.impacted_areas.length === 0) {
      toast.error("Select at least one impacted area.");
      return;
    }
    if (!requiredActions) {
      toast.error("Required actions is required.");
      return;
    }

    const payload: Partial<ClientCommunicationPayload> = {
      communication_type: communicationDraft.communication_type,
      stakeholders,
      impacted_areas: communicationDraft.impacted_areas,
      required_actions: requiredActions,
      client_deadline: communicationDraft.client_deadline || null,
      notes,
    };

    try {
      setSavingCommunication(true);
      await ClientCommunicationAPI.update(communication.id, payload);
      setCommunication((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
            }
          : prev,
      );
      setEditingCommunication(false);
      toast.success("Client communication updated.");
    } catch (error) {
      console.error("Error updating client communication:", error);
      toast.error("Failed to update client communication.");
    } finally {
      setSavingCommunication(false);
    }
  };

  const handleCancelCommunicationEdit = () => {
    setEditingCommunication(false);
    if (!communication) {
      setCommunicationDraft(null);
      return;
    }
    setCommunicationDraft({
      communication_type: communication.communication_type,
      stakeholders: communication.stakeholders || "",
      impacted_areas: Array.isArray(communication.impacted_areas)
        ? [...communication.impacted_areas]
        : [],
      required_actions: communication.required_actions || "",
      client_deadline: communication.client_deadline || null,
      notes: communication.notes || "",
    });
  };

  // Helper function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "date not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Check if current user can review this task
  const canReviewTask = () => {
    if (task.type === "asset") return false;
    if (!currentUser?.id || !task?.current_approver?.id) return false;

    return currentUser.id.toString() === task.current_approver.id.toString();
  };

  // Check if current user can revise this task
  const canReviseTask = () => {
    if (!currentUser?.id || !task?.owner?.id) return false;

    return currentUser.id.toString() === task.owner.id.toString();
  };

  // Handle start review button click
  const handleStartReview = async () => {
    if (task.type === "asset") {
      toast.error("Asset tasks must be reviewed via the asset panel.");
      return;
    }

    if (!canReviewTask()) {
      toast.error("You don't have permission to review this task");
      return;
    }

    try {
      // Call task start_review API
      const taskResponse = await TaskAPI.startReview(task.id!);
      console.log("Review started for task:", task?.id);

      // TODO: Probably need to remove this after future task backend implementation
      // If task type is budget and has object_id, also call budget_approval start_review API
      if (task.type === "budget" && task.object_id) {
        try {
          await startBudgetReview(Number(task.object_id));
          console.log("Review started for budget request:", task.object_id);

          // Refresh budget request data to update UI
          const budgetResponse = await BudgetAPI.getBudgetRequest(
            Number(task.object_id),
          );
          setBudgetRequest(budgetResponse.data);
        } catch (budgetError) {
          console.error("Error starting budget review:", budgetError);
          // Don't fail the entire operation if budget review fails
          // The task review has already succeeded
        }
      }

      setIsReviewing(true);

      if (taskResponse.data.task) {
        Object.assign(task, taskResponse.data.task);
        updateTask(task.id!, taskResponse.data.task);
      }
    } catch (error) {
      console.error("Error starting review:", error);
      toast.error("Failed to start review. Please try again.");
    }
  };

  // Handle start revise button click
  const handleStartRevise = async () => {
    if (!canReviseTask()) {
      toast.error("You don't have permission to revise this task");
      return;
    }

    try {
      // Call revise API
      const response = await TaskAPI.revise(task.id!);
      setIsRevising(true);
      setShowRevise(false);
      console.log("Revise started for task:", task?.id);

      if (response.data.task) {
        Object.assign(task, response.data.task);
        updateTask(task.id!, response.data.task);
      }
    } catch (error) {
      console.error("Error starting revise:", error);
      toast.error("Failed to start revise. Please try again.");
    }
  };

  // Handle approve button click: approve --> lock or forward to next approver
  const handleApprove = async () => {
    const chainProgress: ApprovalChainProgress | null | undefined =
      task.approval_chain_progress;
    const isChainMode = !!chainProgress;

    try {
      // Call task make_approval API
      const taskResponse = await TaskAPI.makeApproval(task.id!, {
        action: "approve",
        comment: reviewComment,
      });

      // TODO: Probably need to remove this after future task backend implementation
      // If task type is budget and has object_id, also call budget_approval makeDecision API
      if (task.type === "budget" && task.object_id) {
        try {
          const budgetDecisionData = {
            decision: "approve" as const,
            comment: reviewComment,
            ...(nextApprover && { next_approver: parseInt(nextApprover) }),
          };

          await makeBudgetDecision(Number(task.object_id), budgetDecisionData);
          console.log("Budget request approved:", task.object_id);

          // Refresh budget request data to update UI
          const budgetResponse = await BudgetAPI.getBudgetRequest(
            Number(task.object_id),
          );
          setBudgetRequest(budgetResponse.data);
        } catch (budgetError) {
          console.error("Error approving budget request:", budgetError);
          // Don't fail the entire operation if budget approval fails
          // The task approval has already succeeded
        }
      }

      // Update task data with the response
      if (taskResponse.data.task) {
        // Update the task object with new data
        Object.assign(task, taskResponse.data.task);
        // Force re-render by updating a state variable
        setApprovalHistory((prev) => [...prev]);
        // Update global store
        updateTask(task.id!, taskResponse.data.task);
      }

      // Use the UPDATED task status from makeApproval response to drive next action.
      // This prevents calling forward/lock incorrectly when the backend auto-advances
      // the chain (APPROVED → UNDER_REVIEW) before the frontend can react.
      const updatedStatus = taskResponse.data.task?.status;

      if (updatedStatus === "UNDER_REVIEW") {
        // Backend auto-advanced to the next chain step — no further action needed.
        const nextStepApprover = taskResponse.data.task?.current_approver;
        toast.success(
          nextStepApprover
            ? `Task approved — forwarded to ${nextStepApprover.username}`
            : "Task approved — forwarded to next approver",
        );
      } else {
        // Task is APPROVED
        if (nextApprover) {
          // Legacy mode: forward to selected next approver
          const forwardResponse = await TaskAPI.forward(task.id!, {
            next_approver_id: parseInt(nextApprover),
            comment: reviewComment,
          });
          if (forwardResponse.data.task) {
            Object.assign(task, forwardResponse.data.task);
            updateTask(task.id!, forwardResponse.data.task);
          }
          toast.success("Task approved and forwarded to next approver");
        } else {
          toast.success("Task approved successfully");
        }
      }

      // Reset form and close review section
      setIsReviewing(false);
      setReviewComment("");
      setNextApprover(null);

      // Refresh approval history
      const historyResponse = await TaskAPI.getApprovalHistory(task.id!);
      setApprovalHistory(historyResponse.data.history || []);

      console.log(
        "Task approved successfully. Status updated to:",
        taskResponse.data.task?.status,
      );
    } catch (error: any) {
      console.error("Error approving task:", error);
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to approve task. Please try again.";
      toast.error(message);
    }
  };

  // Handle reject button click
  const handleReject = async () => {
    if (!reviewComment.trim()) {
      toast.error("Comment is required when rejecting a task");
      return;
    }

    try {
      // Call task make_approval API
      const taskResponse = await TaskAPI.makeApproval(task.id!, {
        action: "reject",
        comment: reviewComment,
      });

      // TODO: Probably need to remove this after future task backend implementation
      // If task type is budget and has object_id, also call budget_approval makeDecision API
      if (task.type === "budget" && task.object_id) {
        try {
          const budgetDecisionData = {
            decision: "reject" as const,
            comment: reviewComment,
          };

          await makeBudgetDecision(Number(task.object_id), budgetDecisionData);
          console.log("Budget request rejected:", task.object_id);

          // Refresh budget request data to update UI
          const budgetResponse = await BudgetAPI.getBudgetRequest(
            Number(task.object_id),
          );
          setBudgetRequest(budgetResponse.data);
        } catch (budgetError) {
          console.error("Error rejecting budget request:", budgetError);
          // Don't fail the entire operation if budget rejection fails
          // The task rejection has already succeeded
        }
      }

      // Update task data with the response
      if (taskResponse.data.task) {
        Object.assign(task, taskResponse.data.task);
        updateTask(task.id!, taskResponse.data.task);
        setShowRevise(true);
      }

      toast.success("Task rejected");

      // Reset form and close review section
      setIsReviewing(false);
      setReviewComment("");
      setNextApprover(null);

      // Refresh approval history
      const historyResponse = await TaskAPI.getApprovalHistory(task.id!);
      setApprovalHistory(historyResponse.data.history || []);
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast.error("Failed to reject task. Please try again.");
    }
  };

  const formatTaskCommentAuthor = (comment: TaskComment) => {
    const author = comment.user;
    if (!author) {
      return `User #${comment.id}`;
    }

    // Prefer the currentUser label when IDs match
    if (
      currentUser?.id !== undefined &&
      Number(currentUser.id) === Number(author.id)
    ) {
      return (
        currentUser.username ||
        currentUser.email ||
        author.username ||
        author.email ||
        `User #${author.id}`
      );
    }

    return author.username || author.email || `User #${author.id}`;
  };

  const handleAddTaskComment = async () => {
    const body = taskCommentInput.trim();
    if (!body || taskCommentSubmitting || !task.id) return;

    try {
      setTaskCommentSubmitting(true);
      const created = await TaskAPI.createComment(task.id, { body });
      setTaskCommentInput("");
      setTaskComments((prev) => [created, ...prev]);
      setTaskCommentsError(null);
    } catch (error: any) {
      console.error("Error adding task comment:", error);
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to add comment. Please try again.";
      setTaskCommentsError(message);
    } finally {
      setTaskCommentSubmitting(false);
    }
  };

  const jiraDetailRowClass =
    "grid min-w-0 grid-cols-[110px_minmax(0,1fr)] items-start gap-3 py-1.5";
  const jiraDetailLabelClass =
    "pt-2 text-sm font-normal tracking-normal text-[#44546f]";
  const jiraDetailControlClass =
    "mt-0 block h-9 w-full min-w-0 rounded-md border border-[#d0d4db] bg-white px-2.5 pr-8 py-1.5 text-sm text-[#172b4d] transition-colors hover:border-[#8590a2] focus:border-[#0c66e4] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
  const jiraDetailValueTextClass = "pt-2 text-sm text-[#172b4d] min-w-0";
  const jiraDetailTagClass =
    "inline-flex items-center rounded-[3px] border border-[#d0d4db] bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-[#172b4d]";
  const getDetailDueTone = (dateString?: string): JiraBoardDueTone => {
    if (!dateString) return "default";
    const due = new Date(dateString);
    if (Number.isNaN(due.getTime())) return "default";

    const now = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.ceil(
      (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) return "danger";
    if (diffDays <= 3) return "warning";
    return "default";
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* Left section */}
        <div className="space-y-6">
          {/* Task Summary & Description */}
          <section>
            {!editingSummary ? (
              <div className="mb-6">
                <h1
                  data-testid="task-summary-title"
                  className="text-xl font-semibold text-gray-900 cursor-text rounded-md px-1 -mx-1 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  tabIndex={0}
                  onClick={() => setEditingSummary(true)}
                  onDoubleClick={() => setEditingSummary(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setEditingSummary(true);
                    }
                  }}
                >
                  {task?.summary || "Task Summary"}
                </h1>
                {task?.content_type === "decision" && task?.object_id ? (
                  <p className="text-sm text-slate-500 mt-1">
                    From{" "}
                    <Link
                      href={`/decisions-v2/${task.object_id}${
                        projectId ? `?project_id=${projectId}` : ""
                      }`}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Decision #{task.object_id}
                    </Link>
                  </p>
                ) : null}
                <div className="mt-3">
                  <OriginMeetingBlock origin={task?.origin_meeting ?? null} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-6 w-full">
                <input
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  placeholder="Optional if not mentioned above."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSummary}
                    disabled={savingSummary}
                    className={`px-3 py-1.5 text-sm rounded-md text-white ${
                      savingSummary
                        ? "bg-indigo-300"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {savingSummary ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSummary(false);
                      setSummaryDraft(task.summary || "");
                    }}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <Accordion type="multiple" defaultValue={["item-1"]}>
              <AccordionItem value="item-1" className="border-none">
                <AccordionTrigger>
                  <h2 data-testid="task-description-heading" className="text-base font-semibold text-gray-900">
                    Task Description
                  </h2>
                </AccordionTrigger>
                <AccordionContent>
                  {!editingDescription ? (
                    <div
                      className={`cursor-text rounded-md px-1 py-1 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 ${
                        task?.description ? "min-h-[28px]" : "min-h-[36px]"
                      }`}
                      tabIndex={0}
                      onClick={() => setEditingDescription(true)}
                      onDoubleClick={() => setEditingDescription(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setEditingDescription(true);
                        }
                      }}
                    >
                      <p
                        className={`whitespace-pre-wrap break-words text-sm leading-5 ${
                          task?.description ? "text-gray-700" : "text-gray-400"
                        }`}
                      >
                        {task?.description || "Click to add description"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <CommentStyleTextarea
                        textareaRef={descriptionTextareaRef}
                        autoFocus
                        rows={3}
                        value={descriptionDraft}
                        onChange={(e) => {
                          setDescriptionDraft(e.target.value);
                          resizeDescriptionTextarea();
                        }}
                        onInput={resizeDescriptionTextarea}
                        placeholder="Optional if not mentioned above."
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveDescription}
                          disabled={savingDescription}
                          className={`px-3 py-1.5 text-sm rounded-md text-white ${
                            savingDescription
                              ? "bg-indigo-300"
                              : "bg-indigo-600 hover:bg-indigo-700"
                          }`}
                        >
                          {savingDescription ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDescription(false);
                            setDescriptionDraft(task.description || "");
                          }}
                          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          {task?.type === "alert" && (
            <>
              {alertLoading && (
                <div className="border-t border-slate-200 pt-5">
                  <p className="text-sm text-gray-500">
                    Loading alert details...
                  </p>
                </div>
              )}
              {!alertLoading && alertTask && (
                <AlertDetail
                  alert={alertTask}
                  projectId={task.project?.id ?? task.project_id}
                  onRefresh={loadAlertTask}
                />
              )}
              {!alertLoading && !alertTask && (
                <div className="border-t border-slate-200 pt-5">
                  <p className="text-sm text-gray-500">
                    No alert details found.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Scaling Plan & Steps for scaling tasks */}
          {task?.type === "scaling" && scalingPlan && (
            <ScalingDetail
              plan={scalingPlan}
              loading={scalingPlanLoading}
              onRefresh={loadScalingPlan}
            />
          )}

          {/* Experiment detail for experiment tasks */}
          {task?.type === "experiment" && experiment && (
            <ExperimentDetail
              experiment={experiment}
              loading={experimentLoading}
              onRefresh={loadExperiment}
            />
          )}

          {/* Optimization detail for optimization tasks */}
          {task?.type === "optimization" && task.id && (
            <OptimizationDetail
              optimization={optimization}
              taskId={task.id}
              loading={optimizationLoading}
              onRefresh={loadOptimization}
            />
          )}

          {/* Report detail for report tasks */}
          {task?.type === "report" && (
            <ReportDetail
              report={report}
              loading={reportLoading}
              onRefresh={loadReport}
            />
          )}

          {/* Platform Policy Update detail */}
          {task?.type === "platform_policy_update" && (
            <PlatformPolicyUpdateDetail
              policyUpdate={policyUpdate ?? undefined}
              loading={policyUpdateLoading}
              onRefresh={loadPolicyUpdate}
            />
          )}

          {/* Client Communication details for communication tasks */}
          {task?.type === "communication" && (
            <section className="border-t border-slate-200 pt-5">
              <div className="mb-3 flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">
                  Client Communication
                </h2>
              </div>

              {communicationLoading && (
                <p className="py-2 text-sm text-slate-500">
                  Loading details...
                </p>
              )}

              {communicationError && !communicationLoading && (
                <p className="py-2 text-sm text-red-600">
                  {communicationError}
                </p>
              )}

              {communication &&
                !communicationLoading &&
                !communicationError && (
                  <>
                    {!editingCommunication ? (
                      <div className="divide-y divide-slate-200">
                        <div className="flex items-center justify-end px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setEditingCommunication(true)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Communication Type
                          </p>
                          <p className="text-sm leading-6 text-slate-900">
                            {communicationTypeLabel}
                          </p>
                        </div>

                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Stakeholders
                          </p>
                          <p className="text-sm leading-6 text-slate-900 whitespace-pre-wrap">
                            {communication.stakeholders?.trim() ||
                              "No stakeholders recorded"}
                          </p>
                        </div>

                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Impacted Areas
                          </p>
                          <p className="text-sm leading-6 text-slate-900">
                            {formatImpactedAreas()}
                          </p>
                        </div>

                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Required Actions
                          </p>
                          <p className="text-sm leading-6 text-slate-900 whitespace-pre-wrap">
                            {communication.required_actions ||
                              "No actions recorded"}
                          </p>
                        </div>

                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Client Deadline
                          </p>
                          <p className="text-sm leading-6 text-slate-900">
                            {communication.client_deadline
                              ? formatDate(communication.client_deadline)
                              : "No deadline set"}
                          </p>
                        </div>

                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Notes
                          </p>
                          <p className="text-sm leading-6 text-slate-900 whitespace-pre-wrap">
                            {communication.notes?.trim() || "No notes recorded"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      communicationDraft && (
                        <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Communication Type
                              </label>
                              <select
                                value={communicationDraft.communication_type}
                                onChange={(e) =>
                                  updateCommunicationDraftField(
                                    "communication_type",
                                    e.target
                                      .value as ClientCommunicationPayload["communication_type"],
                                  )
                                }
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                              >
                                {COMMUNICATION_TYPE_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Stakeholders
                              </label>
                              <AutoResizeTextarea
                                value={communicationDraft.stakeholders || ""}
                                onChange={(e) =>
                                  updateCommunicationDraftField(
                                    "stakeholders",
                                    e.target.value,
                                  )
                                }
                                placeholder="List client contacts and internal team members involved."
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Impacted Areas
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {IMPACTED_AREA_OPTIONS.map((option) => {
                                  const active =
                                    communicationDraft.impacted_areas.includes(
                                      option.value,
                                    );
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() =>
                                        toggleCommunicationImpactedArea(
                                          option.value,
                                        )
                                      }
                                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                        active
                                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Required Actions
                              </label>
                              <AutoResizeTextarea
                                value={
                                  communicationDraft.required_actions || ""
                                }
                                onChange={(e) =>
                                  updateCommunicationDraftField(
                                    "required_actions",
                                    e.target.value,
                                  )
                                }
                                placeholder="Describe the actions required in response."
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Client Deadline
                              </label>
                              <input
                                type="date"
                                value={communicationDraft.client_deadline || ""}
                                onChange={(e) =>
                                  updateCommunicationDraftField(
                                    "client_deadline",
                                    e.target.value || null,
                                  )
                                }
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Notes
                              </label>
                              <AutoResizeTextarea
                                value={communicationDraft.notes || ""}
                                onChange={(e) =>
                                  updateCommunicationDraftField(
                                    "notes",
                                    e.target.value,
                                  )
                                }
                                placeholder="Any additional context or follow-up details."
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelCommunicationEdit}
                              disabled={savingCommunication}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveCommunication}
                              disabled={savingCommunication}
                              className={`rounded-md px-3 py-1.5 text-sm text-white ${
                                savingCommunication
                                  ? "bg-indigo-300"
                                  : "bg-indigo-600 hover:bg-indigo-700"
                              }`}
                            >
                              {savingCommunication ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </>
                )}
            </section>
          )}

          {/* Dynamic Content based on task type */}
          {task?.type === "budget" && (
            <BudgetRequestDetail
              budgetRequest={budgetRequest || undefined}
              budgetPool={budgetPool || undefined}
              loading={loadingBudgetData}
            />
          )}
          {task?.type === "asset" && (
            <AssetDetail
              taskId={task.id}
              assetId={
                task.content_type === "asset" ? task.object_id || null : null
              }
              hideComments={true}
            />
          )}
          {task?.type === "retrospective" && (
            <RetrospectiveDetail
              retrospective={retrospective || undefined}
              loading={retrospectiveLoading}
              onRefresh={loadRetrospective}
              onSave={handleSaveRetrospective}
            />
          )}

          {/* Attachments */}
          {task?.id && <Attachments taskId={task.id} />}

          {/* Subtasks - Only show if task is not a subtask */}
          {task?.id && !task.is_subtask && (
            <Subtasks
              taskId={task.id}
              taskProjectId={task.project_id || task.project?.id}
              parentTaskIsSubtask={task.is_subtask}
            />
          )}

          {/* Linked Work Items */}
          {task?.id && <LinkedWorkItems taskId={task.id} />}

          {/* Task-level Comments (all task types) */}
          <section data-testid="task-comments-section" className="flex flex-col gap-3">
            <h2 data-testid="task-comments-heading" className="text-lg font-semibold text-gray-900">Comments</h2>

            {/* Input box */}
            <div>
              <CommentStyleTextarea
                textareaRef={taskCommentTextareaRef}
                value={taskCommentInput}
                onChange={(e) => {
                  setTaskCommentInput(e.target.value);
                  resizeTaskCommentTextarea();
                }}
                onInput={resizeTaskCommentTextarea}
                rows={3}
                placeholder="Add a comment about this task..."
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddTaskComment}
                  disabled={!taskCommentInput.trim() || taskCommentSubmitting}
                  className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                    taskCommentSubmitting || !taskCommentInput.trim()
                      ? "bg-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {taskCommentSubmitting ? "Adding..." : "Add Comment"}
                </button>
              </div>
            </div>

            {/* Comments list */}
            {taskCommentsLoading && (
              <p className="text-sm text-gray-500">Loading comments...</p>
            )}
            {taskCommentsError && !taskCommentsLoading && (
              <p className="text-sm text-red-600">{taskCommentsError}</p>
            )}
            {!taskCommentsLoading &&
              !taskCommentsError &&
              taskComments.length === 0 && (
                <p className="text-sm text-gray-500">No comments yet.</p>
              )}
            {!taskCommentsLoading &&
              !taskCommentsError &&
              taskComments.length > 0 && (
                <div className="space-y-3">
                  {taskComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border border-gray-200 rounded-md p-3 text-sm text-gray-900"
                    >
                      <div className="font-medium">
                        {formatTaskCommentAuthor(comment)}
                      </div>
                      <div className="mt-1 text-gray-800 whitespace-pre-wrap break-words">
                        {comment.body}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {comment.created_at
                          ? new Date(comment.created_at).toLocaleString()
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>

          {/* Operation Section */}
          {isReviewing && (
            <section className="border-t border-slate-200 pt-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Add review opinion
              </h2>

              <div className="mt-4 space-y-1.5">
                <label
                  htmlFor="review-comment"
                  className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Comment
                </label>
                <CommentStyleTextarea
                  id="review-comment"
                  name="review-comment"
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add details for your decision"
                />
              </div>

              {task.approval_chain_progress ? (
                /* Chain mode: show full step-by-step approval timeline */
                <div className="mt-4 space-y-3">
                  <p className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Approval Chain — {task.approval_chain_progress.chain_name}
                  </p>
                  <ol className="space-y-2">
                    {task.approval_chain_progress.steps.map((step) => {
                      const isApproved = step.status === "approved";
                      const isCurrent = step.status === "current";
                      return (
                        <li
                          key={step.step_number}
                          className="flex items-start gap-3"
                        >
                          {/* Step indicator */}
                          <span
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isApproved
                                ? "bg-green-500 text-white"
                                : isCurrent
                                ? "bg-blue-500 text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {isApproved ? "✓" : step.step_number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium ${
                                isApproved
                                  ? "text-green-700"
                                  : isCurrent
                                  ? "text-blue-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {step.role_name}
                              <span className="ml-1 font-normal opacity-70">
                                ({step.approver.username})
                              </span>
                            </p>
                            {isApproved && step.record ? (
                              <p className="text-xs text-slate-500">
                                Approved by{" "}
                                <span className="font-medium text-slate-700">
                                  {step.record.approved_by.username}
                                </span>
                                {" · "}
                                {new Date(
                                  step.record.decided_time,
                                ).toLocaleDateString()}
                                {step.record.comment && (
                                  <span className="ml-1 italic">
                                    &ldquo;{step.record.comment}&rdquo;
                                  </span>
                                )}
                              </p>
                            ) : isCurrent ? (
                              <p className="text-xs text-blue-500">
                                Awaiting approval
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">Pending</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                /* Legacy mode: manual next approver picker */
                <div className="mt-4 space-y-1.5">
                  <p className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Next Approver
                  </p>
                  <RemovablePicker
                    options={approvers.map((approver) => ({
                      value: approver.id.toString(),
                      label: approver.username || approver.email,
                    }))}
                    placeholder="Select next approver"
                    value={nextApprover}
                    onChange={(val) => setNextApprover(val)}
                    loading={loadingApprovers}
                    className="w-full max-w-[360px]"
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleApprove}
                  className="inline-flex h-9 items-center rounded-md bg-[#0c66e4] px-4 text-sm font-medium text-white transition hover:bg-[#0055cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c66e4]/30"
                >
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  className="inline-flex h-9 items-center rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                >
                  Reject
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Right section */}
        <div className="space-y-4 lg:sticky lg:top-24 self-start">
          {/* Share Task */}
          {task?.id && projectId ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <button
                type="button"
                onClick={() => setShareDialogOpen(true)}
                disabled={!currentUserId}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                <Share2 className="h-4 w-4" />
                Share to Chat
              </button>
              {!currentUserId ? (
                <p className="mt-2 text-xs text-gray-400">
                  Sign in to share this task.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Task Basic Info */}
          <Accordion
            type="multiple"
            className="w-full border-t border-slate-200 pt-5"
            defaultValue={["item-1"]}
          >
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger>
                <span className="text-[15px] font-semibold text-[#172b4d]">
                  Details
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-0">
                  {/* Status - editable dropdown */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>Status</label>
                    <div
                      className={`rounded-md pr-2 border border-[#d0d4db] transition-colors hover:border-[#8590a2] focus-within:border-[#0c66e4] focus-within:shadow-[inset_0_0_0_1px_#0c66e4] ${
                        savingStatus ? "opacity-50" : ""
                      } ${getStatusColor(task?.status)}`}
                    >
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={
                          savingStatus ||
                          (currentUser != null && !currentUser.is_staff)
                        }
                        className="block h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-2.5 pr-8 py-1.5 text-sm text-[#172b4d] focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                      >
                        <option value="DRAFT" disabled={!["SUBMITTED", "CANCELLED", "REJECTED"].includes(task?.status ?? "")}>Draft</option>
                        <option value="SUBMITTED" disabled={task?.status !== "DRAFT"}>Submitted</option>
                        <option value="UNDER_REVIEW" disabled={task?.status !== "SUBMITTED"}>Under Review</option>
                        <option value="APPROVED" disabled={task?.status !== "UNDER_REVIEW"}>Approved</option>
                        <option value="REJECTED" disabled={task?.status !== "UNDER_REVIEW"}>Rejected</option>
                        <option value="LOCKED" disabled={task?.status !== "APPROVED" || task?.can_lock === false}>
                          Locked{task?.approvals_summary && task.approvals_summary.approved_count < task.approvals_summary.required_count
                            ? ` (${task.approvals_summary.display})` : ""}
                        </option>
                        {currentStatus === "LOCKED" && (
                          <option value="UNLOCK">Unlock (Back to Approved)</option>
                        )}
                        <option value="CANCELLED" disabled={["LOCKED", "DRAFT"].includes(task?.status ?? "")}>Cancelled</option>
                      </select>
                    </div>
                  </div>
                  {/* Approvals progress hint (SMP-499) */}
                  {task?.approvals_summary &&
                    task.approvals_summary.approved_count < task.approvals_summary.required_count && (
                    <div className="mt-1 text-xs text-amber-600">
                      {task.approvals_summary.display} required to lock
                    </div>
                  )}
                  {/* Work type - locked */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>Work type</label>
                    <div className="pt-1.5 min-w-0">
                      <span className="inline-block rounded-[3px] bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
                        {task?.type || "Unknown"}
                      </span>
                    </div>
                  </div>
                  {/* Owner - editable dropdown */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>Owner</label>
                    <div className={`rounded-md border border-[#d0d4db] pr-2 transition-colors hover:border-[#8590a2] focus-within:border-[#0c66e4] focus-within:shadow-[inset_0_0_0_1px_#0c66e4] ${savingOwner || loadingApprovers ? "opacity-50" : ""}`}>
                      <select
                        value={ownerId}
                        onChange={(e) => handleOwnerChange(e.target.value)}
                        disabled={savingOwner || loadingApprovers}
                        className="block h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-sm text-[#172b4d] focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {approvers.length === 0 ? "No members" : "Unassigned"}
                        </option>
                        {approvers.map((member) => (
                          <option key={member.id} value={member.id.toString()}>
                            {member.username ||
                              member.email ||
                              `User #${member.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Current Approver - editable dropdown */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>
                      Current Approver
                    </label>
                    <div className={`rounded-md border border-[#d0d4db] pr-2 transition-colors hover:border-[#8590a2] focus-within:border-[#0c66e4] focus-within:shadow-[inset_0_0_0_1px_#0c66e4] ${loadingApprovers ? "opacity-50" : ""}`}>
                      <select
                        value={currentApproverId}
                        onChange={(e) =>
                          handleCurrentApproverChange(e.target.value)
                        }
                        disabled={loadingApprovers}
                        className="block h-9 w-full min-w-0 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-sm text-[#172b4d] focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {approvers.length === 0
                            ? "No approver assigned"
                            : "Unassigned"}
                        </option>
                        {approvers.map((approver) => (
                          <option
                            key={approver.id}
                            value={approver.id.toString()}
                          >
                            {approver.username ||
                              approver.email ||
                              `User #${approver.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Project - locked */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>Project</label>
                    <p className={`${jiraDetailValueTextClass} break-words`}>
                      {task?.project?.name || "Unknown Project"}
                    </p>
                  </div>
                  {/* Start Date - editable */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>Start Date</label>
                    <div className="min-w-0">
                      <input
                        type="date"
                        value={startDateInput || ""}
                        onChange={(e) => setStartDateInput(e.target.value)}
                        onBlur={() => {
                          const current = task.start_date ?? "";
                          if (startDateInput !== current) {
                            handleSaveDates();
                          }
                        }}
                        disabled={savingDates}
                        className={`${jiraDetailControlClass} ${
                          savingDates ? "opacity-50" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Due Date - editable */}
                  <div className={jiraDetailRowClass}>
                    <label className={jiraDetailLabelClass}>Due Date</label>
                    <div className="min-w-0 space-y-1.5">
                      {dueDateInput && (
                        <div className="pt-0.5">
                          <JiraDueDateBadge
                            label={formatDate(dueDateInput)}
                            tone={getDetailDueTone(dueDateInput)}
                          />
                        </div>
                      )}
                      <input
                        type="date"
                        value={dueDateInput || ""}
                        onChange={(e) => setDueDateInput(e.target.value)}
                        onBlur={() => {
                          const current = task.due_date ?? "";
                          if (dueDateInput !== current) {
                            handleSaveDates();
                          }
                        }}
                        disabled={savingDates}
                        className={`${jiraDetailControlClass} ${
                          savingDates ? "opacity-50" : ""
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Approval Timeline */}
          <Accordion
            type="multiple"
            className="w-full border-t border-slate-200 pt-5"
            defaultValue={["item-1"]}
          >
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger>
                <span className="font-semibold text-gray-900">
                  Approval Timeline
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {loadingHistory ? (
                    <p>Loading approval history...</p>
                  ) : approvalHistory.length === 0 ? (
                    <p>No approval history yet for this task.</p>
                  ) : (
                    approvalHistory.map((record, index) => (
                      <div key={record.id} className="flex flex-row">
                        <div
                          className={`w-3 h-3 rounded-full mr-3 mt-1 ${
                            index === approvalHistory.length - 1
                              ? "bg-blue-500"
                              : "bg-gray-300"
                          }`}
                        ></div>
                        <div className="flex-1">
                          {record.role_name && (
                            <span className="inline-block mb-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                              {record.role_name}
                            </span>
                          )}
                          <p className="text-sm font-semibold text-gray-900">
                            {record.approved_by.username}
                            <span className="text-xs font-normal text-gray-900">
                              {" "}
                              {record.is_approved ? "approved" : "rejected"}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(record.decided_time)}
                          </p>
                          <p className="text-xs text-gray-900">
                            {record.comment}
                          </p>
                          {/* SMP-501: Show revision label if task has been resubmitted */}
                          {record.revision_label && record.revision_label !== "Initial Submission" && (
                            <span className="inline-block mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              {record.revision_label}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Operations */}
          {task.status === "SUBMITTED" &&
            (task.type === "asset" ? (
              <div>
                <p className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  Review for asset tasks is handled in the asset panel. Assigned
                  reviewers can start the review from the &quot;Asset Review
                  Overview&quot; section.
                </p>
              </div>
            ) : (
              <div>
                <button
                  disabled={isReviewing}
                  onClick={handleStartReview}
                  className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${
                    isReviewing
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }
                  `}
                >
                  {canReviewTask()
                    ? "Start Review"
                    : "Start Review (No Permission)"}
                </button>
              </div>
            ))}
          {showRevise && (
            <div>
              <button
                disabled={isRevising}
                onClick={handleStartRevise}
                className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors bg-yellow-600 text-white hover:bg-yellow-700"
              >
                Revise
              </button>
            </div>
          )}

          {/* Delete task */}
          {task?.id ? (
            <div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Task
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {task?.id && projectId && currentUserId ? (
        <ShareTaskDialog
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          projectId={String(projectId)}
          availableChats={chats}
          currentUserId={currentUserId}
          isSharing={sharingTask}
          onSubmit={handleShareTask}
        />
      ) : null}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete task"
        message={
          task?.id
            ? `Delete task #${task.id} "${task.summary || "Untitled"}"?`
            : ""
        }
        type="danger"
        confirmText="Delete"
        onConfirm={async () => {
          if (!task?.id) return;
          try {
            await TaskAPI.deleteTask(task.id);
            toast.success("Task deleted");
            onTaskDeleted?.();
          } catch (error: any) {
            const message =
              error?.response?.data?.detail ||
              error?.response?.data?.message ||
              error?.message ||
              "Failed to delete task. Please try again.";
            toast.error(message);
          }
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
