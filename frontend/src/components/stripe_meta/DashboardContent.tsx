'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, User, CheckCircle, BarChart3, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import toast from 'react-hot-toast';
import useStripe from '@/hooks/useStripe';
import usePlan from '@/hooks/usePlan';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardContentProps {
  user: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    organization?: {
      id: number;
      name: string;
    } | null;
  };
}

function DashboardSummarySkeleton({ showButton = false }: { showButton?: boolean }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      {showButton && <Skeleton className="h-10 w-full rounded-lg" />}
    </div>
  );
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const { getSubscription, getUsage } = useStripe();
  const { cancelSubscription } = usePlan();
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const authUser = useAuthStore((state) => state.user);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isOrgAdmin = !!authUser?.roles?.includes('Organization Admin');

  const handleSubscriptionClick = () => {
    router.push('/plans');
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      // Initiate cancellation
      await cancelSubscription();
      
      // Poll for subscription status update (webhook will have processed it)
      let pollCount = 0;
      const maxPolls = 10; // Max 5 seconds (10 * 500ms)
      
      pollIntervalRef.current = setInterval(async () => {
        pollCount++;
        
        try {
          // Try to fetch subscription - if it returns null, cancellation succeeded
          const subscriptionData = await getSubscription();
          
          if (subscriptionData === null) {
            // Subscription no longer exists (webhook has processed it)
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast.success('Subscription canceled successfully');
            
            // Update local state
            setSubscription(null);
            setUsage(null);
            
            // Refresh user data to get updated plan_id
            const { getCurrentUser } = useAuthStore.getState();
            await getCurrentUser();
            setIsCanceling(false);
          } else {
            // Subscription still exists - keep polling
            if (pollCount >= maxPolls) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              toast.error('Cancellation is taking longer than expected. Please refresh the page.');
              setIsCanceling(false);
            }
          }
        } catch (error: any) {
          // Unexpected error - keep polling
          if (pollCount >= maxPolls) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast.error('Unable to verify cancellation status. Please refresh the page.');
            setIsCanceling(false);
          }
        }
      }, 500); // Poll every 500ms
      
    } catch (error: any) {
      console.error('Failed to cancel subscription:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel subscription');
      setIsCanceling(false);
    }
  };

  useEffect(() => {
    setLastUpdated(new Date().toLocaleDateString());
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (user?.organization?.id) {
        setIsLoading(true);
        try {
          const subscriptionData = await getSubscription();
          setSubscription(subscriptionData);
          
          // Only try to fetch usage if there's an active subscription
          try {
            const usageData = await getUsage();
            setUsage(usageData);
          } catch (usageError: any) {
            // If usage fetch fails (e.g., no active subscription), clear usage
            if (usageError.response?.status === 400 || usageError.response?.status === 404) {
              setUsage(null);
            } else {
              console.error('Failed to fetch usage:', usageError);
            }
          }
        } catch (error) {
          console.error('Failed to fetch dashboard data:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Clear data when no organization
        setSubscription(null);
        setUsage(null);
      }
    };

    fetchData();
    
    // Cleanup: clear polling interval on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [getSubscription, getUsage, user?.organization?.id]); // Only depend on organization ID

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">Dashboard</div>
        <div className="text-sm text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span>Last updated:</span>
            {lastUpdated ? (
              <span>{lastUpdated}</span>
            ) : (
              <Skeleton className="h-4 w-20" />
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="group border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-800">Account</div>
            <div className="w-8 h-8 bg-gradient-to-br  rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Name</span>
              <span className="text-sm text-gray-800">{user?.first_name} {user?.last_name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Email</span>
              <span className="text-sm text-gray-800">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-600">Username</span>
              <span className="text-sm text-gray-800">{user?.username}</span>
            </div>
          </div>
        </div>

        <div
          className="group border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300  hover:-translate-y-1 cursor-pointer"
          onClick={handleSubscriptionClick}
          role="button"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-800">Subscription</div>
            <div className="w-8 h-8 bg-gradient-to-br rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>
          {user?.organization ? (
            isLoading ? (
              <DashboardSummarySkeleton showButton={isOrgAdmin} />
            ) : subscription ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Plan</span>
                  <span className="text-sm font-semibold text-green-600">{subscription.plan.name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Status</span>
                  <span className={`text-sm font-medium ${subscription.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {subscription.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Next Billing</span>
                  <span className="text-sm text-gray-800">
                    {subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                {subscription.is_active && authUser?.organization?.plan_id && isOrgAdmin && (
                  <div className="pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelSubscription();
                      }}
                      disabled={isCanceling}
                      className='w-full px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-300 flex items-center justify-center gap-2'
                    >
                      {isCanceling && <Loader2 className="w-4 h-4 animate-spin" />}
                      {!isCanceling && 'Cancel Subscription'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-2">No Subscription</p>
                <p className="text-xs text-gray-400">You don&apos;t have an active subscription yet.</p>
              </div>
            )
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-2">Organization Required</p>
                <p className="text-xs text-gray-400">You haven&apos;t joined any organization, so subscription information is not available.</p>
            </div>
          )}
        </div>

        <div className="group border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300  hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-800">Usage</div>
            <div className="w-8 h-8 bg-gradient-to-br  rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
          </div>
          {user?.organization ? (
            isLoading ? (
              <DashboardSummarySkeleton />
            ) : usage ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Previews</span>
                  <span className="text-sm text-gray-800">
                    {usage.previews_used} / {subscription?.plan?.max_previews_per_day || 'Unlimited'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Tasks</span>
                  <span className="text-sm text-gray-800">
                    {usage.tasks_used} / {subscription?.plan?.max_tasks_per_day || 'Unlimited'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium text-gray-600">Team Members</span>
                  <span className="text-sm text-gray-800">
                    1 / {subscription?.plan?.max_team_members || 'Unlimited'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-2">No Usage Data</p>
                <p className="text-xs text-gray-400">No usage records found for today.</p>
              </div>
            )
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-2">Organization Required</p>
                <p className="text-xs text-gray-400">You haven&apos;t joined any organization, so usage tracking is not available.</p>
            </div>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-gray-800">Recent Activity</div>
          <div className="w-8 h-8 bg-gradient-to-br  rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No recent activity to display</p>
        </div>
      </div>
    </div>
  );
}
