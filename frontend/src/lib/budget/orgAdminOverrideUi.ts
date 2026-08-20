import type { ProjectData } from '@/lib/api/projectApi';
import type { TaskData } from '@/types/task';
import type { User } from '@/types/auth';

/** Org id for the signed-in user (current org, then legacy organization). */
export function resolveUserOrgId(user: User | null | undefined): number | null {
  const org = user?.current_organization ?? user?.organization;
  if (org?.id == null) return null;
  const id = Number(org.id);
  return Number.isFinite(id) ? id : null;
}

/**
 * Org id for the task's project when it matches the active project in the shell.
 * Task API project summary has no organization field; activeProject does.
 */
export function resolveTaskProjectOrgId(
  task: Pick<TaskData, 'project' | 'project_id'>,
  activeProject: ProjectData | null | undefined,
): number | null {
  const taskProjectId = task.project?.id ?? task.project_id;
  if (taskProjectId == null || !activeProject) return null;
  if (String(activeProject.id) !== String(taskProjectId)) return null;

  const orgId = activeProject.organization?.id ?? activeProject.organization_id;
  if (orgId == null) return null;
  const id = Number(orgId);
  return Number.isFinite(id) ? id : null;
}

/**
 * Whether to show org-admin override Approve/Reject on a budget task (UI only).
 * Backend `user_may_process_budget_approval` is the real gate; this avoids
 * showing buttons when we know the org-admin is in a different org context.
 */
export function canOrgAdminOverrideBudgetUi(
  user: User | null | undefined,
  task: Pick<TaskData, 'type' | 'project' | 'project_id'>,
  activeProject: ProjectData | null | undefined,
): boolean {
  if (!user?.is_org_admin || task.type !== 'budget') return false;

  const userOrgId = resolveUserOrgId(user);
  const taskOrgId = resolveTaskProjectOrgId(task, activeProject);

  if (userOrgId != null && taskOrgId != null) {
    return userOrgId === taskOrgId;
  }

  // Unknown task org — keep legacy behaviour; backend still enforces same-org.
  return true;
}
