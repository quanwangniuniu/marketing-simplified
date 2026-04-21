'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Asset, AssetAssignment, AssetComment, AssetVersion, AssetAPI, extractFileNameFromUrl } from '@/lib/api/assetApi';
import { useAssetData } from '@/hooks/useAssetData';
import { useAssetSocket } from '@/hooks/useAssetSocket';
import { approverApi } from '@/lib/api/approverApi';
import useAuth from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface AssetDetailProps {
  assetId?: string | number | null;
  taskId?: string | number | null;
  compact?: boolean; 
  onRefresh?: () => void; 
  hideComments?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  NotSubmitted: 'bg-gray-100 text-gray-800',
  PendingReview: 'bg-yellow-100 text-yellow-800',
  UnderReview: 'bg-[#3CCED7]/15 text-[#1a9ba3]',
  Approved: 'bg-green-100 text-green-800',
  RevisionRequired: 'bg-red-100 text-red-800',
  Archived: 'bg-gray-200 text-gray-700',
};

const formatStatus = (status?: string | null) => {
  if (!status) return 'Unknown';
  return status
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
};

const formatUser = (userId?: number | null) => {
  if (!userId && userId !== 0) return 'Unknown';
  return `User #${userId}`;
};

const truncate = (value: string, length = 96) => {
  if (!value) return '';
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
};

// Comment Input Component
// Backend allows any authenticated user to add comments at any time
function CommentInput({ 
  assetId, 
  onCommentAdded 
}: { 
  assetId: string; 
  onCommentAdded?: () => void;
}) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Backend only requires authentication, no role or status restrictions
  const canAddComment = !!user?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting || !canAddComment) return;

    try {
      setSubmitting(true);
      await AssetAPI.createAssetComment(assetId, { body: commentText.trim() });
      setCommentText('');
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAddComment) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Add a comment..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
      />
      <button
        type="submit"
        disabled={!commentText.trim() || submitting}
        className="mt-2 px-3 py-1.5 text-sm rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Adding...' : 'Add Comment'}
      </button>
    </form>
  );
}

