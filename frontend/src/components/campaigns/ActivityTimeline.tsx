'use client';

import { useState, useEffect } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { CampaignActivityTimelineItem } from '@/types/campaign';
import UserAvatar from '@/people/UserAvatar';
import CampaignStatusBadge from './CampaignStatusBadge';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Minus, 
  BarChart3, 
  Clock,
  Image as ImageIcon
} from 'lucide-react';

interface ActivityTimelineProps {
  campaignId: string;
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

const formatFullTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function ActivityTimeline({ campaignId }: ActivityTimelineProps) {
  const [timelineItems, setTimelineItems] = useState<CampaignActivityTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await CampaignAPI.getActivityTimeline(campaignId, {
          page: currentPage,
          page_size: pageSize,
        });
        
        // Handle different response formats
        const data = response.data as any;
        let items: CampaignActivityTimelineItem[] = [];
        let count = 0;

        if (Array.isArray(data)) {
          // Simple array response
          items = data;
          count = data.length;
        } else if (data?.results && Array.isArray(data.results)) {
          // Standard pagination format: { count, results, next, previous }
          items = data.results;
          count = data.count || data.results.length;
        } else if (data?.items && Array.isArray(data.items)) {
          // Alternative format: { items, total, page, page_size }
          items = data.items;
          count = data.total || data.items.length;
        } else {
          items = [];
          count = 0;
        }

        setTimelineItems(items);
        setTotalCount(count);
      } catch (err: any) {
        console.error('Failed to fetch activity timeline:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load activity timeline');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchTimeline();
    }
  }, [campaignId, currentPage, pageSize]);

  // Reset to first page when campaignId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [campaignId]);

  const renderEventIcon = (item: CampaignActivityTimelineItem) => {
    switch (item.type) {
      case 'status_change':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#3CCED7]/15 flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-[#0E8A96]" />
          </div>
        );
      case 'check_in':
        const sentiment = item.details.sentiment?.toUpperCase();
        if (sentiment === 'POSITIVE') {
          return (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          );
        } else if (sentiment === 'NEGATIVE') {
          return (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
          );
        } else {
          return (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Minus className="h-4 w-4 text-gray-600" />
            </div>
          );
        }
      case 'performance_snapshot':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </div>
        );
      default:
        return null;
    }
  };

  const renderEventContent = (item: CampaignActivityTimelineItem) => {
    const userName = item.user?.username || item.user?.email || 'Unknown';
    const userDisplay = item.user ? {
      name: userName,
      email: item.user.email,
    } : null;

    switch (item.type) {
      case 'status_change':
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-900">
                <span className="font-medium">{userName}</span> changed status
              </span>
              <CampaignStatusBadge status={item.details.from_status as any} />
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <CampaignStatusBadge status={item.details.to_status as any} />
            </div>
            {item.details.note && (
              <p className="text-sm text-gray-600 mt-1">{item.details.note}</p>
            )}
          </div>
        );

      case 'check_in':
        const sentiment = item.details.sentiment?.toUpperCase();
        const sentimentColor = 
          sentiment === 'POSITIVE' ? 'bg-green-100 text-green-800' :
          sentiment === 'NEGATIVE' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800';
        
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-900">
                <span className="font-medium">{userName}</span> checked in
              </span>
              <Badge variant="outline" className={`text-xs ${sentimentColor}`}>
                {item.details.sentiment_display || sentiment || 'Neutral'}
              </Badge>
            </div>
            {item.details.note && (
              <p className="text-sm text-gray-600 mt-1">{item.details.note}</p>
            )}
          </div>
        );

      case 'performance_snapshot':
        return (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm text-gray-900">
                <span className="font-medium">{userName}</span> recorded performance snapshot
              </span>
              {item.details.milestone_type_display && (
                <Badge variant="outline" className="text-xs">
                  {item.details.milestone_type_display}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              {item.details.spend && (
                <span>
                  <span className="font-medium">Spend:</span> ${item.details.spend}
                </span>
              )}
              {item.details.metric_type_display && item.details.metric_value && (
                <span>
                  <span className="font-medium">{item.details.metric_type_display}:</span> {item.details.metric_value}
                </span>
              )}
              {item.details.percentage_change && (
                <span className={item.details.percentage_change.startsWith('-') ? 'text-red-600' : 'text-green-600'}>
                  <span className="font-medium">Change:</span> {item.details.percentage_change}%
                </span>
              )}
            </div>
            {item.details.notes && (
              <p className="text-sm text-gray-600 mt-2">{item.details.notes}</p>
            )}
            {item.details.screenshot_url && (
              <div className="mt-2">
                <a
                  href={item.details.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#0E8A96] hover:text-[#0A6F78]"
                >
                  <ImageIcon className="h-4 w-4" />
                  View screenshot
                </a>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]"></div>
          <span className="ml-3 text-gray-600">Loading timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (timelineItems.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No activity recorded yet.</p>
        </div>
      </div>
    );
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of timeline when page changes
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-4">
          {timelineItems.map((item, index) => {
            const userName = item.user?.username || item.user?.email || 'Unknown';
            const userDisplay = item.user ? {
              name: userName,
              email: item.user.email,
            } : null;

            return (
              <div key={item.id} className="relative flex gap-4 pl-2">
                {/* Icon */}
                <div className="relative z-10">
                  {renderEventIcon(item)}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start gap-3">
                    {userDisplay && (
                      <UserAvatar user={userDisplay} size="sm" />
                    )}
                    {renderEventContent(item)}
                    <div className="flex-shrink-0 text-right">
                      <div 
                        className="text-xs text-gray-500"
                        title={formatFullTimestamp(item.timestamp)}
                      >
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Page Info */}
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex}</span> to{' '}
              <span className="font-medium">{endIndex}</span> of{' '}
              <span className="font-medium">{totalCount}</span> activities
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  const isCurrentPage = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isCurrentPage
                          ? 'bg-[#3CCED7] text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

