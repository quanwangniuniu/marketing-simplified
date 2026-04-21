"use client";

import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { ArrowLeft } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { miroApi } from "@/lib/api/miroApi";
import { ProjectAPI, ProjectData } from "@/lib/api/projectApi";
import CreateBoardModal from "@/components/miro/CreateBoardModal";

export default function ProjectMiroPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId ? Number(params.projectId) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Load project info
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      try {
        const projects = await ProjectAPI.getProjects();
        const foundProject = projects.find((p) => p.id === projectId);
        setProject(foundProject || null);
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    };
    loadProject();
  }, [projectId]);

  // Launcher behavior: redirect to latest board for this user in this project
  useEffect(() => {
    const loadLatestBoard = async () => {
      if (!projectId) return;
      setLoading(true);
      setError(null);
      try {
        const latest = await miroApi.getLatestProjectBoard(projectId);
        router.replace(`/miro/${latest.board.id}`);
      } catch (err: any) {
        console.error("Failed to resolve latest board:", err);

        if (err?.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return;
        }

        if (err?.status === 404) {
          setError("No boards found in this project yet. Create one to continue.");
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to open project board"
        );
      } finally {
        setLoading(false);
      }
    };

    loadLatestBoard();
  }, [projectId, router]);

  // Handle opening create board modal
  const handleCreateBoard = () => {
    if (!projectId) {
      alert("Project ID is missing.");
      return;
    }
    setIsCreateModalOpen(true);
  };

  // Handle create board submit from modal
  const handleCreateBoardSubmit = async (data: { title: string }) => {
    if (!projectId) {
      alert("Project ID is missing.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const createdBoard = await miroApi.createBoard({
        project_id: projectId,
        title: data.title,
        viewport: { x: 0, y: 0, zoom: 1.0 },
      });
      setIsCreateModalOpen(false);
      router.replace(`/miro/${createdBoard.id}`);
    } catch (err: any) {
      console.error("Failed to create board:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create board"
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!projectId) {
    return (
      <Layout>
        <div className="h-full space-y-8 text-gray-800 bg-white">
          <div className="px-8 pt-8">
            <p className="text-red-500">Invalid project ID</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full text-gray-800 bg-white">
        <div className="flex items-center justify-between px-8 pt-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              title="Back to Projects"
            >
              <ArrowLeft className="h-4 w-4" />
              Projects
            </button>
            <h1 className="text-2xl font-semibold">
              {project ? `${project.name} - Miro` : "Miro"}
            </h1>
          </div>
          {error?.includes("No boards found") && (
            <button
              className="bg-[#3CCED7] text-white rounded-md px-4 py-2 text-sm hover:bg-[#2AB5BD] disabled:bg-[#3CCED7]"
              onClick={handleCreateBoard}
            >
              Create First Board
            </button>
          )}
        </div>

        <div className="px-8 py-12">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm">
            {loading && <p className="text-gray-600">Opening your most recent board...</p>}
            {!loading && error && <p className="text-red-600">{error}</p>}
            {!loading && !error && <p className="text-gray-600">Redirecting to board...</p>}
          </div>
        </div>
        <CreateBoardModal
          open={isCreateModalOpen}
          projectId={projectId}
          projectName={project?.name}
          isCreating={isCreating}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateBoardSubmit}
        />
      </div>
    </Layout>
  );
}

