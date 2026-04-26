import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import {
  getMvpWorkflowMenuItems,
  runWorkflowMvpAction,
  taskFromWorkflowResponse,
} from './taskWorkflowMvp';

jest.mock('@/lib/api/taskApi', () => ({
  __esModule: true,
  TaskAPI: {
    submitTask: jest.fn(),
    startReview: jest.fn(),
    makeApproval: jest.fn(),
    cancelTask: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn(),
    revise: jest.fn(),
    getTask: jest.fn(),
  },
}));

const base = (): TaskData => ({
  id: 1,
  project_id: 1,
  type: 'task',
  summary: 'Test',
});

describe('getMvpWorkflowMenuItems', () => {
  it('DRAFT → Submit', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'DRAFT' })).toEqual([
      { kind: 'submit', label: 'Submit' },
    ]);
  });

  it('SUBMITTED → Start review, Cancel', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'SUBMITTED' })).toEqual([
      { kind: 'startReview', label: 'Start review' },
      { kind: 'cancel', label: 'Cancel' },
    ]);
  });

  it('UNDER_REVIEW → Approve, Cancel', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'UNDER_REVIEW' })).toEqual([
      { kind: 'approve', label: 'Approve' },
      { kind: 'cancel', label: 'Cancel' },
    ]);
  });

  it('APPROVED → Lock, Cancel', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'APPROVED' })).toEqual([
      { kind: 'lock', label: 'Lock' },
      { kind: 'cancel', label: 'Cancel' },
    ]);
  });

  it('LOCKED → Unlock', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'LOCKED' })).toEqual([
      { kind: 'unlock', label: 'Unlock' },
    ]);
  });

  it('REJECTED → Revise', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'REJECTED' })).toEqual([
      { kind: 'revise', label: 'Revise' },
    ]);
  });

  it('CANCELLED → Revise', () => {
    expect(getMvpWorkflowMenuItems({ ...base(), status: 'CANCELLED' })).toEqual([
      { kind: 'revise', label: 'Revise' },
    ]);
  });

  it('missing status defaults to DRAFT', () => {
    const t = base();
    delete (t as Partial<TaskData>).status;
    expect(getMvpWorkflowMenuItems(t)).toEqual([{ kind: 'submit', label: 'Submit' }]);
  });
});

describe('taskFromWorkflowResponse', () => {
  it('returns task when data.task has id', () => {
    const task = { id: 3, type: 'task' } as TaskData;
    expect(taskFromWorkflowResponse({ task })).toEqual(task);
  });

  it('returns null when task missing or invalid', () => {
    expect(taskFromWorkflowResponse(null)).toBeNull();
    expect(taskFromWorkflowResponse({})).toBeNull();
    expect(taskFromWorkflowResponse({ task: {} })).toBeNull();
  });
});

describe('runWorkflowMvpAction', () => {
  beforeEach(() => {
    jest.mocked(TaskAPI.submitTask).mockReset();
    jest.mocked(TaskAPI.startReview).mockReset();
    jest.mocked(TaskAPI.makeApproval).mockReset();
    jest.mocked(TaskAPI.cancelTask).mockReset();
    jest.mocked(TaskAPI.lock).mockReset();
    jest.mocked(TaskAPI.unlock).mockReset();
    jest.mocked(TaskAPI.revise).mockReset();
    jest.mocked(TaskAPI.getTask).mockReset();
  });

  it('returns task from response and does not call getTask', async () => {
    const task = { id: 7, status: 'SUBMITTED', type: 'task' } as TaskData;
    jest.mocked(TaskAPI.submitTask).mockResolvedValue({ data: { task } });

    const out = await runWorkflowMvpAction(7, 'submit');

    expect(out).toEqual(task);
    expect(TaskAPI.submitTask).toHaveBeenCalledWith(7);
    expect(TaskAPI.getTask).not.toHaveBeenCalled();
  });

  it('falls back to getTask when response has no task', async () => {
    const loaded = { id: 9, status: 'APPROVED', type: 'task' } as TaskData;
    jest.mocked(TaskAPI.unlock).mockResolvedValue({ data: {} });
    jest.mocked(TaskAPI.getTask).mockResolvedValue({ data: loaded });

    const out = await runWorkflowMvpAction(9, 'unlock');

    expect(TaskAPI.unlock).toHaveBeenCalledWith(9);
    expect(TaskAPI.getTask).toHaveBeenCalledWith(9);
    expect(out).toEqual(loaded);
  });

  it('throws when task is missing from response and getTask', async () => {
    jest.mocked(TaskAPI.lock).mockResolvedValue({ data: {} });
    jest.mocked(TaskAPI.getTask).mockResolvedValue({ data: {} as TaskData });

    await expect(runWorkflowMvpAction(1, 'lock')).rejects.toThrow('Task update response missing task');
  });
});
