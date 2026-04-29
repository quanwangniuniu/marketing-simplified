import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';

export type WorkflowMvpKind =
  | 'submit'
  | 'startReview'
  | 'approve'
  | 'cancel'
  | 'lock'
  | 'unlock'
  | 'revise';

export function taskFromWorkflowResponse(data: unknown): TaskData | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { task?: TaskData };
  const t = d.task;
  if (t && typeof t === 'object' && t.id != null) return t;
  return null;
}

/** MVP workflow actions only (no Reject / Forward). Mirrors FSMActionBar eligibility for these actions. */
export function getMvpWorkflowMenuItems(task: TaskData): { kind: WorkflowMvpKind; label: string }[] {
  const status = task.status ?? 'DRAFT';
  const items: { kind: WorkflowMvpKind; label: string }[] = [];
  switch (status) {
    case 'DRAFT':
      items.push({ kind: 'submit', label: 'Submit' });
      break;
    case 'SUBMITTED':
      items.push({ kind: 'startReview', label: 'Start review' });
      items.push({ kind: 'cancel', label: 'Cancel' });
      break;
    case 'UNDER_REVIEW':
      items.push({ kind: 'approve', label: 'Approve' });
      items.push({ kind: 'cancel', label: 'Cancel' });
      break;
    case 'APPROVED':
      items.push({ kind: 'lock', label: 'Lock' });
      items.push({ kind: 'cancel', label: 'Cancel' });
      break;
    case 'REJECTED':
    case 'CANCELLED':
      items.push({ kind: 'revise', label: 'Revise' });
      break;
    case 'LOCKED':
      items.push({ kind: 'unlock', label: 'Unlock' });
      break;
    default:
      break;
  }
  return items;
}

export async function runWorkflowMvpAction(taskId: number, kind: WorkflowMvpKind): Promise<TaskData> {
  let res: { data: unknown };
  switch (kind) {
    case 'submit':
      res = await TaskAPI.submitTask(taskId);
      break;
    case 'startReview':
      res = await TaskAPI.startReview(taskId);
      break;
    case 'approve':
      res = await TaskAPI.makeApproval(taskId, { action: 'approve' });
      break;
    case 'cancel':
      res = await TaskAPI.cancelTask(taskId);
      break;
    case 'lock':
      res = await TaskAPI.lock(taskId);
      break;
    case 'unlock':
      res = await TaskAPI.unlock(taskId);
      break;
    case 'revise':
      res = await TaskAPI.revise(taskId);
      break;
  }

  const task = taskFromWorkflowResponse(res.data);
  if (task) return task;

  const fallback = await TaskAPI.getTask(taskId);
  const loaded = fallback.data as TaskData;
  if (loaded?.id != null) return loaded;

  throw new Error('Task update response missing task');
}
