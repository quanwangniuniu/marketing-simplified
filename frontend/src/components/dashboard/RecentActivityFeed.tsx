'use client';

import { ActivityEvent } from '@/types/dashboard';
import Link from 'next/link';

interface RecentActivityFeedProps {
  activities: ActivityEvent[];
}

export default function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  // Event type configuration
  const getEventConfig = (eventType: string) => {
    switch (eventType) {
      case 'task_created':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          action: 'created',
        };
      case 'approved':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          action: 'approved',
        };
      case 'rejected':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          action: 'rejected',
        };
      case 'commented':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-[#3CCED7]',
          bgColor: 'bg-[#3CCED7]/15',
          action: 'commented on',
        };
      case 'task_updated':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          ),
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          action: 'updated field',
        };
      default:
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          action: 'updated',
        };
    }
  };

  // Task status badge colors
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DONE':
      case 'APPROVED':
      case 'LOCKED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
      case 'UNDER_REVIEW':
        return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
      case 'TO_DO':
      case 'DRAFT':
      case 'SUBMITTED':
        return 'bg-gray-100 text-gray-800';
      case 'RESEARCH':
      case 'REJECTED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  // Get user initials for avatar
  const getUserInitials = (username: string) => {
    const parts = username.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  };

  // Generate consistent color for user avatar
  const getUserColor = (username: string) => {
    const colors = [
      'bg-[#3CCED7]',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
    ];
    const index = username.length % colors.length;
    return colors[index];
  };

  return (
    <div className="h-full overflow-y-auto space-y-1">
      {/* Section Header */}
      <div className="mb-2 sticky top-0 bg-white z-10 pb-1">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Recent Activity
        </h4>
      </div>

      {activities.map((activity) => {
        const config = getEventConfig(activity.event_type);

        return (
          <div
            key={activity.id}
            className="flex gap-3 py-2 hover:bg-gray-50 transition-colors -mx-2 px-2 rounded"
          >
            {/* User Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getUserColor(activity.user.username)} flex items-center justify-center text-white text-xs font-semibold`}>
              {getUserInitials(activity.user.username)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">
                    <Link
                      href={`/users/${activity.user.id}`}
                      className="font-medium text-[#3CCED7] hover:underline"
                    >
                      {activity.user.username}
                    </Link>
                    {' '}
                    <span className="text-gray-700">{config.action}</span>
                    {' '}
                    {activity.field_changed && (
                      <span className="text-gray-700">
                        &quot;<span className="font-medium">{activity.field_changed}</span>&quot;
                        {' on '}
                      </span>
                    )}
                    <Link
                      href={`/tasks/${activity.task.id}`}
                      className="text-[#3CCED7] hover:underline inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {activity.task.key || `#${activity.task.id}`}
                    </Link>
                    {activity.task.status && (
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(activity.task.status)}`}>
                        {activity.task.status.replace('_', ' ')}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Timestamp */}
              <p className="text-xs text-gray-500 mt-0.5">
                {activity.human_readable}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
