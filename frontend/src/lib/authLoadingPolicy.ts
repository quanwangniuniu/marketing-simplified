"use client";

type AuthLoadingRoutePolicy = {
  path?: string;
  prefix?: string;
  deferGlobalAuthBlock?: boolean;
  suppressProtectedRouteLoading?: boolean;
  deferOnboardingCheckBlock?: boolean;
};

const AUTH_LOADING_ROUTE_POLICIES: AuthLoadingRoutePolicy[] = [
  {
    prefix: "/agent",
    deferGlobalAuthBlock: true,
    suppressProtectedRouteLoading: true,
    deferOnboardingCheckBlock: true,
  },
  {
    path: "/profile",
    deferGlobalAuthBlock: true,
    deferOnboardingCheckBlock: true,
  },
];

function matchesRoutePolicy(pathname: string, policy: AuthLoadingRoutePolicy) {
  if (policy.path) {
    return pathname === policy.path;
  }

  if (policy.prefix) {
    return pathname === policy.prefix || pathname.startsWith(`${policy.prefix}/`);
  }

  return false;
}

export function getAuthLoadingRoutePolicy(pathname?: string | null) {
  if (!pathname) {
    return {
      deferGlobalAuthBlock: false,
      suppressProtectedRouteLoading: false,
      deferOnboardingCheckBlock: false,
    };
  }

  const matchedPolicy = AUTH_LOADING_ROUTE_POLICIES.find((policy) =>
    matchesRoutePolicy(pathname, policy)
  );

  return {
    deferGlobalAuthBlock: matchedPolicy?.deferGlobalAuthBlock ?? false,
    suppressProtectedRouteLoading: matchedPolicy?.suppressProtectedRouteLoading ?? false,
    deferOnboardingCheckBlock: matchedPolicy?.deferOnboardingCheckBlock ?? false,
  };
}

export const authLoadingRoutePolicies = AUTH_LOADING_ROUTE_POLICIES;
