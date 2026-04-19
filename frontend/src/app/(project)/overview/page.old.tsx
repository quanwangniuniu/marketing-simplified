'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DashboardAPI } from '@/lib/api/dashboardApi';
import { DashboardSummary } from '@/types/dashboard';
import toast from 'react-hot-toast';
import StatusOverviewChart from '@/components/dashboard/StatusOverviewChart';
import PriorityBreakdownChart from '@/components/dashboard/PriorityBreakdownChart';
import TypesOfWorkChart from '@/components/dashboard/TypesOfWorkChart';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import TimeMetricsCards from '@/components/dashboard/TimeMetricsCards';

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecentActivityExpanded, setIsRecentActivityExpanded] = useState(false);
  const searchParams = useSearchParams();
  const projectId = useMemo(() => {
    const value = searchParams.get('project_id');
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const taskId = useMemo(() => {
    const value = searchParams.get('task_id');
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!projectId) {
        setDashboardData(null);
        setError('Project summary requires a project. Open a task to view its summary.');
        return;
      }

      const response = await DashboardAPI.getSummary({ project_id: projectId });

      // Validate response data
      if (!response.data) {
        throw new Error('No data received from server');
      }

      setDashboardData(response.data);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);

      // More robust error message handling
      let errorMsg = 'Failed to load dashboard data';
      if (error?.response?.status === 404) {
        errorMsg = 'Dashboard endpoint not found. Please check backend configuration.';
      } else if (error?.response?.status === 401) {
        errorMsg = 'Unauthorized. Please log in again.';
      } else if (error?.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }

      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-600 mb-4">{error || 'An unknown error occurred'}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketing Simplified Agile</h1>
              <p className="text-sm text-gray-600 mt-1">Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              {taskId && (
                <Link
                  href={`/tasks/${taskId}`}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Go back to task
                </Link>
              )}
              {projectId && (
                <Link
                  href={`/tasks?project_id=${projectId}`}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back to project tasks
                </Link>
              )}
              <Link
                href="/projects"
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back to Projects
              </Link>
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Time Metrics Cards */}
        <TimeMetricsCards metrics={dashboardData.time_metrics} />

        {/* Charts Grid - First Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Status Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-[320px] flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-gray-900">Status overview</h3>
              <p className="text-xs text-gray-600 mt-1">
                Get a snapshot of the status of your work items.{' '}
                <a href="/tasks" className="text-blue-600 hover:text-blue-700 hover:underline">
                  View all work items
                </a>
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <StatusOverviewChart data={dashboardData.status_overview} />
            </div>
          </div>

          {/* Recent Activity */}
          <div
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col ${
              isRecentActivityExpanded ? 'h-[480px]' : 'h-[320px]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Recent activity</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Stay up to date with what&apos;s happening across the space.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecentActivityExpanded((prev) => !prev)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label={
                  isRecentActivityExpanded ? 'Collapse recent activity panel' : 'Expand recent activity panel'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <RecentActivityFeed activities={dashboardData.recent_activity} />
            </div>
          </div>
        </div>

        {/* Charts Grid - Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Priority Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-[400px] flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-gray-900">Priority breakdown</h3>
              <p className="text-xs text-gray-600 mt-1">
                Get a holistic view of how work is being prioritized. How to manage priorities for spaces.
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <PriorityBreakdownChart data={dashboardData.priority_breakdown} />
            </div>
          </div>

          {/* Types of Work */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-[400px] flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-gray-900">Types of work</h3>
              <p className="text-xs text-gray-600 mt-1">
                Get a breakdown of work items by their types.{' '}
                <a href="/tasks" className="text-blue-600 hover:text-blue-700 hover:underline">
                  View all items
                </a>
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <TypesOfWorkChart data={dashboardData.types_of_work} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
