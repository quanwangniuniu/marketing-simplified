import { useCallback, useState } from "react";
import { TaskAPI } from "@/lib/api/taskApi";
import api from "@/lib/api";
import { TaskData, CreateTaskData, TaskListFilters } from "@/types/task";
import { useTaskStore } from "@/lib/taskStore";

type TaskFetchParams = TaskListFilters & {
  content_type?: string;
  object_id?: string;
  page?: number;
};

// Agent ingest/telemetry calls are best-effort debugging helpers.
// When the local ingest service is not running, these requests will fail and
// spam DevTools with `ERR_CONNECTION_REFUSED`, hurting UX (e.g. "flashing"
// detail pages due to repeated re-renders).
const ENABLE_INGEST = false;

export const useTaskData = () => {
  const {
    tasks,
    currentTask,
    setTasks,
    setCurrentTask,
    updateTask,
    addTask,
  } = useTaskStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const [lastParams, setLastParams] = useState<TaskFetchParams | undefined>(
    undefined,
  );

  // Get all tasks with optional filters
  const fetchTasks = useCallback(
    async (params?: TaskFetchParams) => {
      // Record the last request parameters
      setLastParams(params || undefined);
      // #region agent log
      if (ENABLE_INGEST) {
        fetch(
          "http://127.0.0.1:7242/ingest/d1c5a812-8fba-4f4b-91ec-d69ecfc99679",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runId: "usetaskdata-project-debug-v1",
              hypothesisId: "H1",
              location: "useTaskData.ts:fetchTasks:entry",
              message: "fetchTasks called with params",
              data: {
                hasParams: Boolean(params),
                project_id: params?.project_id ?? null,
                include_subtasks: params?.include_subtasks ?? null,
                all_projects: params?.all_projects ?? null,
                type: params?.type ?? null,
              },
              timestamp: Date.now(),
            }),
          },
        ).catch(() => {});
      }
      // #endregion

      try {
        setLoading(true);
        setError(null);

        // Fetch all pages of tasks
        let allTasks: any[] = [];
        let nextUrl: string | null = null;
        let page = 1;

        do {
          let response: any;

          if (nextUrl) {
            // Extract relative path+query to avoid mixed-content errors when
            // the backend returns an absolute HTTP URL on an HTTPS page.
            const parsed = new URL(nextUrl, window.location.origin);
            response = await api.get(parsed.pathname + parsed.search);
          } else {
            // Otherwise, use TaskAPI with params and page number
            const requestParams = { ...params, page };
            // #region agent log
            if (ENABLE_INGEST) {
              fetch(
                "http://127.0.0.1:7242/ingest/d1c5a812-8fba-4f4b-91ec-d69ecfc99679",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    runId: "usetaskdata-project-debug-v1",
                    hypothesisId: "H2",
                    location: "useTaskData.ts:fetchTasks:firstPageRequest",
                    message: "Requesting tasks with TaskAPI.getTasks",
                    data: {
                      page,
                      project_id: requestParams.project_id ?? null,
                      include_subtasks:
                        requestParams.include_subtasks ?? null,
                      all_projects: requestParams.all_projects ?? null,
                    },
                    timestamp: Date.now(),
                  }),
                },
              ).catch(() => {});
            }
            // #endregion
            response = await TaskAPI.getTasks(requestParams);
          }

          const responseData: any = response.data;
          const tasks =
            responseData.results ||
            (Array.isArray(responseData) ? responseData : []);
          // #region agent log
          if (ENABLE_INGEST) {
            fetch(
              "http://127.0.0.1:7242/ingest/d1c5a812-8fba-4f4b-91ec-d69ecfc99679",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  runId: "usetaskdata-project-debug-v1",
                  hypothesisId: "H4",
                  location: "useTaskData.ts:fetchTasks:responseParsed",
                  message: "Parsed tasks response page",
                  data: {
                    page,
                    hasResultsField: Boolean(responseData && responseData.results),
                    isArrayResponse: Array.isArray(responseData),
                    parsedTaskCount: Array.isArray(tasks) ? tasks.length : -1,
                    next: responseData?.next ?? null,
                  },
                  timestamp: Date.now(),
                }),
              },
            ).catch(() => {});
          }
          // #endregion
          allTasks = allTasks.concat(tasks);

          nextUrl = responseData.next || null;
          page++;

          // Safety limit to prevent infinite loops
          if (page > 100) break;
        } while (nextUrl);

        setTasks(allTasks);
        return allTasks;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setTasks],
  );

  // Get a specific task by ID
  const fetchTask = useCallback(
    async (taskId: number): Promise<TaskData> => {
      try {
        setLoading(true);
        setError(null);
        const response = await TaskAPI.getTask(taskId);
        const task = response.data;
        setCurrentTask(task);
        return task;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setCurrentTask],
  );

  // Force create a new task
  const createTask = useCallback(
    async (taskData: CreateTaskData): Promise<TaskData> => {
      setLoading(true);
      setError(null);

      try {
        const response = await TaskAPI.createTask(taskData);
        const newTask = response.data as TaskData;

        addTask(newTask);
        return newTask;
      } catch (err) {
        // Use the fallback interface to try again
        try {
          const forceResponse = await TaskAPI.forceCreateTask(taskData);
          const newTask = forceResponse.data as TaskData;

          addTask(newTask);
          return newTask;
        } catch (forceErr) {
          setError(forceErr);
          throw forceErr;
        }
      } finally {
        setLoading(false);
      }
    },
    [addTask],
  );

  // Reload tasks function for manual refresh
  const reloadTasks = useCallback(async () => {
    await fetchTasks(lastParams);
  }, [fetchTasks, lastParams]);

  return {
    tasks,
    currentTask,
    loading,
    error,
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    reloadTasks,
  };
};
