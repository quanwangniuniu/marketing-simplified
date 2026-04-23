import { useState, useEffect } from 'react';
import api, { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/authStore';

interface Plan {
  id: number;
  name: string;
  desc: string | null;
  max_team_members: number;
  max_previews_per_day: number;
  max_tasks_per_day: number;
  stripe_price_id: string;
  price: number | null;
  price_currency: string | null;
  price_id: string;
}

interface SwitchPlanResponse {
  requested: boolean;
}

interface UsePlanReturn {
  plans: Plan[];
  loading: boolean;
  error: string | null;
  fetchPlans: () => Promise<void>;
  createCheckoutSession: (planId: number) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  switchPlan: (planId: number) => Promise<SwitchPlanResponse>;
  handleSubscribe: (planId: number) => Promise<void>;
}

export default function usePlan(enabled = true): UsePlanReturn {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/stripe/plans/');
      setPlans(response.data.results || []);
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 403) {
        const { refreshOrganizationAccessToken } = useAuthStore.getState();
        const refreshResult = await refreshOrganizationAccessToken();

        if (refreshResult.success) {
          try {
            const retryResponse = await api.get('/api/stripe/plans/');
            setPlans(retryResponse.data.results || []);
            return;
          } catch (retryError: any) {
            console.error('Error fetching plans after refresh:', retryError);
          }
        }

        setError('Session expired. Please sign in again to view plans.');
        setPlans([]);
        return;
      }

      console.error('Error fetching plans:', error);
      let errorMessage = 'Failed to fetch plans';

      if (error.response?.data) {
        const errorData = error.response.data;

        if (errorData.error) {
          errorMessage = errorData.error;
        }
      }

      setError(errorMessage);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const createCheckoutSession = async (planId: number) => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await api.post('/api/stripe/checkout/', {
        plan_id: planId,
        success_url: `${baseUrl}/plans`,
        cancel_url: `${baseUrl}/plans`
      });

      // Backend now returns JSON with checkout_url instead of 303 redirect
      if (response.data && response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
        return;
      }

      throw new Error('No checkout URL received');
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  };

  const cancelSubscription = async () => {
    try {
      await api.post('/api/stripe/subscription/cancel/');
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  };

  const switchPlan = async (planId: number): Promise<SwitchPlanResponse> => {
    try {
      const response = await api.post('/api/stripe/plans/switch/', {
        plan_id: planId
      });
      return response.data;
    } catch (error: any) {
      console.error('Error switching plan:', error);
      throw error;
    }
  };

  const handleSubscribe = async (planId: number) => {
    const user = useAuthStore.getState().user;
    const currentPlanId = user?.organization?.plan_id;

    // Check if user has active subscription
    if (currentPlanId) {
      // User has subscription - use switch instead of checkout
      const currentPlan = plans.find(p => p.id === currentPlanId);
      const newPlan = plans.find(p => p.id === planId);

      if (!currentPlan || !newPlan) {
        toast.error('Unable to determine plan details');
        return;
      }

      try {
        await switchPlan(planId);

        // Poll for plan update (webhook will have processed it)
        await new Promise<void>((resolve, reject) => {
          let pollCount = 0;
          const maxPolls = 10; // Max 5 seconds (10 * 500ms)

          const pollInterval = setInterval(async () => {
            pollCount++;

            try {
              const user = await authAPI.getCurrentUser();

              if (user.organization?.plan_id === planId) {
                // Update auth store
                const { setUser } = useAuthStore.getState();
                setUser(user);
                // Plan switched completed
                clearInterval(pollInterval);
                toast.success('Plan switched successfully');
                resolve();
              } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                toast.error('Plan switch is taking longer than expected. Please refresh the page.');
                resolve(); // Still resolve to stop loading
              }
            } catch (error: any) {
              if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                toast.error('Unable to verify plan switch status. Please refresh the page.');
                resolve(); // Still resolve to stop loading
              }
            }
          }, 500);
        });
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Failed to switch plan';
        toast.error(errorMessage);
        throw error;
      }
    } else {
      // No subscription - use normal checkout
      await createCheckoutSession(planId);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchPlans();
  }, [enabled]);

  return {
    plans,
    loading,
    error,
    fetchPlans,
    createCheckoutSession,
    cancelSubscription,
    switchPlan,
    handleSubscribe
  };
}
