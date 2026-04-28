import { create } from 'zustand';
import { TaskData } from '@/types/task';

interface TaskStore {
  tasks: TaskData[];
  currentTask: TaskData | null;
  loading: boolean;
  error: any;
  
  // Actions
  setTasks: (tasks: TaskData[]) => void;
  setCurrentTask: (task: TaskData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: any) => void;
  
  // Update specific task
  updateTask: (taskId: number, updatedData: Partial<TaskData>) => void;
  updateTasksBulk: (taskIds: number[], updatedData: Partial<TaskData>) => void;
  
  // Add new task
  addTask: (task: TaskData) => void;
  
  // Remove task
  removeTask: (taskId: number) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  currentTask: null,
  loading: false,
  error: null,
  
  setTasks: (tasks) => set({ tasks }),
  setCurrentTask: (currentTask) => set({ currentTask }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  updateTask: (taskId, updatedData) => {
    set((state) => ({
      tasks: state.tasks.map(task => 
        task.id === taskId ? { ...task, ...updatedData } : task
      ),
      currentTask: state.currentTask && state.currentTask.id === taskId 
        ? { ...state.currentTask, ...updatedData } 
        : state.currentTask
    }));
  },

  updateTasksBulk: (taskIds, updatedData) => {
    const idSet = new Set(taskIds);
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id && idSet.has(task.id) ? { ...task, ...updatedData } : task
      ),
      currentTask:
        state.currentTask?.id && idSet.has(state.currentTask.id)
          ? { ...state.currentTask, ...updatedData }
          : state.currentTask,
    }));
  },
  
  addTask: (task) => {
    set((state) => ({
      tasks: [task, ...state.tasks]
    }));
  },
  
  removeTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter(task => task.id !== taskId)
    }));
  }
}));
