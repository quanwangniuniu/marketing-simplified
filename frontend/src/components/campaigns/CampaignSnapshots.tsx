'use client';

import { useState, useEffect } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { PerformanceSnapshot } from '@/types/campaign';
import UserAvatar from '@/people/UserAvatar';
import Button from '@/components/button/Button';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Minus, Plus, Edit, Trash2, Paperclip, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import BrandConfirmDialog from '@/components/campaigns-v2/BrandConfirmDialog';

interface CampaignSnapshotsProps {
  campaignId: string;
  onEdit?: (snapshot: PerformanceSnapshot) => void;
  onDelete?: (snapshotId: string) => void;
  onCreate?: () => void;
  refreshTrigger?: number; // Trigger refresh when this value changes
  isArchived?: boolean; // Whether the campaign is archived
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
};

const getTrendConfig = (percentageChange: string | null) => {
  if (percentageChange === null || percentageChange === undefined) {
    return {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200',
      label: 'Stable',
    };
  }
  const change = parseFloat(percentageChange);
  if (change > 0) {
    return {
      icon: ArrowUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200',
      label: `+${change.toFixed(1)}%`,
    };
  } else if (change < 0) {
    return {
      icon: ArrowDown,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200',
      label: `${change.toFixed(1)}%`,
    };
  } else {
    return {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200',
      label: 'Stable',
    };
  }
};

export default function CampaignSnapshots({ campaignId, onEdit, onDelete, onCreate, refreshTrigger, isArchived = false }: CampaignSnapshotsProps) {
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<string>>(new Set());
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<PerformanceSnapshot | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchSnapshots = async () => {
      if (!campaignId) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await CampaignAPI.getSnapshots(campaignId);
        const data = response.data as any;
        let items: PerformanceSnapshot[] = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data?.results && Array.isArray(data.results)) {
          items = data.results;
        } else if (data?.items && Array.isArray(data.items)) {
          items = data.items;
        }
        setSnapshots(items);
      } catch (err: any) {
        console.error('Failed to fetch snapshots:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load snapshots');
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshots();
  }, [campaignId, refreshTrigger]);

  const handleDelete = (snapshot: PerformanceSnapshot) => {
    setConfirmDeleteTarget(snapshot);
  };

  const performDelete = async () => {
    if (!confirmDeleteTarget) return;
    const snapshot = confirmDeleteTarget;
    setDeleting(true);
    try {
      await CampaignAPI.deleteSnapshot(campaignId, snapshot.id);
      setSnapshots((prev) => prev.filter((item) => item.id !== snapshot.id));
      toast.success('Snapshot deleted');
      setConfirmDeleteTarget(null);
      if (onDelete) {
        onDelete(snapshot.id);
      }
    } catch (err: any) {
      console.error('Failed to delete snapshot:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to delete snapshot');
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (snapshotId: string) => {
    setExpandedSnapshots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(snapshotId)) {
        newSet.delete(snapshotId);
      } else {
        newSet.add(snapshotId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Snapshots</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]"></div>
          <span className="ml-3 text-gray-600">Loading snapshots...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Snapshots</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Performance Snapshots</h2>
        {!isArchived && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (onCreate) {
                onCreate();
              }
            }}
            leftIcon={<Plus className="h-4 w-4" />}
            className="!bg-gradient-to-br !from-[#3CCED7] !to-[#A6E661] !border-transparent hover:!brightness-105 !text-white focus-visible:!ring-[#3CCED7]/30"
          >
            New Snapshot
          </Button>
        )}
      </div>
      {isArchived && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">Archived campaigns cannot be edited.</p>
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No performance snapshots yet. Create your first snapshot to document campaign milestones.</p>
          {!isArchived && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onCreate) {
                  onCreate();
                }
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Snapshot
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => {
            const isExpanded = expandedSnapshots.has(snapshot.id);
            const trendConfig = getTrendConfig(snapshot.percentage_change);
            const TrendIcon = trendConfig.icon;
            const userName = snapshot.snapshot_by?.username || snapshot.snapshot_by?.email || 'Unknown';
            const userDisplay = snapshot.snapshot_by ? {
              name: userName,
              email: snapshot.snapshot_by.email,
            } : null;

            return (
              <div
                key={snapshot.id}
                className="relative border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                onMouseEnter={() => setHoveredRow(snapshot.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Card Header - Always Visible */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(snapshot.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Milestone Badge */}
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="bg-[#3CCED7]/10 text-[#1a9ba3] border-[#3CCED7]/30">
                        {snapshot.milestone_type_display}
                      </Badge>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Spend */}
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(snapshot.spend)}
                          </span>
                        </div>

                        {/* Metric */}
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-600">{snapshot.metric_type_display}:</span>
                          <span className="text-sm font-semibold text-gray-900">{parseFloat(snapshot.metric_value).toLocaleString()}</span>
                        </div>

                        {/* Trend Indicator */}
                        {snapshot.percentage_change !== null && (
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={`${trendConfig.bgColor} ${trendConfig.color} ${trendConfig.borderColor} flex items-center gap-1`}
                            >
                              <TrendIcon className={`h-3 w-3 ${trendConfig.color}`} />
                              {trendConfig.label}
                            </Badge>
                          </div>
                        )}

                        {/* Attachment Marker */}
                        {snapshot.screenshot_url && (
                          <div className="flex items-center">
                            <Paperclip className="h-4 w-4 text-gray-400" />
                          </div>
                        )}

                        {/* User and Timestamp */}
                        <div className="flex items-center gap-2 ml-auto">
                          {userDisplay && (
                            <UserAvatar user={userDisplay} size="sm" />
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(snapshot.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse Icon and Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {/* Actions on Hover (when not expanded) */}
                      {!isArchived && !isExpanded && hoveredRow === snapshot.id && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEdit) {
                                onEdit(snapshot);
                              }
                            }}
                            className="p-1.5 text-gray-600 hover:text-[#0E8A96] hover:bg-[#3CCED7]/10 rounded transition-colors"
                            title="Edit snapshot"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(snapshot);
                            }}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete snapshot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                    <div className="space-y-4">
                      {/* Notes */}
                      {snapshot.notes && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">Observations</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{snapshot.notes}</p>
                        </div>
                      )}

                      {/* Screenshot Preview */}
                      {snapshot.screenshot_url && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Screenshot</h4>
                          <div className="border border-gray-200 rounded-md overflow-hidden">
                            <img
                              src={snapshot.screenshot_url}
                              alt="Performance snapshot"
                              className="w-full h-auto max-h-96 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Additional Metrics */}
                      {snapshot.additional_metrics && Object.keys(snapshot.additional_metrics).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Metrics</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(snapshot.additional_metrics).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="text-gray-600">{key}:</span>
                                <span className="ml-2 font-medium text-gray-900">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {!isArchived && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEdit) {
                                onEdit(snapshot);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-[#0E8A96] hover:bg-[#3CCED7]/10 rounded transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(snapshot);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BrandConfirmDialog
        open={!!confirmDeleteTarget}
        onOpenChange={(next) => { if (!next) setConfirmDeleteTarget(null); }}
        title="Delete Snapshot?"
        message="This snapshot will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={performDelete}
      />
    </div>
  );
}

