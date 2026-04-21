'use client';

import { Fragment, useState, useMemo, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { TaskData } from '@/types/task';
import { TaskAPI } from '@/lib/api/taskApi';
import toast from 'react-hot-toast';

interface TaskListViewProps {
  tasks: TaskData[];
  onTaskClick?: (task: TaskData) => void;
  onTaskUpdate?: () => void;
  searchQuery?: string;
}

const TaskListView = ({ 
  tasks, 
  onTaskClick,
  onTaskUpdate,
  searchQuery = ''
}: TaskListViewProps) => {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const tasksPerPage = 20;

  // Filter tasks by search query and exclude subtasks
  const filteredTasks = useMemo(() => {
    // First exclude subtasks (safety check - backend should already filter these)
    const parentTasks = tasks.filter(task => !task.is_subtask);
    
    if (!searchQuery.trim()) return parentTasks;
    
    const query = searchQuery.toLowerCase();
    return parentTasks.filter(task => 
      task.summary?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.id?.toString().includes(query) ||
      task.owner?.username?.toLowerCase().includes(query) ||
      task.project?.name?.toLowerCase().includes(query) ||
      task.status?.toLowerCase().includes(query) ||
      task.type?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  // Sort by creation time (newest first) - using id as proxy for creation time
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // Higher ID = newer task (assuming auto-increment)
      return (b.id || 0) - (a.id || 0);
    });
  }, [filteredTasks]);

  // Pagination
  const totalPages = Math.ceil(sortedTasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, endIndex);

  // Group tasks by project
  const groupedTasks = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tasks: TaskData[] }>();

    paginatedTasks.forEach((task) => {
      const projectId = task.project?.id ?? task.project_id ?? null;
      const key = projectId ? `project-${projectId}` : 'project-none';
      const label = task.project?.name || (projectId ? `Project ${projectId}` : 'No Project');

      const existing = map.get(key) ?? { key, label, tasks: [] };
      existing.tasks.push(task);
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [paginatedTasks]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'SUBMITTED':
        return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'LOCKED':
        return 'bg-purple-100 text-purple-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'budget':
        return 'bg-purple-100 text-purple-800';
      case 'asset':
        return 'bg-indigo-100 text-indigo-800';
      case 'retrospective':
        return 'bg-orange-100 text-orange-800';
      case 'report':
        return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
      case 'scaling':
        return 'bg-green-100 text-green-800';
      case 'alert':
        return 'bg-red-100 text-red-800';
      case 'experiment':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleFieldEdit = (taskId: number, field: string, currentValue: any) => {
    setEditingTaskId(taskId);
    setEditingField(field);
    setEditValues({ [field]: currentValue });
  };

  const handleFieldSave = async (taskId: number, field: string) => {
    const newValue = editValues[field];
    
    try {
      const updateData: any = {};
      
      // Handle different field types
      if (field === 'due_date' || field === 'start_date') {
        updateData[field] = newValue || null;
      } else if (field === 'current_approver_id') {
        updateData[field] = newValue ? parseInt(newValue) : null;
      } else {
        updateData[field] = newValue;
      }

      await TaskAPI.updateTask(taskId, updateData);
      toast.success(`${field} updated successfully`);
      setEditingTaskId(null);
      setEditingField(null);
      setEditValues({});
      
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error: any) {
      console.error('Failed to update task:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to update task';
      toast.error(`Failed to update ${field}: ${errorMessage}`);
    }
  };

  const handleFieldCancel = () => {
    setEditingTaskId(null);
    setEditingField(null);
    setEditValues({});
  };

  const handleKeyPress = (e: KeyboardEvent, taskId: number, field: string) => {
    if (e.key === 'Escape') {
      handleFieldCancel();
      return;
    }
    if (field === 'description') {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleFieldSave(taskId, field);
      }
    } else if (e.key === 'Enter') {
      handleFieldSave(taskId, field);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Table Header */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Approver
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No tasks found
                </td>
              </tr>
            ) : (
              groupedTasks.map((group) => {
                const collapsed = !!collapsedGroups[group.key];
                return (
                  <Fragment key={group.key}>
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group.key)}
                          className="flex w-full items-center gap-3 text-left text-sm font-semibold text-gray-800"
                        >
                          <span className="text-gray-400">{collapsed ? '▸' : '▾'}</span>
                          <span className="truncate">{group.label}</span>
                          <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {group.tasks.length}
                          </span>
                        </button>
                      </td>
                    </tr>

                    {!collapsed &&
                      group.tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => onTaskClick && onTaskClick(task)}
                        >
                          {/* Task Summary */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              {editingTaskId === task.id && editingField === 'summary' ? (
                                <input
                                  type="text"
                                  value={editValues.summary || task.summary || ''}
                                  onChange={(e) => setEditValues({ summary: e.target.value })}
                                  onBlur={() => handleFieldSave(task.id!, 'summary')}
                                  onKeyDown={(e) => handleKeyPress(e, task.id!, 'summary')}
                                  className="px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div
                                  className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-indigo-600"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleFieldEdit(task.id!, 'summary', task.summary);
                                  }}
                                >
                                  <span className="text-gray-300">•</span>
                                  <span>{task.summary || 'Untitled Task'}</span>
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1 ml-4">
                                #{task.id}
                              </div>
                              {editingTaskId === task.id && editingField === 'description' ? (
                                <div className="mt-1 ml-4" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    value={editValues.description ?? task.description ?? ''}
                                    onChange={(e) => setEditValues({ description: e.target.value })}
                                    onBlur={() => handleFieldSave(task.id!, 'description')}
                                    onKeyDown={(e) => handleKeyPress(e, task.id!, 'description')}
                                    className="w-full min-h-[60px] px-2 py-1 border border-indigo-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                    rows={3}
                                  />
                                </div>
                              ) : (
                                <div
                                  className="text-xs text-gray-500 mt-1 line-clamp-1 ml-4 cursor-pointer hover:text-indigo-600 min-h-[1.25rem]"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleFieldEdit(task.id!, 'description', task.description ?? '');
                                  }}
                                >
                                  {task.description || (
                                    <span className="text-gray-400 italic">Double-click to add description</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(task.type)}`}>
                              {task.type || 'N/A'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                              {task.status?.replace('_', ' ') || 'N/A'}
                            </span>
                          </td>

                          {/* Owner */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.owner?.username || 'Unassigned'}
                          </td>

                          {/* Approver */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.current_approver?.username || 'Unassigned'}
                          </td>

                          {/* Due Date */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingTaskId === task.id && editingField === 'due_date' ? (
                              <input
                                type="date"
                                value={editValues.due_date || task.due_date || ''}
                                onChange={(e) => setEditValues({ due_date: e.target.value })}
                                onBlur={() => handleFieldSave(task.id!, 'due_date')}
                                onKeyDown={(e) => handleKeyPress(e, task.id!, 'due_date')}
                                className="px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div
                                className="text-sm text-gray-900 cursor-pointer hover:text-indigo-600"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleFieldEdit(task.id!, 'due_date', task.due_date);
                                }}
                              >
                                {task.due_date ? formatDate(task.due_date) : 'No due date'}
                              </div>
                            )}
                          </td>

                          {/* Project */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.project?.name || 'Unknown'}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, sortedTasks.length)}</span> of{' '}
                <span className="font-medium">{sortedTasks.length}</span> tasks
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 2 && page <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 3 || page === currentPage + 3) {
                    return (
                      <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskListView;
