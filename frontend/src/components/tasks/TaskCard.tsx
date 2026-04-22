'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TaskData, TaskAttachment } from '@/types/task';
import RetrospectiveDetail from '@/components/tasks/RetrospectiveDetail';
import AssetDetail from '@/components/tasks/AssetDetail';
import { RetrospectiveAPI, RetrospectiveTaskData } from '@/lib/api/retrospectiveApi';
import { TaskAPI } from '@/lib/api/taskApi';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/common/ConfirmDialog';

interface TaskCardProps {
  task: TaskData;
  onClick?: (task: TaskData) => void;
  onDelete?: (taskId: number) => void;
  index?: number; // Priority index for Storybook style
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDelete, index }) => {
  const [retrospective, setRetrospective] = useState<RetrospectiveTaskData | null>(null);
  const [retrospectiveLoading, setRetrospectiveLoading] = useState(false);
  const [retrospectiveError, setRetrospectiveError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Function to fetch retrospective data
  const fetchRetrospective = async () => {
    if (task.type === 'retrospective' && task.object_id) {
      setRetrospectiveLoading(true);
      setRetrospectiveError(false);
      try {
        const response = await RetrospectiveAPI.getRetrospective(task.object_id);
        setRetrospective(response.data);
      } catch (error) {
        console.error('Failed to fetch retrospective:', error);
        setRetrospectiveError(true);
      } finally {
        setRetrospectiveLoading(false);
      }
    }
  };

  // Fetch retrospective data if task type is retrospective
  useEffect(() => {
    fetchRetrospective();
  }, [task.type, task.object_id]);

  // Fetch attachments for the task
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!task.id) return;
      try {
        setAttachmentsLoading(true);
        const data = await TaskAPI.getAttachments(task.id);
        setAttachments(data);
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
      } finally {
        setAttachmentsLoading(false);
      }
    };
    fetchAttachments();
  }, [task.id]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-50 text-green-600 border-green-100';
      case 'UNDER_REVIEW':
        return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      case 'SUBMITTED':
        return 'bg-[#3CCED7]/10 text-[#3CCED7] border-[#3CCED7]/20';
      case 'REJECTED':
        return 'bg-red-50 text-red-600 border-red-100';
      case 'DRAFT':
        return 'bg-gray-50 text-gray-600 border-gray-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'budget':
        return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'asset':
        return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'retrospective':
        return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'report':
        return 'bg-[#3CCED7]/10 text-[#3CCED7] border-[#3CCED7]/20';
      case 'scaling':
        return 'bg-green-50 text-green-600 border-green-100';
      case 'alert':
        return 'bg-red-50 text-red-600 border-red-100';
      case 'experiment':
        return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      case 'optimization':
        return 'bg-cyan-50 text-cyan-600 border-cyan-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Format UUID for display
  const formatObjectId = (objectId?: string) => {
    if (!objectId) return '';
    if (objectId.length >= 36) {
      return objectId.substring(0, 8) + '...';
    }
    return objectId;
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action]')) {
      return;
    }
    
    if (onClick) {
      onClick(task);
    }
  };

  // Handle delete task
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!task.id) {
      toast.error('Cannot delete task: Task ID is missing');
      return;
    }
    
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!task.id) return;
    try {
      setDeleting(true);
      await TaskAPI.deleteTask(task.id);
      toast.success('Task deleted');
      setShowDeleteConfirm(false);
      if (onDelete) {
        onDelete(task.id);
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to delete task';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const taskTypeLabel = task.type === 'retrospective' ? 'retrospective task' : task.type === 'asset' ? 'asset task' : task.type === 'experiment' ? 'experiment task' : task.type === 'optimization' ? 'optimization task' : 'task';
  const linkedObjectLabel = task.type === 'retrospective' ? 'retrospective object' : task.type === 'asset' ? 'asset object' : task.type === 'experiment' ? 'experiment object' : task.type === 'optimization' ? 'optimization object' : 'linked object';
  const deleteConfirmMessage = task.id
    ? `Are you sure you want to delete ${taskTypeLabel} #${task.id} "${task.summary || 'Untitled'}"? This will also delete the linked ${linkedObjectLabel} if it exists. This action cannot be undone.`
    : '';

  return (
    <>
    <div 
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md cursor-pointer transition-shadow",
        "flex flex-col gap-2"
      )}
      onClick={handleClick}
    >
      {/* Priority index - top left */}
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-900">
          {index !== undefined ? index + 1 : task.id}
        </span>
      </div>

      {/* Task title */}
      <div>
        <h4 className="text-sm font-medium text-slate-900 line-clamp-2">
          {task.summary || "Untitled Task"}
        </h4>
      </div>

      {/* Project info */}
      {task.project?.name && (
        <div className="text-xs text-slate-500">
          #{task.project?.id || task.id} • {task.project.name}
        </div>
      )}

      {/* Status and type labels */}
      <div className="flex flex-col gap-1.5 mt-1">
        {task.status && (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded border self-start font-medium",
              getStatusColor(task.status)
            )}
          >
            {task.status.replace('_', ' ')}
          </span>
        )}
        {task.type && (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded border self-start font-medium",
              getTypeColor(task.type)
            )}
          >
            {task.type}
          </span>
        )}
      </div>

      {/* Footer: Owner, Approver, Due Date */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {/* Owner Avatar */}
          {task.owner?.username && (
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold"
              title={`Owner: ${task.owner.username}`}
            >
              {task.owner.username.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Current Approver */}
          <span className="text-xs text-slate-500">
            {task.current_approver?.username || 'Unassigned'}
          </span>
        </div>

        {/* Due Date */}
        {task.due_date && (
          <span className="text-xs text-slate-500">
            {formatDate(task.due_date)}
          </span>
        )}
      </div>

      {/* Attachments Info */}
      {attachments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Attachments:</span>
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="font-medium text-slate-600">{attachments.length}</span>
            </div>
          </div>
          {/* Show first attachment preview if it's an image */}
          {attachments.length > 0 && attachments[0] && (
            <div className="mt-1 flex items-center space-x-2">
              {attachments[0].content_type?.startsWith('image/') && (
                <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0">
                  <img
                    src={attachments[0].file}
                    alt={attachments[0].original_filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-600 truncate">
                  {attachments[0].original_filename}
                </div>
                {attachments.length > 1 && (
                  <div className="text-xs text-slate-400">
                    +{attachments.length - 1} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete button - for retrospective, asset, experiment, and optimization tasks */}
      {(task.type === 'retrospective' || task.type === 'asset' || task.type === 'experiment' || task.type === 'optimization') && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              "w-full py-1.5 text-xs rounded transition-colors",
              deleting 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            )}
            title={`Delete ${task.type} task`}
            data-action
          >
            {deleting ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>
      )}

      {/* Task Description */}
      {task.description && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Retrospective Metadata */}
      {task.type === 'retrospective' && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <RetrospectiveDetail 
            retrospective={retrospective || undefined} 
            loading={retrospectiveLoading}
            compact={true}
            onRefresh={fetchRetrospective}
          />
        </div>
      )}

      {/* Asset Metadata */}
      {task.type === 'asset' && task.id && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <AssetDetail 
            taskId={task.id}
            assetId={task.content_type === 'asset' ? (task.object_id || null) : null}
            compact={true}
            hideComments={true}
          />
        </div>
      )}
    </div>
    <ConfirmDialog
      isOpen={showDeleteConfirm}
      title="Delete task"
      message={deleteConfirmMessage}
      type="danger"
      confirmText="Delete"
      onConfirm={handleConfirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
};

export default TaskCard;
