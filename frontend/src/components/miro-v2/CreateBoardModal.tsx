"use client";

import React, { useState, useEffect } from "react";
import { ProjectData } from "@/lib/api/projectApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateBoardModalProps {
  open: boolean;
  // New API: project-scoped (projectId required)
  projectId?: number;
  projectName?: string;
  // Old API: project selection (projects array)
  projects?: ProjectData[];
  isCreating: boolean;
  onClose: () => void;
  // New API: onCreate({ title })
  onCreate?: (data: { title: string }) => void;
  // Old API: onCreate({ projectId, title })
  onCreateLegacy?: (data: { projectId: number; title: string }) => void;
}

export default function CreateBoardModal({
  open,
  projectId,
  projectName,
  projects,
  isCreating,
  onClose,
  onCreate,
  onCreateLegacy,
}: CreateBoardModalProps) {
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");

  // Determine if using new API (projectId provided) or old API (projects array)
  const isProjectScoped = projectId !== undefined;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setTitle("");
      if (!isProjectScoped && projects && projects.length > 0) {
        setSelectedProjectId(projects[0].id);
      } else {
        setSelectedProjectId("");
      }
    }
  }, [open, isProjectScoped, projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    if (isProjectScoped) {
      // New API: just title
      if (onCreate) {
        onCreate({ title: title.trim() });
      }
    } else {
      // Old API: projectId + title
      if (!selectedProjectId || !onCreateLegacy) return;
      onCreateLegacy({ projectId: selectedProjectId as number, title: title.trim() });
    }
  };

  const isValid = title.trim().length > 0 && (isProjectScoped || selectedProjectId !== "");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Prevent accidental close while creating.
        if (!nextOpen && isCreating) return;
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            {isProjectScoped
              ? "Create a board for this project."
              : "Choose a project and create a board."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Selection/Display */}
          {isProjectScoped ? (
            projectName && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project
                </label>
                <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {projectName}
                </div>
              </div>
            )
          ) : (
            <div>
              <label
                htmlFor="project-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Project
              </label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) =>
                  setSelectedProjectId(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={isCreating || !projects || projects.length === 0}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7] disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {!projects || projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label
              htmlFor="board-title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Board Title
            </label>
            <input
              id="board-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter board title"
              disabled={isCreating}
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7] disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isCreating}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-[#3CCED7] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:ring-offset-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

