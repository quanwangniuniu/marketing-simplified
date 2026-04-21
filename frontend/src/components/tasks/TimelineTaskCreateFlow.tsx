"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import NewTaskForm from "@/components/tasks/NewTaskForm";
import TaskCreatePanel from "@/components/tasks/TaskCreatePanel";
import NewBudgetRequestForm from "@/components/tasks/NewBudgetRequestForm";
import NewAssetForm from "@/components/tasks/NewAssetForm";
import NewRetrospectiveForm from "@/components/tasks/NewRetrospectiveForm";
import NewPlatformPolicyUpdateForm from "@/components/tasks/NewPlatformPolicyUpdateForm";
import { useFormValidation } from "@/hooks/useFormValidation";
import { CreateTaskData, type TaskData } from "@/types/task";
import { TaskAPI } from "@/lib/api/taskApi";
import { AssetAPI } from "@/lib/api/assetApi";
import { RetrospectiveAPI, CreateRetrospectiveData } from "@/lib/api/retrospectiveApi";
import { TASK_TYPE_CONFIG_STATIC } from "@/lib/taskTypeConfigRegistry";
import useAuth from "@/hooks/useAuth";
import toast from "react-hot-toast";
import { MeetingsAPI } from "@/lib/api/meetingsApi";

const TIMELINE_TASK_TYPE_KEYS = [
  "budget",
  "asset",
  "retrospective",
  "platform_policy_update",
] as const;

export type TimelineTaskCreateFlowProps = {
  projectId: number | null;
  originMeetingId: number | null;
  /** Open the create panel on mount (e.g. timeline-only entry points). */
  autoOpen?: boolean;
  onPanelClose?: () => void;
  onTaskCreated?: () => void;
  createTask: (data: CreateTaskData) => Promise<TaskData>;
  reloadTasks?: () => Promise<void>;
  updateTask: (id: number, patch: Partial<TaskData>) => void;
  children: (api: { openCreateTask: (projectId: number | null) => void }) => ReactNode;
};

