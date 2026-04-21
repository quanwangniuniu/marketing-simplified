'use client';

import { Suspense, useState } from 'react';
import { Check, Info, Loader2, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';
import usePlan from '@/hooks/usePlan';
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

interface PlanCardNewProps {
  plan: Plan;
  isCurrent: boolean;
  isPopular: boolean;
  canManage: boolean;
  onSubscribe: (planId: number) => Promise<void>;
  ctaLabel: string;
}

function formatPrice(plan: Plan): { amount: string; suffix: string } {
  if (plan.price === null || plan.price === 0) {
    return { amount: 'Free', suffix: '' };
  }
  const currency = plan.price_currency?.toUpperCase() === 'USD' ? '$' : plan.price_currency ?? '$';
  return { amount: `${currency}${plan.price}`, suffix: '/mo' };
}

function PlanCardNew({ plan, isCurrent, isPopular, canManage, onSubscribe, ctaLabel }: PlanCardNewProps) {
  const [loading, setLoading] = useState(false);
  const { amount, suffix } = formatPrice(plan);

  const handleClick = async () => {
    if (loading || isCurrent) return;
    setLoading(true);
    try {
      await onSubscribe(plan.id);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { label: 'Team members', value: plan.max_team_members, tooltip: `Up to ${plan.max_team_members} team members.` },
    { label: 'Previews / day', value: plan.max_previews_per_day, tooltip: `Generate up to ${plan.max_previews_per_day} previews per day.` },
    { label: 'Tasks / day', value: plan.max_tasks_per_day, tooltip: `Run up to ${plan.max_tasks_per_day} tasks per day.` },
  ];

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-6 transition-shadow hover:shadow-md ${
        isCurrent
          ? 'border-[#3CCED7] ring-1 ring-[#3CCED7]/40 shadow-sm'
          : isPopular
            ? 'border-[#A6E661]/70'
            : 'border-gray-200'
      }`}
    >
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
          {plan.desc && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{plan.desc}</p>
          )}
        </div>
        {isPopular && !isCurrent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" />
            Popular
          </span>
        )}
        {isCurrent && (
          <span className="inline-flex items-center rounded-full border border-[#3CCED7]/50 bg-[#3CCED7]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#3CCED7]">
            Current
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-gray-900">{amount}</span>
        {suffix && <span className="text-sm font-medium text-gray-500">{suffix}</span>}
      </div>

      {/* CTA */}
      <button
        onClick={handleClick}
        disabled={loading || isCurrent || !canManage}
        className={`mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity ${
          isCurrent
            ? 'bg-gray-100 text-gray-600 cursor-default'
            : 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isCurrent ? 'Current plan' : ctaLabel}
      </button>

      {!canManage && !isCurrent && (
        <p className="mt-2 text-[11px] text-gray-500 text-center">
          Only Organization Admins can change plans.
        </p>
      )}

      {/* Features */}
      <ul className="mt-6 space-y-2.5 border-t border-gray-100 pt-6">
        {features.map((feat) => (
          <li key={feat.label} className="flex items-center justify-between group">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3CCED7]/10">
                <Check className="h-3 w-3 text-[#3CCED7]" />
              </span>
              <span className="text-sm text-gray-700 truncate">
                {feat.label}:
                <span className="ml-1 font-medium text-gray-900">{feat.value}</span>
              </span>
            </div>
            <span className="relative" title={feat.tooltip}>
              <Info className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-32 mt-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="pt-4 space-y-2 border-t border-gray-100">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SubscriptionV2Content() {
  const { plans, loading, error, handleSubscribe } = usePlan();
  const user = useAuthStore((s) => s.user);
  const currentPlanId = user?.organization?.plan_id ?? null;
  const isOrgAdmin = !!user?.roles?.includes('Organization Admin');

  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const popularIndex = plans.length >= 2 ? plans.length - 2 : -1;

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Subscription</h1>
            <p className="mt-1 text-sm text-gray-500">
              Choose the plan that fits your team. Upgrade or downgrade anytime.
            </p>
          </div>

          {/* Current plan banner */}
          {currentPlan ? (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-[#3CCED7]/30 bg-gradient-to-r from-[#3CCED7]/5 to-[#A6E661]/5 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#3CCED7]">
                  Current Plan
                </div>
                <div className="mt-0.5 text-base font-semibold text-gray-900">
                  {currentPlan.name}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  {formatPrice(currentPlan).amount}
                  <span className="ml-1">{formatPrice(currentPlan).suffix}</span>
                </div>
              </div>
            </div>
          ) : !loading && !error && plans.length > 0 ? (
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
              <div className="text-sm text-gray-700">
                You don&apos;t have an active subscription yet. Pick a plan below to get started.
              </div>
            </div>
          ) : null}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Plans grid */}
          {loading ? (
            <SubscriptionSkeleton />
          ) : plans.length === 0 && !error ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
              <p className="text-sm text-gray-500">No plans available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan, index) => {
                const isCurrent = plan.id === currentPlanId;
                const isPopular = index === popularIndex;
                const ctaLabel = currentPlanId ? 'Switch plan' : 'Subscribe';
                return (
                  <PlanCardNew
                    key={plan.id}
                    plan={plan}
                    isCurrent={isCurrent}
                    isPopular={isPopular}
                    canManage={isOrgAdmin}
                    onSubscribe={handleSubscribe}
                    ctaLabel={ctaLabel}
                  />
                );
              })}
            </div>
          )}

          <p className="mt-6 text-xs text-gray-400">
            All prices in USD. Billing is handled securely by Stripe.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function SubscriptionV2Page() {
  return (
    <ProtectedRoute loadingComponent={<SubscriptionV2Skeleton />}>
      <Suspense fallback={<SubscriptionV2Skeleton />}>
        <SubscriptionV2Content />
      </Suspense>
    </ProtectedRoute>
  );
}

function SubscriptionV2Skeleton() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <SubscriptionSkeleton />
        </div>
      </div>
    </DashboardLayout>
  );
}
