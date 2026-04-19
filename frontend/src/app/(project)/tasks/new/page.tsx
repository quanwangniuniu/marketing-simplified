"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

/**
 * Legacy deep link: forwards to the tasks workspace with the same query params.
 * Prefer `/tasks?project_id=&view=timeline&create=1&origin_meeting_id=`
 * (or `/projects/:projectId/tasks?...` which redirects to `/tasks`).
 */
function TaskNewRedirectBody() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (!p.get("create")) p.set("create", "1");
    const qs = p.toString();
    router.replace(qs ? `/tasks?${qs}` : "/tasks");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
      Redirecting to tasks…
    </div>
  );
}

export default function TaskNewRedirectPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
            Loading…
          </div>
        }
      >
        <TaskNewRedirectBody />
      </Suspense>
    </ProtectedRoute>
  );
}
