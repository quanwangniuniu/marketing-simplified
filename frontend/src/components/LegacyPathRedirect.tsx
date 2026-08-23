'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildUrl } from '@/lib/buildUrl';
import { useProjectStore } from '@/lib/projectStore';
import { useAuthStore } from '@/lib/authStore';

// Account-level pages under (project)/ that must never get an org/project
// prefix, mirroring the buildUrl() call-site exclusions used throughout the
// nav conversion.
const EXCLUDED_PREFIXES = ['/select-project', '/profile', '/subscription', '/organizations', '/ads/previewer'];

// Old ID-nested routes (`/projects/123/tasks`) have a different path shape
// than the flat scheme buildUrl() expects — prefixing them naively would
// produce `/org/proj/projects/123/tasks`, not a real migrated route. These
// are migrated separately rather than redirected here.
const OLD_NESTED_PROJECT_ROUTE = /^\/projects\/(?!active$|completed$|quick-start$)[^/]+\/.+/;

function isExcluded(pathname: string): boolean {
  if (OLD_NESTED_PROJECT_ROUTE.test(pathname)) return true;
  return EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function LegacyPathRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProjectStoreHydrated = useProjectStore((s) => s.hasHydrated);
  const hasAuthHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!pathname) return;
    if (!hasProjectStoreHydrated || !hasAuthHydrated) return;
    if (isExcluded(pathname)) return;

    const query = searchParams.toString();
    const current = query ? `${pathname}?${query}` : pathname;
    const target = buildUrl(current);

    // buildUrl() no-ops (returns the same string) once already prefixed or
    // when org/project aren't known yet, so this can't loop.
    if (target !== current) {
      router.replace(target);
    }
  }, [pathname, searchParams, hasProjectStoreHydrated, hasAuthHydrated, router]);

  return null;
}
