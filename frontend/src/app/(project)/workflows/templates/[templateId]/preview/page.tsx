"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import TemplatePreviewCanvas from "@/components/workflows/agent/canvas/TemplatePreviewCanvas";
import { AgentAPI } from "@/lib/api/agentApi";
import { useBuildUrl } from "@/lib/buildUrl";
import type { AgentWorkflowTemplate } from "@/types/agent";

export default function TemplatePreviewPage({
  params,
}: {
  params: { templateId: string };
}) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const [template, setTemplate] = useState<AgentWorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AgentAPI.getTemplate(params.templateId)
      .then((data) => {
        setTemplate(data);
      })
      .catch((err) => {
        console.error("Failed to fetch template:", err);
        setError("Failed to load template");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.templateId]);

  const handleBack = () => {
    router.push(buildUrl("/workflows?tab=templates"));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !template) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-sm text-red-500">{error || "Template not found"}</p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to Templates
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-gray-50">
        <TemplatePreviewCanvas template={template} onBack={handleBack} />
      </div>
    </ProtectedRoute>
  );
}
