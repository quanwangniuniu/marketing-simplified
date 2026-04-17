"use client";

type AuthLoadingRoutePolicy = {
  prefix: string;
  deferGlobalAuthBlock?: boolean;
  suppressProtectedRouteLoading?: boolean;
};

const AUTH_LOADING_ROUTE_POLICIES: AuthLoadingRoutePolicy[] = [
  {
    prefix: "/agent",
    deferGlobalAuthBlock: true,
    suppressProtectedRouteLoading: true,
  },
];

function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getAuthLoadingRoutePolicy(pathname?: string | null) {
  if (!pathname) {
    return {
      deferGlobalAuthBlock: false,
      suppressProtectedRouteLoading: false,
    };
  }

  const matchedPolicy = AUTH_LOADING_ROUTE_POLICIES.find((policy) =>
    matchesRoutePrefix(pathname, policy.prefix)
  );

  return {
    deferGlobalAuthBlock: matchedPolicy?.deferGlobalAuthBlock ?? false,
    suppressProtectedRouteLoading: matchedPolicy?.suppressProtectedRouteLoading ?? false,
  };
}

export const authLoadingRoutePolicies = AUTH_LOADING_ROUTE_POLICIES;
