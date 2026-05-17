'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Link2, Plus } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import { TaskRelationsResponse, TaskRelationItem, userDisplayName } from '@/types/task';
import LinkTaskModal from './LinkTaskModal';

interface LinkedWorkItemsProps {
  taskId: number;
}

// Relationship type labels for display
const RELATIONSHIP_LABELS: Record<string, string> = {
  causes: 'Causes',
  is_caused_by: 'Is Caused By',
  blocks: 'Blocks',
  is_blocked_by: 'Is Blocked By',
  clones: 'Clones',
  is_cloned_by: 'Is Cloned By',
  relates_to: 'Relates To',
};

export default function LinkedWorkItems({ taskId }: LinkedWorkItemsProps) {
  const router = useRouter();
  const [relations, setRelations] = useState<TaskRelationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingRelationId, setDeletingRelationId] = useState<number | null>(null);

  const loadRelations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TaskAPI.getRelations(taskId);
      setRelations(data);
    } catch (e: any) {
      console.error('Failed to load task relations:', e);
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        'Failed to load linked work items.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId) return;
    loadRelations();
  }, [taskId]);

  const handleDelete = async (relationId: number) => {
    if (!confirm('Are you sure you want to remove this link?')) {
      return;
    }

    try {
      setDeletingRelationId(relationId);
      await TaskAPI.deleteRelation(taskId, relationId);
      await loadRelations(); // Reload relations after deletion
    } catch (e: any) {
      console.error('Failed to delete relation:', e);
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        'Failed to delete link.';
      alert(message);
    } finally {
      setDeletingRelationId(null);
    }
  };

  const handleLinkAdded = () => {
    loadRelations();
    setIsModalOpen(false);
  };

  const handleTaskClick = (taskId: number) => {
    router.push(`/tasks/${taskId}`);
  };

  // Get all non-empty relationship groups
  const getRelationshipGroups = () => {
    if (!relations) return [];
    
    return Object.entries(relations).filter(([_, items]) => items.length > 0);
  };

  const relationshipGroups = getRelationshipGroups();

  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChevronDown className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900">Linked work items</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Add linked work item"
        >
          <Plus className="h-4 w-4" />
          <span>Create link</span>
        </button>
      </div>

      {loading && (
        <div className="flex items-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-slate-500"></div>
          <span className="ml-2 text-sm text-slate-600">Loading linked work items...</span>
        </div>
      )}

      {error && !loading && (
        <div className="py-2 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && relationshipGroups.length === 0 && (
        <div className="py-2 text-sm text-slate-500">No linked work items yet.</div>
      )}

      {!loading && !error && relationshipGroups.length > 0 && (
        <div className="space-y-4">
          {relationshipGroups.map(([relationshipType, items]) => (
            <div key={relationshipType}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {RELATIONSHIP_LABELS[relationshipType] || relationshipType}
              </h4>
              <div className="divide-y divide-slate-200">
                {items.map((item: TaskRelationItem) => {
                  const task = item.task;
                  return (
                    <div
                      key={item.relation_id}
                      onClick={() => task.id && handleTaskClick(task.id)}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex flex-1 items-center space-x-3">
                        <Link2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900">
                              {task.summary || `Task #${task.id}`}
                            </span>
                            {task.id && (
                              <span className="text-xs text-slate-500">
                                #{task.id}
                              </span>
                            )}
                          </div>
                          {task.owner && (
                            <div className="mt-1 flex items-center space-x-1">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200">
                                <span className="text-[10px] text-slate-700">
                                  {userDisplayName(task.owner)[0]?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {userDisplayName(task.owner)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.relation_id);
                        }}
                        disabled={deletingRelationId === item.relation_id}
                        className="ml-4 flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50"
                        aria-label="Delete link"
                      >
                        {deletingRelationId === item.relation_id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <LinkTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLinkAdded={handleLinkAdded}
        sourceTaskId={taskId}
      />
    </section>
  );
}

