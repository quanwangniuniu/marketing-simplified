"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  Square,
  Pencil,
  Archive,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-hot-toast";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { miroApi, MiroBoard } from "@/lib/api/miroApi";
import { ProjectAPI, ProjectData } from "@/lib/api/projectApi";
import CreateBoardModal from "@/components/miro/CreateBoardModal";
import BrandDialog from "@/components/tasks/detail/BrandDialog";
import ConfirmDialog from "@/components/tasks/detail/ConfirmDialog";

function MiroV2ListContent() {
  const router = useRouter();
  const [boards, setBoards] = useState<MiroBoard[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<MiroBoard | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<MiroBoard | null>(null);
  const [archiveWorking, setArchiveWorking] = useState(false);

  useEffect(() => {
    ProjectAPI.getProjects({ activeOnly: true })
      .then(setProjects)
      .catch((err) => console.error("Failed to load projects:", err));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await miroApi.getBoards();
        setBoards(data);
      } catch (err: any) {
        if (err?.status === 401 && typeof window !== "undefined") {
          window.location.href = "/login";
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load boards");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeBoards = useMemo(() => boards.filter((b) => !b.is_archived), [boards]);
  const archivedBoards = useMemo(() => boards.filter((b) => b.is_archived), [boards]);
  const visible = activeTab === "active" ? activeBoards : archivedBoards;
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((b) => (b.title || "").toLowerCase().includes(q));
  }, [visible, searchQuery]);

  const projectName = (projectId: number) =>
    projects.find((p) => p.id === projectId)?.name || `Project #${projectId}`;

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const openCreate = () => {
    if (projects.length === 0) {
      toast.error("No active projects. Create a project first.");
      return;
    }
    setIsCreateModalOpen(true);
  };

  const submitCreate = async (data: { projectId: number; title: string }) => {
    setIsCreating(true);
    try {
      const created = await miroApi.createBoard({
        project_id: data.projectId,
        title: data.title,
        viewport: { x: 0, y: 0, zoom: 1.0 },
      });
      const list = await miroApi.getBoards();
      setBoards(list);
      setIsCreateModalOpen(false);
      toast.success("Board created");
      if (created?.id) router.push(`/miro/${created.id}`);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setIsCreating(false);
    }
  };

  const openRename = (board: MiroBoard) => {
    setMenuOpenId(null);
    if (board.is_archived) {
      toast.error("Unarchive before renaming");
      return;
    }
    setRenameValue(board.title || "");
    setRenameTarget(board);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const next = renameValue.trim();
    if (!next || next === renameTarget.title) {
      setRenameTarget(null);
      return;
    }
    setRenameSaving(true);
    try {
      await miroApi.updateBoard(renameTarget.id, { title: next });
      setBoards((prev) =>
        prev.map((b) => (b.id === renameTarget.id ? { ...b, title: next } : b))
      );
      toast.success("Board renamed");
      setRenameTarget(null);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to rename board");
    } finally {
      setRenameSaving(false);
    }
  };

  const openArchive = (board: MiroBoard) => {
    setMenuOpenId(null);
    if (board.is_archived) {
      toast.error("Board is already archived");
      return;
    }
    setArchiveTarget(board);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveWorking(true);
    try {
      await miroApi.deleteBoard(archiveTarget.id);
      const list = await miroApi.getBoards();
      setBoards(list);
      toast.success("Board archived");
      setArchiveTarget(null);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to archive board");
    } finally {
      setArchiveWorking(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="-m-5 min-h-[calc(100vh-3rem)] bg-gray-50">
        <div className="mx-auto max-w-[1440px] px-6 py-5">
          <nav className="text-xs text-gray-500">Miro</nav>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-semibold text-gray-900">All Boards</h1>
              <p className="mt-1 text-xs text-gray-500">
                Collaborative whiteboards for planning, flows and visual notes.
              </p>
            </div>
            <button
              onClick={openCreate}
              disabled={projects.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Create Board
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              {(["active", "archived"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-white text-[#3CCED7] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab === "active" ? "Active" : "Archived"}
                  <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                    {tab === "active" ? activeBoards.length : archivedBoards.length}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search boards"
                className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 ring-1 ring-gray-100">
                Loading boards…
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl bg-white p-10 text-center ring-1 ring-gray-100">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7]/20 to-[#A6E661]/20">
                  <Square className="h-5 w-5 text-[#3CCED7]" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-gray-900">
                  {activeTab === "active" ? "No active boards" : "No archived boards"}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {activeTab === "active"
                    ? searchQuery
                      ? "No boards match your search."
                      : "Create your first board to start collaborating."
                    : "Archived boards will appear here."}
                </p>
                {activeTab === "active" && !searchQuery && (
                  <button
                    onClick={openCreate}
                    disabled={projects.length === 0}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    Create Board
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((board) => (
                  <div
                    key={board.id}
                    className="group relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-300"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/miro/${board.id}`)}
                      className="block h-32 w-full bg-gradient-to-br from-[#3CCED7]/20 via-white to-[#A6E661]/20 text-left"
                    >
                      <div className="flex h-full items-center justify-center">
                        <Square className="h-10 w-10 text-[#3CCED7]/70" />
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/miro/${board.id}`)}
                          className="block w-full truncate text-left text-sm font-medium text-gray-900 hover:text-[#3CCED7]"
                          title={board.title || "Untitled Board"}
                        >
                          {board.title || "Untitled Board"}
                        </button>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                          <span className="truncate">
                            {projectName(board.project_id)}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{formatDate(board.updated_at)}</span>
                        </div>
                      </div>
                      <div className="relative ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === board.id ? null : board.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-gray-50 hover:text-gray-700 group-hover:opacity-100"
                          aria-label="Board actions"
                          title="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpenId === board.id && (
                          <div
                            className="absolute right-0 top-8 z-30 w-40 rounded-lg bg-white py-1 shadow-lg ring-1 ring-gray-100"
                            onMouseLeave={() => setMenuOpenId(null)}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpenId(null);
                                router.push(`/miro/${board.id}`);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </button>
                            {!board.is_archived && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openRename(board)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openArchive(board)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateBoardModal
        open={isCreateModalOpen}
        projects={projects}
        isCreating={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateLegacy={submitCreate}
      />

      <BrandDialog
        open={!!renameTarget}
        title="Rename board"
        subtitle="Give this board a clearer name."
        onOpenChange={(next) => {
          if (!next && !renameSaving) setRenameTarget(null);
        }}
        width="max-w-md"
      >
        <div className="space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Board name
          </label>
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
            }}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            placeholder="Untitled Board"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={renameSaving}
              onClick={() => setRenameTarget(null)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={renameSaving || !renameValue.trim()}
              onClick={submitRename}
              className="rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              {renameSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </BrandDialog>

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive board?"
        description={
          archiveTarget
            ? `"${archiveTarget.title || "Untitled Board"}" will move to Archived. You can restore it later.`
            : ""
        }
        confirmLabel={archiveWorking ? "Archiving…" : "Archive"}
        destructive
        busy={archiveWorking}
        onOpenChange={(next) => {
          if (!next && !archiveWorking) setArchiveTarget(null);
        }}
        onConfirm={confirmArchive}
      />
    </DashboardLayout>
  );
}

export default function MiroV2Page() {
  return (
    <ProtectedRoute>
      <MiroV2ListContent />
    </ProtectedRoute>
  );
}
