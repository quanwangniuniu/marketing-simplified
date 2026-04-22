"use client";

import { useEffect, useMemo, useState } from "react";
import { CreateTaskData } from "@/types/task";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useProjects } from "@/hooks/useProjects";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { ProjectAPI } from "@/lib/api/projectApi";
import { TaskAPI } from "@/lib/api/taskApi";
import { getTaskTypeLabel } from "@/lib/taskTypeLabels";

interface NewTaskFormProps {
  onTaskDataChange: (taskData: Partial<CreateTaskData>) => void;
  taskData: Partial<CreateTaskData>;
  validation: ReturnType<typeof useFormValidation<CreateTaskData>>;
  lockProject?: boolean;
  projectName?: string | null;
  isApproverRequired?: boolean;
}

export default function NewTaskForm({
  onTaskDataChange,
  taskData,
  validation,
  lockProject = false,
  projectName = null,
  isApproverRequired = false,
}: NewTaskFormProps) {
  const { errors, validateField, clearFieldError, setErrors } = validation;
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [approvers, setApprovers] = useState<
    { id: number; username: string; email: string }[]
  >([]);
  const [autoSummary, setAutoSummary] = useState<string | null>(null);
  const { textareaRef: descriptionTextareaRef, resizeTextarea: resizeDescriptionTextarea } =
    useAutoResizeTextarea(taskData.description || "", { minHeight: 96 });
  const {
    projects,
    loading: loadingProjects,
    error: projectsError,
    fetchProjects,
  } = useProjects();

  const [taskTypes, setTaskTypes] = useState<{ value: string; label: string }[]>([]);
  const [loadingTaskTypes, setLoadingTaskTypes] = useState(true);

  useEffect(() => {
    const fetchTaskTypes = async () => {
      try {
        setLoadingTaskTypes(true);
        const types = await TaskAPI.getTaskTypes();
        setTaskTypes(types);
      } catch (error) {
        setTaskTypes([]);
      } finally {
        setLoadingTaskTypes(false);
      }
    };
    fetchTaskTypes();
  }, []);

  useEffect(() => {
    if (lockProject) return;
    fetchProjects();
  }, [fetchProjects, lockProject]);

  const activeProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.isActiveResolved ||
          project.is_active ||
          project.derivedStatus === "active"
      ),
    [projects]
  );

  useEffect(() => {
    if (lockProject) return;
    if (
      taskData.project_id &&
      !activeProjects.some((project) => project.id === taskData.project_id)
    ) {
      onTaskDataChange({ project_id: undefined });
    }
  }, [activeProjects, lockProject, onTaskDataChange, taskData.project_id]);

  // Get approvers list
  useEffect(() => {
    const fetchApprovers = async () => {
      // Require a project to be selected before loading approvers
      if (!taskData.project_id) {
        setApprovers([]);
        return;
      }

      try {
        setLoadingApprovers(true);

        // Load approvers only from the selected project's members
        const members = await ProjectAPI.getProjectMembers(
          taskData.project_id
        );
        const approverList =
          members?.map((member) => ({
            id: member.user.id,
            username: member.user.username || "",
            email: member.user.email || "",
          })) || [];

        setApprovers(approverList);
      } catch (error) {
        setApprovers([]);
      } finally {
        setLoadingApprovers(false);
      }
    };

    fetchApprovers();
  }, [taskData.project_id]);

  const handleInputChange = (field: keyof CreateTaskData, value: any) => {
    // Clear error when user starts typing
    if (errors[field as string]) {
      clearFieldError(field);
    }

    const nextTaskData = { ...taskData, [field]: value };
    if (field === "type") {
      const label = getTaskTypeLabel(value, taskTypes);
      const nextSummary = `${label} task`;
      if (!taskData.summary || taskData.summary === autoSummary) {
        nextTaskData.summary = nextSummary;
        setAutoSummary(nextSummary);
      }
    }
    if (field === "summary") {
      setAutoSummary(null);
    }

    // Update taskData in parent component
    onTaskDataChange(nextTaskData);

    // Real-time validation of the field - display error message when user input is invalid
    const error = validateField(field, value);
    if (error && error !== "") {
      // Set error for this field
      setErrors({ ...errors, [field as string]: error });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      {/* Project */}
      <div>
        <label
          htmlFor="task-project"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Project *
        </label>
        {lockProject ? (
          <div className="flex items-center justify-between rounded-md border border-[#3CCED7]/30 bg-[#3CCED7]/10/60 px-3 py-2 text-sm text-gray-900">
            <span className="truncate">
              {projectName ||
                (taskData.project_id ? String(taskData.project_id) : "Project")}
            </span>
            <span className="rounded-full bg-[#3CCED7]/15 px-2 py-0.5 text-xs font-medium text-[#1a9ba3]">
              Locked
            </span>
          </div>
        ) : (
          <select
            id="task-project"
            name="project_id"
            value={taskData.project_id || ""}
            onChange={(e) =>
              handleInputChange("project_id", Number(e.target.value))
            }
            className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20 ${
              errors.project_id ? "border-red-500" : "border-gray-300"
            }`}
            required
            disabled={loadingProjects}
          >
            <option value="" disabled>
              {loadingProjects ? "Loading projects..." : "Select project"}
            </option>
            {activeProjects.map((project) => (
              <option key={project.id} value={project.id}>
                #{project.id} {project.name || "Untitled Project"}
              </option>
            ))}
            {!loadingProjects && activeProjects.length === 0 && (
              <option value="" disabled>
                {projectsError
                  ? "Failed to load projects"
                  : "No projects available"}
              </option>
            )}
          </select>
        )}
        {!lockProject && errors.project_id && (
          <p className="text-red-500 text-sm mt-1">{errors.project_id}</p>
        )}
        {!lockProject && projectsError && (
          <p className="text-red-500 text-sm mt-1">
            Failed to load projects: {projectsError}
          </p>
        )}
      </div>

      {/* Task Type */}
      <div>
        <label
          htmlFor="task-type"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Work type *
        </label>
        <select
          id="task-type"
          name="type"
          value={taskData.type || ""}
          onChange={(e) => handleInputChange("type", e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20 ${
            errors.type ? "border-red-500" : "border-gray-300"
          }`}
          required
          disabled={loadingTaskTypes}
        >
          <option value="" disabled>
            {loadingTaskTypes ? "Loading work types..." : "Select a work type"}
          </option>
          {taskTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          {!loadingTaskTypes && taskTypes.length === 0 && (
            <option value="" disabled>
              No work types available
            </option>
          )}
        </select>
        {errors.type && (
          <p className="text-red-500 text-sm mt-1">{errors.type}</p>
        )}
      </div>

      {/* Summary */}
      <div>
        <label
          htmlFor="task-summary"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Summary *
        </label>
        <input
          id="task-summary"
          name="summary"
          value={taskData.summary || ""}
          onChange={(e) => handleInputChange("summary", e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20 ${
            errors.summary ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Enter a short summary"
          required
        />
        {errors.summary && (
          <p className="mt-1 text-sm text-red-500">{errors.summary}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="task-description"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          ref={descriptionTextareaRef}
          id="task-description"
          name="description"
          value={taskData.description || ""}
          onChange={(e) => {
            handleInputChange("description", e.target.value);
            resizeDescriptionTextarea();
          }}
          onInput={resizeDescriptionTextarea}
          className="w-full resize-none overflow-hidden rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20"
          rows={4}
          placeholder="Enter task description"
        />
      </div>

      {/* Approver */}
      <div>
        <label
          htmlFor="task-approver"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {isApproverRequired ? "Assign an approver *" : "Assign an approver"}
        </label>
        <select
          id="task-approver"
          name="current_approver_id"
          value={taskData.current_approver_id || ""}
          onChange={(e) =>
            handleInputChange("current_approver_id", Number(e.target.value))
          }
          className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20 ${
            errors.current_approver_id ? "border-red-500" : "border-gray-300"
          }`}
          required={isApproverRequired}
        >
          <option value="" disabled>
            {loadingApprovers ? "Loading approvers..." : "Select an approver"}
          </option>
          {approvers &&
            approvers.map((approver) => (
              <option key={approver.id} value={approver.id}>
                {approver.username || approver.email || `User #${approver.id}`}
              </option>
            ))}
          {approvers.length === 0 && (
            <option value="" disabled>
              No approvers found
            </option>
          )}
        </select>
        {errors.current_approver_id && (
          <p className="text-red-500 text-sm mt-1">
            {errors.current_approver_id}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Start Date */}
        <div>
          <label
            htmlFor="task-start-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Start Date
          </label>
          <input
            id="task-start-date"
            name="start_date"
            type="date"
            value={taskData.start_date || ""}
            onChange={(e) => handleInputChange("start_date", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20"
          />
        </div>

        {/* Due Date */}
        <div>
          <label
            htmlFor="task-due-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Due Date
          </label>
          <input
            id="task-due-date"
            name="due_date"
            type="date"
            value={taskData.due_date || ""}
            onChange={(e) => handleInputChange("due_date", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20"
          />
        </div>
      </div>

      {/* Hidden submit button for form validation and enter key support */}
      <button type="submit" className="hidden">
        Submit Task Form
      </button>
    </form>
  );
}