export function TimelineTaskCreateFlow({
  projectId,
  originMeetingId,
  autoOpen = false,
  onPanelClose,
  onTaskCreated,
  createTask,
  reloadTasks,
  updateTask,
  children,
}: TimelineTaskCreateFlowProps) {
  const { user } = useAuth();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalExpanded, setCreateModalExpanded] = useState(false);

  const getDefaultTaskDates = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return {
      start_date: today.toISOString().slice(0, 10),
      due_date: tomorrow.toISOString().slice(0, 10),
    };
  };

  const [taskData, setTaskData] = useState<Partial<CreateTaskData>>({
    project_id: undefined,
    type: undefined,
    summary: "",
    description: "",
    current_approver_id: undefined,
    ...getDefaultTaskDates(),
  });
  const [taskType, setTaskType] = useState("");
  const [contentType, setContentType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originMeetingLabel, setOriginMeetingLabel] = useState<string | null>(null);

  const originMeetingIdNum = originMeetingId;

  const [budgetData, setBudgetData] = useState({
    amount: "",
    currency: "",
    ad_channel: null,
    notes: "",
    budget_pool: null,
  });
  const [assetData, setAssetData] = useState({
    tags: "",
    team: "",
    notes: "",
    file: null,
  });
  const [retrospectiveData, setRetrospectiveData] = useState<
    Partial<CreateRetrospectiveData>
  >({});
  const [policyData, setPolicyData] = useState<any>({});

  useEffect(() => {
    if (!projectId) return;
    setTaskData((prev) => ({
      ...prev,
      project_id: prev.project_id || projectId,
    }));
  }, [projectId]);

  useEffect(() => {
    if (!originMeetingIdNum || !projectId) {
      setOriginMeetingLabel(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const m = await MeetingsAPI.getMeeting(projectId, originMeetingIdNum);
        if (!cancelled) setOriginMeetingLabel(m.title?.trim() || `Meeting ${originMeetingIdNum}`);
      } catch {
        if (!cancelled) setOriginMeetingLabel(`Meeting ${originMeetingIdNum}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [originMeetingIdNum, projectId]);
  useEffect(() => {
    if (!autoOpen || !projectId) return;
    setCreateModalOpen(true);
    setCreateModalExpanded(false);
  }, [autoOpen, projectId]);

  // Form validation rules
  const taskValidationRules = {
    project_id: (value: any) =>
      !value || value == 0 ? "Project is required" : "",
    type: (value: any) => (!value ? "Work type is required" : ""),
    summary: (value: any) => (!value ? "Task summary is required" : ""),
    current_approver_id: (value: any) =>
      taskData.type === "budget" && !value
        ? "Approver is required for budget"
        : "",
  };

  const budgetValidationRules = {
    amount: (value: any) => {
      if (!value || value.trim() === "") return "Amount is required";
      return "";
    },
    currency: (value: any) => {
      if (!value || value.trim() === "") return "Currency is required";
      return "";
    },
    ad_channel: (value: any) =>
      !value || value === 0 ? "Ad channel is required" : "",
    budget_pool: (value: any) =>
      !value || value === 0 ? "Budget pool is required" : "",
  };

  const assetValidationRules = {};

  const retrospectiveValidationRules = {
    campaign: (value: any) => {
      if (!value || value.toString().trim() === "")
        return "Campaign (Project) is required";
      return "";
    },
    decision: (value: any) => {
      if (!value || value.toString().trim() === "")
        return "Decision is required";
      return "";
    },
    confidence_level: (value: any) => {
      if (value === undefined || value === null || value === "") {
        return "Confidence level is required";
      }
      const numericValue = Number(value);
      if (![1, 2, 3, 4, 5].includes(numericValue)) {
        return "Confidence level must be between 1 and 5";
      }
      return "";
    },
    primary_assumption: (value: any) => {
      if (!value || value.toString().trim() === "")
        return "Primary assumption is required";
      return "";
    },
  };

  const policyValidationRules = {
    platform: (value: any) => {
      if (!value || value.trim() === "") return "Platform is required";
      return "";
    },
    policy_change_type: (value: any) => {
      if (!value || value.trim() === "")
        return "Policy change type is required";
      return "";
    },
    policy_description: (value: any) => {
      if (!value || value.trim() === "")
        return "Policy description is required";
      return "";
    },
    immediate_actions_required: (value: any) => {
      if (!value || value.trim() === "")
        return "Immediate actions required is required";
      return "";
    },
  };

  // Initialize validation hooks
  const taskValidation = useFormValidation<CreateTaskData>(taskValidationRules);
  const budgetValidation = useFormValidation(budgetValidationRules);
  const assetValidation = useFormValidation(assetValidationRules);
  const retrospectiveValidation = useFormValidation(
    retrospectiveValidationRules,
  );
  const policyValidation = useFormValidation(policyValidationRules);

  // Task type configuration from shared registry (timeline only supports a subset of types)
  const taskTypeConfig = useMemo(() => {
    const formStateByType: Record<string, { formData: any; setFormData: any; validation: any }> = {
      budget: { formData: budgetData, setFormData: setBudgetData, validation: budgetValidation },
      asset: { formData: assetData, setFormData: setAssetData, validation: assetValidation },
      retrospective: {
        formData: retrospectiveData,
        setFormData: setRetrospectiveData,
        validation: retrospectiveValidation,
      },
      platform_policy_update: {
        formData: policyData,
        setFormData: setPolicyData,
        validation: policyValidation,
      },
    };
    const config: Record<string, any> = {};
    for (const key of TIMELINE_TASK_TYPE_KEYS) {
      const staticConfig = TASK_TYPE_CONFIG_STATIC[key];
      if (!staticConfig) continue;
      const { formData, setFormData, validation } = formStateByType[key] || {};
      config[key] = {
        ...staticConfig,
        formData,
        setFormData,
        validation: validation ?? null,
        getPayload: (createdTask: any) =>
          staticConfig.getPayload(formData, taskData, createdTask),
      };
    }
    return config;
  }, [
    budgetData,
    assetData,
    retrospectiveData,
    policyData,
    taskData,
    budgetValidation,
    assetValidation,
    retrospectiveValidation,
    policyValidation,
  ]);

  // Generic function to create task type specific object
  const createTaskTypeObject = async (taskType: string, createdTask: any) => {
    const config = taskTypeConfig[taskType as keyof typeof taskTypeConfig];
    if (!config || !config.api) {
      console.warn(`No API configured for task type: ${taskType}`);
      return null;
    }

    const payload = config.getPayload(createdTask);
    console.log(`Creating ${taskType} with payload:`, payload);

    try {
      const response = await config.api(payload);
      const createdObject =
        response && typeof response === "object" && "data" in response
          ? (response as any).data
          : response;
      console.log(`${taskType} created:`, createdObject);
      return createdObject;
    } catch (error: any) {
      if (taskType === "retrospective" && error.response?.status === 400) {
        const errorData = error.response.data;
        if (
          (errorData.campaign &&
            Array.isArray(errorData.campaign) &&
            errorData.campaign[0]?.includes("already exists")) ||
          (typeof errorData.campaign === "string" &&
            errorData.campaign.includes("already exists"))
        ) {
          console.warn(
            "Retrospective already exists, attempting to find existing one...",
          );
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
              console.log(
                "Found existing retrospective:",
                retrospectivesResponse.data[0],
              );
              return retrospectivesResponse.data[0];
            }
          } catch (findError) {
            console.error("Failed to find existing retrospective:", findError);
          }
        }
      }
      throw error;
    }
  };

  // Generic function to reset form data
  const resetFormData = () => {
    const defaultDates = getDefaultTaskDates();
    setTaskData({
      project_id: undefined,
      type: undefined,
      summary: "",
      description: "",
      current_approver_id: undefined,
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
    setAssetData({
      tags: "",
      team: "",
      notes: "",
      file: null,
    });
    setRetrospectiveData({});
    setPolicyData({});
    setTaskType("");
    setContentType("");
  };

  // Generic function to clear validation errors
  const clearAllValidationErrors = () => {
    taskValidation.clearErrors();
    budgetValidation.clearErrors();
    assetValidation.clearErrors();
    retrospectiveValidation.clearErrors();
    policyValidation.clearErrors();
  };

  const handleCreateTask = (projectId: number | null) => {
    resetFormData();
    clearAllValidationErrors();
    setTaskData((prev) => ({
      ...prev,
      project_id: projectId ?? undefined,
    }));
    setCreateModalOpen(true);
    setCreateModalExpanded(false);
  };


  const handleTaskDataChange = (data: Partial<CreateTaskData>) => {
    setTaskData((prev) => ({ ...prev, ...data }));
    if (data.type && data.type !== taskData.type) {
      setTaskType(data.type);
    }
  };

  const handleBudgetDataChange = (newBudgetData: any) => {
    setBudgetData((prev) => ({ ...prev, ...newBudgetData }));
  };

  const handleAssetDataChange = (newAssetData: any) => {
    setAssetData((prev) => ({ ...prev, ...newAssetData }));
  };

  const handleRetrospectiveDataChange = (newRetrospectiveData: any) => {
    setRetrospectiveData((prev) => ({ ...prev, ...newRetrospectiveData }));
  };

  const handlePolicyDataChange = (newPolicyData: any) => {
    setPolicyData((prev: any) => ({ ...prev, ...newPolicyData }));
  };

  // Submit method to create task and related objects
  const handleSubmitTask = async () => {
    console.log(
      "Submitting task creation form with data:",
      isSubmitting,
      taskData,
    );
    if (isSubmitting) return;

    // Validate task form first
    const requiredTaskFields =
      taskData.type === "budget"
        ? ["project_id", "type", "summary", "current_approver_id"]
        : ["project_id", "type", "summary"];
    if (
      !taskValidation.validateForm(taskData as any, requiredTaskFields as any)
    ) {
      return;
    }

    // Validate task type specific form if config exists
    const config = taskTypeConfig[taskData.type as keyof typeof taskTypeConfig];
    if (config && config.validation && config.requiredFields.length > 0) {
      if (
        !config.validation.validateForm(
          config.formData as any,
          config.requiredFields as any,
        )
      ) {
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Step 1: Create the task
      // Ensure required fields are present (should be validated already)
      if (!taskData.project_id || !taskData.type || !taskData.summary) {
        console.error("Missing required task fields");
        return;
      }

      const taskPayload: CreateTaskData = {
        project_id: taskData.project_id,
        type: taskData.type,
        summary: taskData.summary,
        description: taskData.description || "",
        current_approver_id:
          taskData.type === "report"
            ? typeof user?.id === "number"
              ? user.id
              : typeof user?.id === "string"
              ? Number(user.id)
              : undefined
            : taskData.current_approver_id,
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || undefined,
        ...(originMeetingIdNum != null ? { origin_meeting_id: originMeetingIdNum } : {}),
      };

      console.log("Creating task with payload:", taskPayload);
      const createdTask = await createTask(taskPayload);
      console.log("Task created:", createdTask);

      // Ensure task has an ID before proceeding
      if (!createdTask.id) {
        throw new Error("Task was created but has no ID");
      }

      // Step 2: Create the specific type object
      setContentType(config?.contentType || "");

      const createdObject = await createTaskTypeObject(
        taskData.type!,
        createdTask,
      );

      // Step 3: Link the task to the specific type object
      if (createdObject && config?.contentType) {
        console.log(`Linking task to ${taskData.type}`, {
          taskId: createdTask.id,
          contentType: config.contentType,
          objectId: createdObject.id,
          createdObject: createdObject,
        });

        try {
          const linkResponse = await TaskAPI.linkTask(
            createdTask.id,
            config.contentType,
            createdObject.id.toString(),
          );

          console.log("Link task response:", linkResponse);

          const updatedTask = {
            ...createdTask,
            content_type: config.contentType,
            object_id: createdObject.id.toString(),
            linked_object: createdObject,
          };

          updateTask(createdTask.id, updatedTask);

          console.log("Task linked to task type object successfully");
        } catch (linkError: any) {
          console.error("Error linking task to object:", linkError);
          const errorMsg =
            linkError.response?.data?.error ||
            linkError.response?.data?.message ||
            linkError.message ||
            "Unknown error";
          toast.error(`Asset created, but failed to link to task: ${errorMsg}`);
        }
      } else {
        console.warn("Cannot link task: missing createdObject or contentType", {
          createdObject: !!createdObject,
          contentType: config?.contentType,
        });
      }

      // Step 4: For asset tasks, upload initial version file if provided
      if (taskData.type === "asset" && createdObject && assetData.file) {
        try {
          console.log(
            "Uploading initial version file for asset:",
            createdObject.id,
          );
          await AssetAPI.createAssetVersion(String(createdObject.id), {
            file: assetData.file,
          });
          console.log("Initial version file uploaded successfully");
        } catch (error) {
          console.error("Error uploading initial version file:", error);
          toast.error(
            "Asset created, but failed to upload initial version file. You can upload it later.",
          );
        }
      }

      // Reset form and close modal
      resetFormData();
      setCreateModalOpen(false);
      setCreateModalExpanded(false);
      clearAllValidationErrors();

      // Refresh tasks list
      if (reloadTasks) {
        await reloadTasks();
      }

      console.log("Task creation completed successfully");
      onTaskCreated?.();
    } catch (error: any) {
      console.error("Error creating task:", error);
      console.error("Error details:", {
        response: error.response,
        data: error.response?.data,
        status: error.response?.status,
        message: error.message,
      });

      // Show more detailed error message
      let errorMessage = "Failed to create task";
      if (error.response?.data) {
        if (error.response.data.campaign) {
          errorMessage = `Campaign error: ${
            Array.isArray(error.response.data.campaign)
              ? error.response.data.campaign[0]
              : error.response.data.campaign
          }`;
        } else if (error.response.data.scheduled_at) {
          errorMessage = `Scheduled at error: ${
            Array.isArray(error.response.data.scheduled_at)
              ? error.response.data.scheduled_at[0]
              : error.response.data.scheduled_at
          }`;
        } else if (error.response.data.status) {
          errorMessage = `Status error: ${
            Array.isArray(error.response.data.status)
              ? error.response.data.status[0]
              : error.response.data.status
          }`;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (typeof error.response.data === "object") {
          const firstError = Object.values(error.response.data)[0];
          errorMessage = Array.isArray(firstError)
            ? firstError[0]
            : String(firstError);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);

      // Try to reload tasks even on error to ensure list is visible
      if (reloadTasks) {
        try {
          await reloadTasks();
        } catch (reloadError) {
          console.error("Failed to reload tasks after error:", reloadError);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      {children({ openCreateTask: handleCreateTask })}
      {/* Create Task Panel */}
      <TaskCreatePanel
        isOpen={createModalOpen}
        isExpanded={createModalExpanded}
        onClose={() => {
          setCreateModalOpen(false);
          setCreateModalExpanded(false);
          onPanelClose?.();
        }}
        onExpand={() => setCreateModalExpanded(true)}
        onCollapse={() => setCreateModalExpanded(false)}
        title="Create Task"
        footer={
          <>
            <button
              onClick={() => {
                setCreateModalOpen(false);
                setCreateModalExpanded(false);
                onPanelClose?.();
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitTask}
              disabled={isSubmitting}
              className="rounded-md bg-[#3CCED7] px-4 py-2 text-sm font-medium text-white hover:bg-[#2AB5BD] disabled:bg-[#3CCED7]"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-8">
          {originMeetingLabel ? (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/90 px-3 py-2 text-sm text-indigo-950">
              <span className="text-indigo-800/90">Origin meeting: </span>
              <span className="font-medium">{originMeetingLabel}</span>
            </div>
          ) : null}
          <NewTaskForm
            onTaskDataChange={handleTaskDataChange}
            taskData={taskData}
            validation={taskValidation}
          />

          {taskData.type === "budget" && (
            <NewBudgetRequestForm
              onBudgetDataChange={handleBudgetDataChange}
              budgetData={budgetData}
              taskData={taskData}
              validation={budgetValidation}
            />
          )}
          {taskData.type === "asset" && (
            <NewAssetForm
              onAssetDataChange={handleAssetDataChange}
              assetData={assetData}
              taskData={taskData}
              validation={assetValidation}
            />
          )}
          {taskData.type === "retrospective" && (
            <NewRetrospectiveForm
              onRetrospectiveDataChange={handleRetrospectiveDataChange}
              retrospectiveData={retrospectiveData}
              taskData={taskData}
              validation={retrospectiveValidation}
            />
          )}
          {taskData.type === "platform_policy_update" && (
            <NewPlatformPolicyUpdateForm
              onPolicyDataChange={handlePolicyDataChange}
              policyData={policyData}
              taskData={taskData}
              validation={policyValidation}
            />
          )}
        </div>
      </TaskCreatePanel>
    </>
  );
}
