"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Clock,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import {
  ProjectAPI,
  ProjectData,
  ProjectInvitationData,
  ProjectMemberData,
  ProjectRoleOption,
} from "@/lib/api/projectApi";
import Modal from "@/components/ui/Modal";

type ProjectMembersModalProps = {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData | null;
  onMembersUpdated?: () => void;
  variant?: "modal" | "panel";
};

// Role dropdown options are loaded from backend `GET /api/core/projects/{id}/roles/`.

const formatMemberLabel = (member: ProjectMemberData) => {
  const user = member.user || ({} as ProjectMemberData["user"]);
  return user.name || user.username || user.email || `User #${user.id}`;
};

const getRoleBadgeClasses = (role?: string) => {
  switch (role) {
    case "owner":
      return "bg-zinc-900 text-white";
    case "member":
      return "bg-sky-100 text-sky-800";
    case "viewer":
      return "bg-slate-100 text-slate-700";
    case "Approver":
      return "bg-emerald-100 text-emerald-800";
    case "Reviewer":
      return "bg-amber-100 text-amber-800";
    case "Organization Admin":
      return "bg-violet-100 text-violet-800";
    case "Super Administrator":
      return "bg-black text-white";
    case "Team Leader":
      return "bg-fuchsia-100 text-fuchsia-800";
    case "Campaign Manager":
      return "bg-cyan-100 text-cyan-800";
    case "Budget Controller":
      return "bg-rose-100 text-rose-800";
    case "Data Analyst":
      return "bg-[#3CCED7]/15 text-[#1a9ba3]";
    case "Senior Media Buyer":
      return "bg-indigo-100 text-indigo-800";
    case "Specialist Media Buyer":
      return "bg-purple-100 text-purple-800";
    case "Junior Media Buyer":
      return "bg-teal-100 text-teal-800";
    case "Designer":
      return "bg-pink-100 text-pink-800";
    case "Copywriter":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export default function ProjectMembersModal({
  isOpen,
  onClose,
  project,
  onMembersUpdated,
  variant = "modal",
}: ProjectMembersModalProps) {
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ProjectInvitationData[]>([]);
  const [pendingInvites, setPendingInvites] = useState<ProjectInvitationData[]>([]);
  const [myInvites, setMyInvites] = useState<ProjectInvitationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [myInvitesLoading, setMyInvitesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [myInviteError, setMyInviteError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [defaultInviteRole, setDefaultInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<number, string>>({});
  const [transferOwnerMember, setTransferOwnerMember] =
    useState<ProjectMemberData | null>(null);
  const [transferOwnerPhrase, setTransferOwnerPhrase] = useState("");
  const [activeView, setActiveView] = useState<
    "members" | "approvals" | "acceptances" | "invites"
  >("members");

  const [availableRoles, setAvailableRoles] = useState<ProjectRoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const projectId = useMemo(() => project?.id ?? null, [project]);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isOwner = useMemo(() => {
    if (!currentUserId) return false;
    const numericId = Number(currentUserId);
    return project?.owner?.id === numericId;
  }, [currentUserId, project]);
  const canManageMembers = useMemo(() => {
    if (!currentUserId) return false;
    if (isOwner) return true;
    const numericId = Number(currentUserId);
    return members.some(
      (member) =>
        member.user?.id === numericId &&
        [
          "Super Administrator",
          "Organization Admin",
          "Team Leader",
          "Campaign Manager",
        ].includes(member.role || "")
    );
  }, [currentUserId, members, isOwner]);

  const roleOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: ProjectRoleOption[] = [];

    availableRoles.forEach((r) => {
      if (r.value === "owner") return;
      if (seen.has(r.value)) return;
      seen.add(r.value);
      options.push(r);
    });

    // Ensure current member roles are present in the dropdown.
    members.forEach((m) => {
      if (!m.role || m.role === "owner") return;
      if (seen.has(m.role)) return;
      seen.add(m.role);
      options.push({ value: m.role, label: m.role });
    });

    return options;
  }, [availableRoles, members]);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await ProjectAPI.getProjectMembers(projectId);
      setMembers(data || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load project members.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadAvailableRoles = useCallback(async () => {
    if (!projectId) return;
    try {
      setRolesLoading(true);
      setRolesError(null);
      const data = await ProjectAPI.getProjectAvailableRoles(projectId);
      setAvailableRoles(data?.roles || []);
      const defaultRole = data?.default_role || "member";
      setDefaultInviteRole(defaultRole);
      setInviteRole(defaultRole);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load project roles.";
      setRolesError(message);
    } finally {
      setRolesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isOpen) return;
    loadAvailableRoles();
  }, [isOpen, loadAvailableRoles]);

  const loadPendingApprovals = useCallback(async () => {
    if (!projectId) return;
    try {
      setApprovalsLoading(true);
      setApprovalError(null);
      const data = await ProjectAPI.getPendingInvitationApprovals(projectId);
      setPendingApprovals(data || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load pending approvals.";
      setApprovalError(message);
    } finally {
      setApprovalsLoading(false);
    }
  }, [projectId]);

  const loadPendingInvites = useCallback(async () => {
    if (!projectId) return;
    try {
      setInvitesLoading(true);
      setInviteError(null);
      const data = await ProjectAPI.getPendingInvitations(projectId);
      setPendingInvites(data || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load pending invitations.";
      setInviteError(message);
    } finally {
      setInvitesLoading(false);
    }
  }, [projectId]);

  const loadMyInvites = useCallback(async () => {
    if (!projectId) return;
    try {
      setMyInvitesLoading(true);
      setMyInviteError(null);
      const data = await ProjectAPI.getMyPendingInvitations(projectId);
      setMyInvites(data || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load your invitations.";
      setMyInviteError(message);
    } finally {
      setMyInvitesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isOpen) return;
    loadMembers();
  }, [isOpen, loadMembers]);

  useEffect(() => {
    if (!isOpen || !canManageMembers) return;
    loadPendingInvites();
  }, [isOpen, canManageMembers, loadPendingInvites]);

  useEffect(() => {
    if (!isOpen || !canManageMembers) return;
    loadPendingApprovals();
  }, [isOpen, canManageMembers, loadPendingApprovals]);

  useEffect(() => {
    if (!isOpen || canManageMembers) return;
    loadMyInvites();
  }, [isOpen, canManageMembers, loadMyInvites]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveView("members");
  }, [isOpen]);

  useEffect(() => {
    setRoleEdits((prev) => {
      const next = { ...prev };
      members.forEach((member) => {
        if (member.role !== "owner" && !(member.id in next)) {
          next[member.id] = member.role;
        }
      });
      return next;
    });
  }, [members]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId) return;

    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Please enter an email address.");
      return;
    }

    try {
      setInviting(true);
      const response = await ProjectAPI.inviteProjectMember(projectId, {
        email,
        role: inviteRole || defaultInviteRole,
      });
      if (response?.invitation || response?.user_exists === false) {
        toast.success("Invitation submitted for approval.");
      } else {
        toast.success("Invitation submitted for approval.");
      }
      setInviteEmail("");
      setInviteRole(defaultInviteRole);
      await loadMembers();
      await loadPendingApprovals();
      await loadPendingInvites();
      onMembersUpdated?.();
    } catch (err: any) {
      const message =
        err?.response?.data?.email ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to invite member.";
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: ProjectMemberData) => {
    if (!projectId) return;
    if (member.role === "owner") {
      toast.error("Project owners cannot be removed.");
      return;
    }

    const label = formatMemberLabel(member);
    if (!window.confirm(`Remove ${label} from this project?`)) {
      return;
    }

    try {
      setRemovingId(member.id);
      await ProjectAPI.removeProjectMember(projectId, member.id);
      setMembers((prev) => prev.filter((item) => item.id !== member.id));
      toast.success("Member removed.");
      onMembersUpdated?.();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to remove member.";
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (
    member: ProjectMemberData,
    nextRole: string
  ): Promise<boolean> => {
    if (!projectId) return false;
    if (member.role === nextRole) return false;
    try {
      setUpdatingId(member.id);
      const updated = await ProjectAPI.updateProjectMemberRole(
        projectId,
        member.id,
        nextRole
      );
      setMembers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success("Role updated.");
      await loadMembers();
      return true;
    } catch (err: any) {
      const responseData = err?.response?.data;
      const roleError =
        responseData?.role && Array.isArray(responseData.role)
          ? responseData.role[0]
          : responseData?.role;
      const message =
        roleError ||
        responseData?.detail ||
        responseData?.message ||
        err?.message ||
        "Failed to update role.";
      toast.error(String(message));
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMemberRoleSelectChange = async (
    member: ProjectMemberData,
    nextRole: string
  ) => {
    if (nextRole === member.role) return;
    setRoleEdits((prev) => ({ ...prev, [member.id]: nextRole }));
    const ok = await handleRoleChange(member, nextRole);
    if (!ok) {
      setRoleEdits((prev) => ({ ...prev, [member.id]: member.role }));
    }
  };

  const openTransferOwnerModal = (member: ProjectMemberData) => {
    if (member.role === "owner") return;
    const email = member.user?.email?.trim();
    if (!email) {
      toast.error("This member has no email on file. Ownership cannot be transferred.");
      return;
    }
    setTransferOwnerMember(member);
    setTransferOwnerPhrase("");
  };

  const closeTransferOwnerModal = () => {
    setTransferOwnerMember(null);
    setTransferOwnerPhrase("");
  };

  const transferOwnerExpectedPhrase = useMemo(() => {
    if (!transferOwnerMember?.user?.email) return "";
    return `Transfer to ${transferOwnerMember.user.email.trim()}`;
  }, [transferOwnerMember]);

  const transferOwnerPhraseMatches = useMemo(() => {
    const typed = transferOwnerPhrase.trim();
    const expected = transferOwnerExpectedPhrase.trim();
    return typed.length > 0 && typed === expected;
  }, [transferOwnerPhrase, transferOwnerExpectedPhrase]);

  const confirmTransferOwner = async () => {
    if (!projectId || !transferOwnerMember) return;
    if (!transferOwnerPhraseMatches) {
      toast.error("Phrase does not match. Please type the confirmation exactly.");
      return;
    }
    const member = transferOwnerMember;
    const didUpdate = await handleRoleChange(member, "owner");
    if (didUpdate) {
      closeTransferOwnerModal();
      onMembersUpdated?.();
    }
  };

  const handleAcceptInvite = async (invite: ProjectInvitationData) => {
    if (!invite.token) {
      toast.error("Missing invitation token.");
      return;
    }
    if (!invite.approved) {
      toast.error("Invitation is pending approval.");
      return;
    }
    try {
      setMyInvitesLoading(true);
      await ProjectAPI.acceptInvitation(invite.token);
      toast.success("Invitation accepted.");
      await loadMembers();
      await loadMyInvites();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to accept invitation.";
      toast.error(message);
    } finally {
      setMyInvitesLoading(false);
    }
  };

  const handleApproveInvite = async (inviteId: number) => {
    if (!projectId) return;
    try {
      setApprovalsLoading(true);
      await ProjectAPI.approveProjectInvitation(projectId, inviteId);
      toast.success("Invitation approved and sent.");
      await loadPendingApprovals();
      await loadPendingInvites();
      await loadMyInvites();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to approve invitation.";
      toast.error(message);
    } finally {
      setApprovalsLoading(false);
    }
  };

  const handleRejectInvite = async (inviteId: number) => {
    if (!projectId) return;
    if (!window.confirm("Reject this invitation?")) return;
    try {
      setApprovalsLoading(true);
      await ProjectAPI.rejectProjectInvitation(projectId, inviteId);
      toast.success("Invitation rejected.");
      await loadPendingApprovals();
      await loadPendingInvites();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to reject invitation.";
      toast.error(message);
    } finally {
      setApprovalsLoading(false);
    }
  };

  const content = (
    <div className={`w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.6)] ${variant === "panel" ? "max-w-none" : "max-w-2xl"}`}>
      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-white via-slate-50 to-blue-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-indigo-500 text-white shadow-sm">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Project Members
              </p>
              <p className="text-xs text-gray-500">
                {project?.name || "Project"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      <div className="space-y-6 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2 rounded-full bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveView("members")}
            className={`rounded-full px-3 py-1 ${
              activeView === "members"
                ? "bg-white text-slate-900 shadow-sm"
                : "hover:text-slate-800"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Members
              <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-700">
                {members.length}
              </span>
            </span>
          </button>
          {canManageMembers && (
            <>
              <button
                type="button"
                onClick={() => setActiveView("approvals")}
                className={`rounded-full px-3 py-1 ${
                  activeView === "approvals"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "hover:text-slate-800"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Pending approvals
                  <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">
                    {pendingApprovals.length}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("acceptances")}
                className={`rounded-full px-3 py-1 ${
                  activeView === "acceptances"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "hover:text-slate-800"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Pending acceptances
                  <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                    {pendingInvites.length}
                  </span>
                </span>
              </button>
            </>
          )}
          {!canManageMembers && (
            <button
              type="button"
              onClick={() => setActiveView("invites")}
              className={`rounded-full px-3 py-1 ${
                activeView === "invites"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "hover:text-slate-800"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Your invites
                <span className="rounded-full bg-[#3CCED7]/15 px-1.5 text-[10px] font-semibold text-[#1a9ba3]">
                  {myInvites.length}
                </span>
              </span>
            </button>
          )}
        </div>

        {activeView === "members" && (
          <div className="space-y-6">
            {canManageMembers ? (
              <form
                onSubmit={handleInvite}
                className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Invite a member
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Project roles control project access and can align with RBAC roles.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#3CCED7]/30 bg-[#3CCED7]/10 px-3 py-1.5 text-xs font-semibold text-[#1a9ba3]">
                    <ShieldCheck className="h-4 w-4" />
                    Privileged controls
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_auto]">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="name@company.com"
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value)}
                      disabled={rolesLoading || roleOptions.length === 0}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {rolesLoading ? (
                        <option value="" disabled>
                          Loading roles...
                        </option>
                      ) : (
                        roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))
                      )}
                    </select>
                    {rolesError && (
                      <p className="mt-1 text-xs text-red-600">{rolesError}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3CCED7] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2AB5BD] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Invite
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                Only privileged project roles can invite members.
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  Current members
                </p>
                <button
                  type="button"
                  onClick={loadMembers}
                  disabled={loading}
                  className="text-xs font-medium text-[#3CCED7] hover:text-[#1a9ba3]"
                >
                  Refresh
                </button>
              </div>

            {loading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members...
              </div>
            )}

            {!loading && error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}

            {!loading && !error && members.length === 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                No members found for this project.
              </div>
            )}

            {!loading && !error && members.length > 0 && (
              <div className="mt-4 space-y-2">
                {members.map((member) => {
                  const isCurrentUser =
                    member.user?.id === Number(currentUserId);
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm ${
                        isCurrentUser
                          ? "border-[#3CCED7]/30 bg-[#3CCED7]/10"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatMemberLabel(member)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.user?.email || "No email on file"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {canManageMembers && member.role !== "owner" ? (
                          <>
                            <select
                              value={roleEdits[member.id] ?? member.role}
                              onChange={(event) =>
                                void handleMemberRoleSelectChange(
                                  member,
                                  event.target.value
                                )
                              }
                              disabled={updatingId === member.id}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {roleOptions.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => openTransferOwnerModal(member)}
                                disabled={updatingId === member.id}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Transfer owner
                              </button>
                            )}
                            {updatingId === member.id && (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" aria-hidden />
                            )}
                          </>
                        ) : (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClasses(
                              member.role
                            )}`}
                          >
                            {member.role}
                          </span>
                        )}
                        {canManageMembers ? (
                          <button
                            type="button"
                            onClick={() => handleRemove(member)}
                            disabled={
                              removingId === member.id ||
                              member.role === "owner" ||
                              updatingId === member.id
                            }
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {removingId === member.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            {member.role === "owner" ? "Owner" : "Remove"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        )}

        {canManageMembers && activeView === "approvals" && (
          <div className="mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    Pending approvals
                  </p>
                  <button
                    type="button"
                    onClick={loadPendingApprovals}
                    disabled={approvalsLoading}
                    className="text-xs font-medium text-[#3CCED7] hover:text-[#1a9ba3]"
                  >
                    Refresh
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Approve to send the invite email. Members appear after they accept.
                </p>
                {approvalsLoading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading approvals...
                  </div>
                )}
                {!approvalsLoading && approvalError && (
                  <p className="mt-3 text-sm text-red-600">{approvalError}</p>
                )}
                {!approvalsLoading && !approvalError && pendingApprovals.length === 0 && (
                  <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                    No pending approvals.
                  </div>
                )}
                {!approvalsLoading && !approvalError && pendingApprovals.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {pendingApprovals.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {invite.email}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Role:</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getRoleBadgeClasses(
                                invite.role
                              )}`}
                            >
                              {invite.role}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveInvite(invite.id)}
                            disabled={approvalsLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectInvite(invite.id)}
                            disabled={approvalsLoading}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        )}

        {canManageMembers && activeView === "acceptances" && (
          <div className="mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    Pending acceptances
                  </p>
                  <button
                    type="button"
                    onClick={loadPendingInvites}
                    disabled={invitesLoading}
                    className="text-xs font-medium text-[#3CCED7] hover:text-[#1a9ba3]"
                  >
                    Refresh
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  These members appear after they accept the email invitation.
                </p>
                {invitesLoading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading invitations...
                  </div>
                )}
                {!invitesLoading && inviteError && (
                  <p className="mt-3 text-sm text-red-600">{inviteError}</p>
                )}
                {!invitesLoading && !inviteError && pendingInvites.length === 0 && (
                  <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                    No pending invitations.
                  </div>
                )}
                {!invitesLoading && !inviteError && pendingInvites.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {invite.email}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Role:</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getRoleBadgeClasses(
                                invite.role
                              )}`}
                            >
                              {invite.role}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Awaiting acceptance
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        )}

        {!canManageMembers && activeView === "invites" && (
          <div className="mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    Your pending invitations
                  </p>
                  <button
                    type="button"
                    onClick={loadMyInvites}
                    disabled={myInvitesLoading}
                    className="text-xs font-medium text-[#3CCED7] hover:text-[#1a9ba3]"
                  >
                    Refresh
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Accept to join the project and appear in the member list.
                </p>
                {myInvitesLoading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading invitations...
                  </div>
                )}
                {!myInvitesLoading && myInviteError && (
                  <p className="mt-3 text-sm text-red-600">{myInviteError}</p>
                )}
                {!myInvitesLoading && !myInviteError && myInvites.length === 0 && (
                  <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                    No pending invitations.
                  </div>
                )}
                {!myInvitesLoading && !myInviteError && myInvites.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {myInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {invite.project?.name || "Project"}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Role:</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getRoleBadgeClasses(
                                invite.role
                              )}`}
                            >
                              {invite.role}
                            </span>
                            {!invite.approved && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                Pending approval
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAcceptInvite(invite)}
                          disabled={myInvitesLoading || !invite.approved}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Accept
                        </button>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        )}
      </div>
    </div>
  );

  const transferOwnerLabel = transferOwnerMember
    ? formatMemberLabel(transferOwnerMember)
    : "";

  const transferModal = (
    <Modal isOpen={!!transferOwnerMember} onClose={closeTransferOwnerModal}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Transfer project ownership
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-red-600">
            You will no longer be the project owner.
          </span>{" "}
          To confirm, type the phrase below exactly, then click Confirm transfer.
        </p>
        {transferOwnerMember && (
          <>
            <p className="mt-3 text-xs text-gray-500">
              Transferring to{" "}
              <span className="font-medium text-gray-800">
                {transferOwnerLabel}
              </span>
            </p>
            <p className="mt-3 text-xs font-medium text-gray-700">
              Type this phrase:
            </p>
            <code className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {transferOwnerExpectedPhrase || "—"}
            </code>
            <label htmlFor="transfer-owner-phrase" className="mt-4 block text-xs font-medium text-gray-700">
              Confirmation
            </label>
            <input
              id="transfer-owner-phrase"
              type="text"
              value={transferOwnerPhrase}
              onChange={(e) => setTransferOwnerPhrase(e.target.value)}
              autoComplete="off"
              placeholder={transferOwnerExpectedPhrase}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeTransferOwnerModal}
                disabled={updatingId === transferOwnerMember.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmTransferOwner()}
                disabled={
                  !transferOwnerPhraseMatches ||
                  updatingId === transferOwnerMember.id
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingId === transferOwnerMember.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirm transfer
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );

  if (variant === "panel") {
    return (
      <>
        {content}
        {transferModal}
      </>
    );
  }

  return (
    <>
      <div className="w-full">{content}</div>
      {transferModal}
    </>
  );
}