export default function AssetDetail({
  assetId,
  taskId,
  compact = false,
  onRefresh,
  hideComments = false,
}: AssetDetailProps) {
  const auth = useAuth();
  const currentUserId = auth?.user?.id ? Number(auth.user.id) : null;

  // Determine which asset to use
  const normalizedAssetId = assetId ? String(assetId) : undefined;
  const normalizedTaskId = taskId ? String(taskId) : undefined;
  
  // If taskId provided but no assetId, get first asset for the task
  const [taskAsset, setTaskAsset] = useState<Asset | null>(null);
  const [loadingTaskAsset, setLoadingTaskAsset] = useState(false);
  const [resolvedAssetId, setResolvedAssetId] = useState<string | undefined>(normalizedAssetId);

  useEffect(() => {
    const loadTaskAsset = async () => {
      if (normalizedTaskId && !normalizedAssetId) {
        try {
          setLoadingTaskAsset(true);
          const response = await AssetAPI.getAssets(normalizedTaskId);
          if (response.results && response.results.length > 0) {
            // Filter by task in case backend does not filter (task_id may be passed as query param but backend may ignore)
            const forTask = response.results.filter(
              (a: Asset) => String(a.task) === String(normalizedTaskId)
            );
            const firstAsset = forTask.length > 0 ? forTask[0] : response.results[0];
            setTaskAsset(firstAsset);
            setResolvedAssetId(String(firstAsset.id));
          } else {
            setTaskAsset(null);
            setResolvedAssetId(undefined);
          }
        } catch (error) {
          console.error('Error loading task asset:', error);
          setTaskAsset(null);
          setResolvedAssetId(undefined);
        } finally {
          setLoadingTaskAsset(false);
        }
      } else if (normalizedAssetId) {
        setResolvedAssetId(normalizedAssetId);
      } else {
        setResolvedAssetId(undefined);
      }
    };
    loadTaskAsset();
  }, [normalizedTaskId, normalizedAssetId]);

  const {
    assets,
    asset,
    assetLoading,
    assetError,
    assignments,
    comments,
    versions,
    assignmentsLoading,
    commentsLoading,
    versionsLoading,
    fetchAssets,
    fetchAssetDetails,
    fetchAsset,
  } = useAssetData({ assetId: resolvedAssetId, taskId: normalizedTaskId });

  useEffect(() => {
    if (!normalizedAssetId && assets.length > 0) {
      const firstAsset = assets[0];
      setTaskAsset(firstAsset);
      setResolvedAssetId(String(firstAsset.id));
    }
  }, [assets, normalizedAssetId]);

  useEffect(() => {
    if (asset) {
      setTaskAsset(asset);
    }
  }, [asset]);
  useEffect(() => {
    if (resolvedAssetId) {
      fetchAsset(resolvedAssetId);
      fetchAssetDetails(resolvedAssetId);
    }
  }, [resolvedAssetId, fetchAsset, fetchAssetDetails]);

  // Version upload state
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assignment management state
  const [userPickerOpen, setUserPickerOpen] = useState<null | 'approver' | 'reviewer'>(null);
  const [allUsers, setAllUsers] = useState<{ id: number; name?: string; email?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const displayAsset = asset || taskAsset;
  const isLoading = assetLoading || loadingTaskAsset;
  const statusClass = displayAsset?.status ? STATUS_COLORS[displayAsset.status] || STATUS_COLORS.NotSubmitted : STATUS_COLORS.NotSubmitted;

  // WebSocket for real-time updates
  useAssetSocket(resolvedAssetId || (displayAsset ? String(displayAsset.id) : null), {
    onStatusChanged: (event) => {
      const payload = (event && event.payload) || {};
      const next = payload.to_state || payload.new_status || payload.status;
      if (next && onRefresh) {
        Promise.resolve(onRefresh()).catch(() => undefined);
      }
      if (resolvedAssetId && fetchAssetDetails) {
        fetchAssetDetails(resolvedAssetId);
        fetchAsset(resolvedAssetId);
        if (normalizedTaskId) {
          fetchAssets();
        }
      }
    },
    onCommentAdded: () => {
      if (resolvedAssetId && fetchAssetDetails) fetchAssetDetails(resolvedAssetId);
    },
    onReviewAssigned: () => {
      if (resolvedAssetId && fetchAssetDetails) fetchAssetDetails(resolvedAssetId);
    },
    onVersionUploaded: () => {
      if (resolvedAssetId && fetchAssetDetails) fetchAssetDetails(resolvedAssetId);
    },
    onVersionPublished: () => {
      if (resolvedAssetId && fetchAssetDetails) fetchAssetDetails(resolvedAssetId);
    },
    onVersionScanCompleted: () => {
      if (resolvedAssetId && fetchAssetDetails) fetchAssetDetails(resolvedAssetId);
    },
  });

  // Handle version upload
  const handleVersionUpload = useCallback(async (file: File) => {
    if (!resolvedAssetId) return;
    
    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '2.5');
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File too large (> ${maxMb}MB)`);
      return;
    }

    try {
      setUploadingVersion(true);
      setUploadProgress(0);
      await AssetAPI.createAssetVersion(String(resolvedAssetId), { file }, {
        onUploadProgress: (percent) => setUploadProgress(percent)
      });
      if (fetchAssetDetails) {
        await fetchAssetDetails(resolvedAssetId);
      }
      toast.success('Version uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading version:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to upload version';
      toast.error(errorMsg);
    } finally {
      setUploadingVersion(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [resolvedAssetId, fetchAssetDetails]);

  // Handle version publish
  const handleVersionPublish = useCallback(async (versionId: string | number) => {
    if (!resolvedAssetId) return;
    try {
      await AssetAPI.publishAssetVersion(String(resolvedAssetId), versionId);
      if (fetchAssetDetails) {
        await fetchAssetDetails(resolvedAssetId);
      }
      toast.success('Version published successfully');
    } catch (error: any) {
      console.error('Error publishing version:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to publish version';
      toast.error(errorMsg);
    }
  }, [resolvedAssetId, fetchAssetDetails]);

  // Handle version delete
  const handleVersionDelete = useCallback(async (versionId: string | number) => {
    if (!resolvedAssetId) return;
    const confirmed = window.confirm('Delete this draft version?');
    if (!confirmed) return;

    try {
      await AssetAPI.deleteAssetVersion(String(resolvedAssetId), versionId);
      if (fetchAssetDetails) {
        await fetchAssetDetails(resolvedAssetId);
      }
      toast.success('Version deleted successfully');
    } catch (error: any) {
      console.error('Error deleting version:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to delete version';
      toast.error(errorMsg);
    }
  }, [resolvedAssetId, fetchAssetDetails]);

  // Check if can upload (based on asset status and existing versions)
  const canUploadVersion = useMemo(() => {
    if (!displayAsset) return false;
    if (displayAsset.status !== 'NotSubmitted' && displayAsset.status !== 'RevisionRequired') return false;
    const hasDraft = versions.some(v => v.version_status === 'Draft');
    const latestFinalized = versions.length === 0 || versions.some(v => v.version_status === 'Finalized');
    return !hasDraft && latestFinalized;
  }, [displayAsset, versions]);

  const canSubmitAsset = useMemo(() => {
    if (!displayAsset) return false;
    return displayAsset.status === 'NotSubmitted' || displayAsset.status === 'RevisionRequired';
  }, [displayAsset]);

  const scanBadgeClass = (status?: string | null) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'scanning':
        return 'bg-yellow-100 text-yellow-800';
      case 'infected':
        return 'bg-red-100 text-red-800';
      case 'error':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Build assignment summary
  const buildAssignmentSummary = (assignments: AssetAssignment[]) => {
    const reviewers = assignments.filter((assignment) => assignment.role === 'reviewer');
    const approvers = assignments.filter((assignment) => assignment.role === 'approver');

    return {
      reviewersLabel: reviewers.length
        ? reviewers.map((assignment) => formatUser(assignment.user)).join(', ')
        : 'None assigned',
      approversLabel: approvers.length
        ? approvers.map((assignment) => formatUser(assignment.user)).join(', ')
        : 'None assigned',
    };
  };

  const { reviewersLabel, approversLabel } = useMemo(
    () => buildAssignmentSummary(assignments || []),
    [assignments]
  );

  const reviewerIds = useMemo(() => (assignments || []).filter((a) => a.role === 'reviewer').map((a) => Number(a.user)), [assignments]);
  const approverIds = useMemo(() => (assignments || []).filter((a) => a.role === 'approver').map((a) => Number(a.user)), [assignments]);
  const isReviewer = !!currentUserId && reviewerIds.includes(currentUserId);
  const isApprover = !!currentUserId && approverIds.includes(currentUserId);
  const canActOnReview = isReviewer || isApprover;
  const [reviewActionLoading, setReviewActionLoading] = useState<'start_review' | 'approve' | 'reject' | null>(null);

  const triggerReviewAction = useCallback(
    async (action: 'start_review' | 'approve' | 'reject') => {
      if (!resolvedAssetId) return;
      try {
        setReviewActionLoading(action);
        const actionToLabel: Record<typeof action, string> = {
          start_review: 'Review started',
          approve: 'Asset approved',
          reject: 'Changes requested',
        };
        await AssetAPI.reviewAsset(resolvedAssetId, action);
        if (normalizedTaskId) {
          await fetchAssets();
        }
        await fetchAsset(resolvedAssetId);
        toast.success(actionToLabel[action] || 'Action completed');
        if (fetchAssetDetails) {
          await fetchAssetDetails(resolvedAssetId);
        }
        if (onRefresh) {
          Promise.resolve(onRefresh()).catch(() => undefined);
        }
      } catch (error: any) {
        console.error(`Failed to perform ${action}:`, error);
        const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to perform action';
        toast.error(errorMsg);
      } finally {
        setReviewActionLoading(null);
      }
    },
    [resolvedAssetId, fetchAssetDetails, onRefresh]
  );

  const sortedComments = useMemo(() => {
    if (!comments || comments.length === 0) return [];
    return [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [comments]);

  const compactComments = useMemo(() => sortedComments.slice(0, 5), [sortedComments]);

  // Compact mode for TaskCard
  if (compact) {
    if (isLoading) {
      return (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
            Loading asset metadata...
          </div>
        </div>
      );
    }

    if (assetError) {
      return (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-red-500">
          Failed to load asset details: {assetError}
        </div>
      );
    }

    if (!displayAsset) {
      return (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          No asset has been linked to this task yet.
        </div>
      );
    }

    return (
      <div className="mt-3 pt-3 border-t border-gray-100" data-action>
        <div className="flex flex-col text-xs space-y-2">
          {/* Review Status */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Asset Status:</span>
            <span className={`px-2 py-0.5 rounded-full ${statusClass}`}>
              {formatStatus(displayAsset.status)}
            </span>
          </div>

          {/* Reviewer Assignments */}
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-600">Reviewers:</span>
            <span className="text-gray-900 leading-snug">{reviewersLabel}</span>
          </div>

          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-600">Approvers:</span>
            <span className="text-gray-900 leading-snug">{approversLabel}</span>
          </div>

         {/* Comments */}
          {!hideComments && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-600">Comments:</span>
              {compactComments.length > 0 ? (
                <div className="flex flex-col gap-2 text-gray-900">
                  {compactComments.map((comment) => (
                    <div key={comment.id}>
                      <span className="font-medium">{formatUser(comment.user)}:</span>{' '}
                      <span className="text-gray-700">{truncate(comment.body, 80)}</span>
                      <div className="text-gray-500 text-[11px]">
                        {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Timestamp unavailable'}
                      </div>
                    </div>
                  ))}
                  {comments.length > compactComments.length && (
                    <span className="text-xs text-gray-500">
                      Showing {compactComments.length} of {comments.length} comments
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">No comments yet</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mode for TaskDetail page
  if (isLoading) {
    return (
      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
          Loading asset details...
        </div>
      </section>
    );
  }

  if (assetError) {
    return (
      <section className="border-t border-slate-200 pt-5">
        <div className="text-sm text-red-500">Failed to load asset details: {assetError}</div>
      </section>
    );
  }

  if (!displayAsset) {
    return (
      <section className="border-t border-slate-200 pt-5">
        <div className="text-gray-500 text-sm">No asset has been linked to this task yet.</div>
      </section>
    );
  }

  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Asset Review Overview</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass}`}>
          {formatStatus(displayAsset.status)}
        </span>
      </div>

      <div className="space-y-6">
        {/* Reviewer Assignments */}
        {/* Backend allows any authenticated user to assign reviewers/approvers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Reviewer Assignments</h4>
          </div>
          <div className="text-sm text-gray-900 space-y-2">
            <div>
              <span className="font-medium">Reviewers: </span>
              {reviewersLabel === 'None assigned' ? (
                <button
                  type="button"
                  onClick={async () => {
                    setUserPickerOpen('reviewer');
                    if (allUsers.length === 0) {
                      try {
                        setLoadingUsers(true);
                        const users = await approverApi.getAllUsers();
                        setAllUsers(users as any);
                      } finally {
                        setLoadingUsers(false);
                      }
                    }
                  }}
                  className="text-gray-500 italic hover:text-gray-700 hover:underline"
                >
                  {reviewersLabel}
                </button>
              ) : (
                <>
                  <span>{reviewersLabel}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      setUserPickerOpen('reviewer');
                      if (allUsers.length === 0) {
                        try {
                          setLoadingUsers(true);
                          const users = await approverApi.getAllUsers();
                          setAllUsers(users as any);
                        } finally {
                          setLoadingUsers(false);
                        }
                      }
                    }}
                    className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    + Add
                  </button>
                </>
              )}
              {userPickerOpen === 'reviewer' && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                  {loadingUsers ? (
                    <div className="text-gray-500 text-xs">Loading users...</div>
                  ) : (
                    allUsers.map(u => (
                      <button
                        key={u.id}
                        className="block w-full text-left px-2 py-1 hover:bg-gray-50 text-xs"
                        onClick={async () => {
                          if (!resolvedAssetId) return;
                          try {
                            await AssetAPI.createAssetAssignment(resolvedAssetId, { user: u.id, role: 'reviewer' });
                            setUserPickerOpen(null);
                            if (fetchAssetDetails) {
                              await fetchAssetDetails(resolvedAssetId);
                            }
                          } catch (error) {
                            console.error('Failed to assign reviewer:', error);
                          }
                        }}
                      >
                        {u.name || u.email || `User #${u.id}`}
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => setUserPickerOpen(null)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div>
              <span className="font-medium">Approvers: </span>
              {approversLabel === 'None assigned' ? (
                <button
                  type="button"
                  onClick={async () => {
                    setUserPickerOpen('approver');
                    if (allUsers.length === 0) {
                      try {
                        setLoadingUsers(true);
                        const users = await approverApi.getAllUsers();
                        setAllUsers(users as any);
                      } finally {
                        setLoadingUsers(false);
                      }
                    }
                  }}
                  className="text-gray-500 italic hover:text-gray-700 hover:underline"
                >
                  {approversLabel}
                </button>
              ) : (
                <>
                  <span>{approversLabel}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      setUserPickerOpen('approver');
                      if (allUsers.length === 0) {
                        try {
                          setLoadingUsers(true);
                          const users = await approverApi.getAllUsers();
                          setAllUsers(users as any);
                        } finally {
                          setLoadingUsers(false);
                        }
                      }
                    }}
                    className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    + Add
                  </button>
                </>
              )}
              {userPickerOpen === 'approver' && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                  {loadingUsers ? (
                    <div className="text-gray-500 text-xs">Loading users...</div>
                  ) : (
                    allUsers.map(u => (
                      <button
                        key={u.id}
                        className="block w-full text-left px-2 py-1 hover:bg-gray-50 text-xs"
                        onClick={async () => {
                          if (!resolvedAssetId) return;
                          try {
                            await AssetAPI.createAssetAssignment(resolvedAssetId, { user: u.id, role: 'approver' });
                            setUserPickerOpen(null);
                            if (fetchAssetDetails) {
                              await fetchAssetDetails(resolvedAssetId);
                            }
                          } catch (error) {
                            console.error('Failed to assign approver:', error);
                          }
                        }}
                      >
                        {u.name || u.email || `User #${u.id}`}
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => setUserPickerOpen(null)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        {!hideComments && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Comments</h4>
            {commentsLoading ? (
              <div className="text-sm text-gray-500">Loading comments...</div>
            ) : sortedComments.length > 0 ? (
              <div className="space-y-3 mb-3">
                {sortedComments.slice(0, 5).map((comment) => (
                  <div key={comment.id} className="border border-gray-200 rounded-md p-4 space-y-1 text-sm text-gray-900">
                    <div className="font-medium">{formatUser(comment.user)}</div>
                    <div className="text-gray-700 whitespace-pre-wrap break-words">{comment.body}</div>
                    <div className="text-xs text-gray-500">
                      {comment.created_at
                        ? new Date(comment.created_at).toLocaleString()
                        : 'Timestamp unavailable'}
                    </div>
                  </div>
                ))}
                {comments.length > 5 && (
                  <div className="text-xs text-gray-500 text-center">
                    Showing 5 of {comments.length} comments
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 mb-3">No comments yet.</div>
            )}
            {/* Add Comment Form */}
            {/* Backend allows any authenticated user to add comments */}
            {resolvedAssetId && (
              <CommentInput 
                assetId={resolvedAssetId}
                onCommentAdded={() => {
                  if (fetchAssetDetails) fetchAssetDetails(resolvedAssetId);
                }} 
              />
            )}
          </div>
        )}

        {/* Version Management Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Version Management</h4>
            {canUploadVersion && (
              <label
                htmlFor="asset-version-upload"
                className={`inline-flex items-center gap-1.5 px-1 py-1 text-sm rounded-md transition-colors ${
                  uploadingVersion
                    ? 'text-indigo-400 cursor-wait'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{uploadingVersion ? 'Uploading...' : 'Upload version'}</span>
              </label>
            )}
          </div>
          <input
            id="asset-version-upload"
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVersionUpload(file);
            }}
            disabled={uploadingVersion || !canUploadVersion}
          />
          {uploadProgress !== null && (
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
            </div>
          )}
          {!canUploadVersion && displayAsset.status !== 'NotSubmitted' && displayAsset.status !== 'RevisionRequired' && (
            <p className="text-xs text-gray-500 mb-3">
              Cannot upload versions when asset is in {formatStatus(displayAsset.status)} status.
            </p>
          )}
          {versionsLoading ? (
            <div className="text-sm text-gray-500">Loading versions...</div>
          ) : versions.length > 0 ? (
            <div className="space-y-2">
              {[...versions].sort((a, b) => b.version_number - a.version_number).map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">v{version.version_number}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          version.version_status === 'Finalized'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {version.version_status}
                      </span>
                      {/* NOTE: Scan display disabled - no longer needed */}
                      {/* <span className={`px-2 py-0.5 rounded text-xs ${scanBadgeClass(version.scan_status)}`}>
                        Scan: {version.scan_status}
                      </span> */}
                    </div>
                    {/* Display file name if available */}
                    {extractFileNameFromUrl(version.file) && (
                      <div className="text-xs text-gray-600 font-medium mb-1">
                        {extractFileNameFromUrl(version.file)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* NOTE: Previously required clean scan status, but now removed */}
                    {version.version_status === 'Draft' && (
                      <button
                        type="button"
                        onClick={() => handleVersionPublish(version.id)}
                        className="px-3 py-1 text-xs rounded text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Publish
                      </button>
                    )}
                    {/* Show delete button for Draft versions */}
                    {version.version_status === 'Draft' && (
                      <button
                        type="button"
                        onClick={() => handleVersionDelete(version.id)}
                        className="px-3 py-1 text-xs rounded text-white bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
                    {/* Show download button if file exists*/}
                    {version.file && (
                      <a
                        href={version.file.startsWith('http') ? version.file : `${process.env.NEXT_PUBLIC_API_URL || ''}${version.file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 text-xs rounded text-indigo-600 hover:text-indigo-800 border border-indigo-600 hover:bg-indigo-50"
                        title="Download file"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md border border-gray-200">
              {canUploadVersion ? (
                <div>
                  <p className="mb-2">No versions uploaded yet.</p>
                  <p className="text-xs">Click "Upload Version" above to upload the first version file.</p>
                </div>
              ) : (
                <p>No versions available.</p>
              )}
            </div>
          )}
        </div>

        {/* Asset Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Asset Information</h4>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-1.5">
              <span className="text-gray-500">Team:</span>
              <span className="text-gray-900">
                {displayAsset.team ? `Team #${displayAsset.team}` : 'None'}
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-1.5">
              <span className="text-gray-500">Tags:</span>
              {displayAsset.tags && displayAsset.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {displayAsset.tags.map((tag, i) => (
                    <span
                      key={`${displayAsset.id}-tag-${i}-${tag}`}
                      className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-900">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Submit for Review Button */}
        {canSubmitAsset && (
          <div>
            <SubmitAssetButton 
              assetId={displayAsset.id} 
              hasFinalizedVersion={versions.some(v => v.version_status === 'Finalized')}
              isRevision={displayAsset.status === 'RevisionRequired'}
              onSubmitted={() => {
                if (fetchAssetDetails && resolvedAssetId) {
                  fetchAssetDetails(resolvedAssetId);
                }
                if (fetchAsset && resolvedAssetId) {
                  fetchAsset(resolvedAssetId);
                }
                if (fetchAssets && normalizedTaskId) {
                  fetchAssets();
                }
                if (onRefresh) {
                  Promise.resolve(onRefresh()).catch(() => undefined);
                }
              }}
            />
          </div>
        )}

        {/* Review Actions */}
        {displayAsset.status !== 'NotSubmitted' && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Review Actions</h4>
            {displayAsset.status === 'PendingReview' ? (
              isReviewer ? (
                <button
                  type="button"
                  onClick={() => triggerReviewAction('start_review')}
                  disabled={reviewActionLoading !== null}
                  className={`px-3 py-1.5 text-sm rounded text-white ${
                    reviewActionLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {reviewActionLoading === 'start_review' ? 'Starting...' : 'Start Review'}
                </button>
              ) : (
                <p className="text-xs text-gray-500">
                  Only assigned reviewers can start the review once the asset is submitted.
                </p>
              )
            ) : displayAsset.status === 'UnderReview' ? (
              <div className="flex flex-wrap gap-3">
                {isApprover && (
                  <button
                    type="button"
                    onClick={() => triggerReviewAction('approve')}
                    disabled={reviewActionLoading !== null}
                    className={`px-3 py-1.5 text-sm rounded text-white ${
                      reviewActionLoading === 'approve' ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {reviewActionLoading === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                )}
                {canActOnReview && (
                  <button
                    type="button"
                    onClick={() => triggerReviewAction('reject')}
                    disabled={reviewActionLoading !== null}
                    className={`px-3 py-1.5 text-sm rounded text-white ${
                      reviewActionLoading === 'reject' ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {reviewActionLoading === 'reject' ? 'Submitting...' : 'Request Changes'}
                  </button>
                )}
                {!canActOnReview && (
                  <p className="text-xs text-gray-500">
                    Only assigned reviewers or approvers can complete the review.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                No review actions available while asset is in {formatStatus(displayAsset.status)} status.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// Submit Asset Button Component
function SubmitAssetButton({ 
  assetId, 
  hasFinalizedVersion, 
  isRevision,
  onSubmitted 
}: { 
  assetId: number; 
  hasFinalizedVersion: boolean;
  isRevision: boolean;
  onSubmitted?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!hasFinalizedVersion) {
      toast.error('Please publish at least one version before submitting for review');
      return;
    }

    try {
      setSubmitting(true);
      await AssetAPI.submitAsset(String(assetId));
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (error: any) {
      console.error('Error submitting asset:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to submit asset';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
      <p className="text-sm text-yellow-800 mb-2">
        <strong>{isRevision ? 'Ready to resubmit?' : 'Ready to submit?'}</strong> Make sure you have published at least one version.
      </p>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !hasFinalizedVersion}
        className={`px-4 py-2 text-sm rounded text-white ${
          submitting || !hasFinalizedVersion
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
        title={!hasFinalizedVersion ? 'Please publish at least one version first' : ''}
      >
        {submitting ? 'Submitting...' : isRevision ? 'Resubmit for Review' : 'Submit for Review'}
      </button>
    </div>
  );
}
