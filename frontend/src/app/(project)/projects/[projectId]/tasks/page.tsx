"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function RedirectBody() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = params?.projectId;
    const projectId = typeof raw === "string" ? Number(raw) : NaN;
    const p = new URLSearchParams();
    if (Number.isFinite(projectId) && projectId >= 1) {
      p.set("project_id", String(projectId));
    }
    const create = searchParams.get("create");
    const origin = searchParams.get("origin_meeting_id");
    const view = searchParams.get("view");
    if (create) p.set("create", create);
    if (origin) p.set("origin_meeting_id", origin);
    if (view) p.set("view", view);
    const qs = p.toString();
    router.replace(qs ? `/tasks?${qs}` : "/tasks");
  }, [params?.projectId, router, searchParams]);

  return (
    <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-600">
      Opening tasks…
    </div>
  );
}

export default function ProjectTasksRedirectPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-600">
            Loading…
          </div>
        }
      >
        <RedirectBody />
      </Suspense>
    </ProtectedRoute>
  );
}
