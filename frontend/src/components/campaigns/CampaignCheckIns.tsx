'use client';

import { useState, useEffect } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { CampaignCheckIn } from '@/types/campaign';
import UserAvatar from '@/people/UserAvatar';
import Button from '@/components/button/Button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Minus, AlertCircle, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BrandConfirmDialog from '@/components/campaigns-v2/BrandConfirmDialog';

interface CampaignCheckInsProps {
  campaignId: string;
  onEdit?: (checkIn: CampaignCheckIn) => void;
  onDelete?: (checkInId: string) => void;
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

const getSentimentConfig = (sentiment: string) => {
  switch (sentiment.toUpperCase()) {
    case 'POSITIVE':
      return {
        icon: CheckCircle,
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        iconColor: 'text-green-600',
        feelingText: 'Feeling positive about the campaign',
      };
    case 'NEGATIVE':
      return {
        icon: AlertCircle,
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        iconColor: 'text-red-600',
        feelingText: 'Feeling concerned about the campaign',
      };
    default: // NEUTRAL
      return {
        icon: Minus,
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-200',
        iconColor: 'text-gray-600',
        feelingText: 'Feeling neutral about the campaign',
      };
  }
};

export default function CampaignCheckIns({ campaignId, onEdit, onDelete, onCreate, refreshTrigger, isArchived = false }: CampaignCheckInsProps) {
  const [checkIns, setCheckIns] = useState<CampaignCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<CampaignCheckIn | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchCheckIns = async () => {
      if (!campaignId) return;
      
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching check-ins for campaign:', campaignId, 'refreshTrigger:', refreshTrigger);
        const response = await CampaignAPI.getCheckIns(campaignId);
        console.log('API response:', response);
        console.log('API response.data:', response.data);
        
        // Handle both paginated and non-paginated responses
        let items: CampaignCheckIn[] = [];
        const data = response.data as any; // Type assertion to handle different response formats
        if (Array.isArray(data)) {
          items = data;
        } else if (data?.results && Array.isArray(data.results)) {
          items = data.results;
        } else if (data?.items && Array.isArray(data.items)) {
          items = data.items;
        }
        
        console.log('Parsed check-ins:', items);
        setCheckIns(items);
      } catch (err: any) {
        console.error('Failed to fetch check-ins:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load check-ins');
      } finally {
        setLoading(false);
      }
    };

    fetchCheckIns();
  }, [campaignId, refreshTrigger]); // refreshTrigger triggers re-fetch

  const handleDelete = (checkIn: CampaignCheckIn) => {
    setConfirmDeleteTarget(checkIn);
  };

  const performDelete = async () => {
    if (!confirmDeleteTarget) return;
    const checkIn = confirmDeleteTarget;
    setDeleting(true);
    try {
      await CampaignAPI.deleteCheckIn(campaignId, checkIn.id);
      setCheckIns((prev) => prev.filter((item) => item.id !== checkIn.id));
      toast.success('Check-in deleted');
      setConfirmDeleteTarget(null);
      if (onDelete) {
        onDelete(checkIn.id);
      }
    } catch (err: any) {
      console.error('Failed to delete check-in:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to delete check-in');
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Check-ins</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]"></div>
          <span className="ml-3 text-gray-600">Loading check-ins...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Check-ins</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Check-ins</h2>
        {!isArchived && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (onCreate) {
                onCreate();
              } else if (onEdit) {
                onEdit({} as CampaignCheckIn); // Fallback: trigger create mode via onEdit
              }
            }}
            leftIcon={<Plus className="h-4 w-4" />}
            className="!bg-gradient-to-br !from-[#3CCED7] !to-[#A6E661] !border-transparent hover:!brightness-105 !text-white focus-visible:!ring-[#3CCED7]/30"
          >
            New Check-in
          </Button>
        )}
      </div>
      {isArchived && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">Archived campaigns cannot be edited.</p>
        </div>
      )}

      {checkIns.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No check-ins yet. Create your first check-in to track campaign health.</p>
          {!isArchived && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onCreate) {
                  onCreate();
                } else if (onEdit) {
                  onEdit({} as CampaignCheckIn); // Fallback: trigger create mode via onEdit
                }
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Check-in
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {checkIns.map((checkIn) => {
            const sentimentConfig = getSentimentConfig(checkIn.sentiment);
            const Icon = sentimentConfig.icon;
            const mainText = checkIn.note || sentimentConfig.feelingText;
            const userName = checkIn.checked_by?.username || checkIn.checked_by?.email || 'Unknown';
            const userDisplay = checkIn.checked_by ? {
              name: userName,
              email: checkIn.checked_by.email,
            } : null;

            return (
              <div
                key={checkIn.id}
                className="relative border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
                onMouseEnter={() => setHoveredRow(checkIn.id)}
                onMouseLeave={() => {
                  setHoveredRow(null);
                  setShowMenu(null);
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Sentiment Badge - Medium Size with Subtle Colors */}
                  <div className="flex-shrink-0">
                    <Badge
                      variant="outline"
                      className={`${sentimentConfig.bgColor} ${sentimentConfig.textColor} ${sentimentConfig.borderColor} flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md`}
                    >
                      <Icon className={`h-4 w-4 ${sentimentConfig.iconColor}`} />
                      {checkIn.sentiment_display}
                    </Badge>
                  </div>

                  {/* Main Content - Feeling/Observation Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-gray-900 leading-relaxed mb-2">
                      {mainText}
                    </p>
                    
                    {/* User Attribution - Secondary Info */}
                    {userDisplay && (
                      <div className="flex items-center gap-2">
                        <UserAvatar user={userDisplay} size="sm" />
                        <span className="text-sm text-gray-500">{userName}</span>
                      </div>
                    )}
                  </div>

                  {/* Timestamp and Actions - Right Side */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(checkIn.created_at)}
                    </span>
                    
                    {/* Actions on Hover */}
                    {!isArchived && hoveredRow === checkIn.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (onEdit) {
                              onEdit(checkIn);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#0E8A96] hover:bg-[#3CCED7]/10 rounded transition-colors"
                          title="Edit check-in"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(checkIn)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete check-in"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BrandConfirmDialog
        open={!!confirmDeleteTarget}
        onOpenChange={(next) => { if (!next) setConfirmDeleteTarget(null); }}
        title="Delete Check-in?"
        message="This check-in will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={performDelete}
      />
    </div>
  );
}

