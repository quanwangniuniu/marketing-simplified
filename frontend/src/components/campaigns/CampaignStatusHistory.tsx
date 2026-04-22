'use client';

import { useState, useEffect } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { CampaignStatusHistoryItem } from '@/types/campaign';
import CampaignStatusBadge from './CampaignStatusBadge';
import { ArrowRight } from 'lucide-react';

interface CampaignStatusHistoryProps {
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

export default function CampaignStatusHistory({ campaignId }: CampaignStatusHistoryProps) {
  const [historyItems, setHistoryItems] = useState<CampaignStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await CampaignAPI.getStatusHistory(campaignId);
        const items = Array.isArray(response.data) ? response.data : [];
        setHistoryItems(items);
      } catch (err: any) {
        console.error('Failed to fetch status history:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load status history');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchHistory();
    }
  }, [campaignId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]"></div>
          <span className="ml-3 text-gray-600">Loading status history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (historyItems.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No status changes recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
      
      <div className="relative">
        {/* Timeline line - more formal color */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
        
        <div className="space-y-3">
          {historyItems.map((item) => {
            return (
              <div key={item.id} className="relative flex gap-4 pl-2">
                {/* Timeline node - simple dot */}
                <div className="relative z-10">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gray-400 mt-2"></div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Status Transition - Primary Visual */}
                    <div className="flex items-center gap-2 flex-1">
                      {/* Old Status - De-emphasized */}
                      <div className="min-w-[100px]">
                        <span className="text-sm font-normal text-gray-600">
                          {item.from_status_display}
                        </span>
                      </div>
                      
                      {/* Arrow */}
                      <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      
                      {/* New Status - Emphasized */}
                      <div className="min-w-[100px]">
                        <span className="text-sm font-semibold text-gray-900">
                          {item.to_status_display}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp - Secondary info */}
                    <div className="flex-shrink-0 text-right">
                      <div 
                        className="text-xs text-gray-500"
                        title={formatFullTimestamp(item.created_at)}
                      >
                        {formatTimestamp(item.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Note - Formal rationale */}
                  {item.note && (
                    <p className="text-sm text-gray-600 mt-2 ml-0 italic">
                      {item.note}
                    </p>
                  )}
                  
                  {/* User attribution - Very subtle */}
                  {item.changed_by && (
                    <p className="text-xs text-gray-400 mt-1 ml-0">
                      by {item.changed_by.username || item.changed_by.email}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

