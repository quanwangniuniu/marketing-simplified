"use client";

type AuthLoadingRoutePolicy = {
  path?: string;
  prefix?: string;
  deferGlobalAuthBlock?: boolean;
  suppressProtectedRouteLoading?: boolean;
  delegateOnboardingCheckLoadingToRoute?: boolean;
};

const ROUTES_WITH_ROUTE_OWNED_LOADING_UI: AuthLoadingRoutePolicy[] = [
  { prefix: "/agent", suppressProtectedRouteLoading: true },
  { path: "/profile" },
];

const AUTH_LOADING_ROUTE_POLICIES: AuthLoadingRoutePolicy[] =
  ROUTES_WITH_ROUTE_OWNED_LOADING_UI.map((route) => ({
    ...route,
    deferGlobalAuthBlock: true,
    delegateOnboardingCheckLoadingToRoute: true,
  }));

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
      delegateOnboardingCheckLoadingToRoute: false,
    };
  }

  const matchedPolicy = AUTH_LOADING_ROUTE_POLICIES.find((policy) =>
    matchesRoutePolicy(pathname, policy)
  );

  return {
    deferGlobalAuthBlock: matchedPolicy?.deferGlobalAuthBlock ?? false,
    suppressProtectedRouteLoading: matchedPolicy?.suppressProtectedRouteLoading ?? false,
    delegateOnboardingCheckLoadingToRoute:
      matchedPolicy?.delegateOnboardingCheckLoadingToRoute ?? false,
  };
}

export const authLoadingRoutePolicies = AUTH_LOADING_ROUTE_POLICIES;
