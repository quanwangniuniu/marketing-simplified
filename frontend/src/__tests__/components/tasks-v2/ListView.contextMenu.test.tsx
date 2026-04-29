import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ListView from '@/components/tasks-v2/ListView';
import type { TaskData } from '@/types/task';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import { ProjectAPI } from '@/lib/api/projectApi';
import { TaskAPI } from '@/lib/api/taskApi';
import toast from 'react-hot-toast';

jest.mock('@/lib/api/projectApi', () => ({
  __esModule: true,
  ProjectAPI: {
    getProjectMembers: jest.fn(),
  },
}));

const getProjectMembersMock = ProjectAPI.getProjectMembers as jest.Mock;

const mockPush = jest.fn();
const mockRemoveTask = jest.fn();
const mockUpdateTask = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/taskStore', () => ({
  useTaskStore: (
    selector: (s: { removeTask: typeof mockRemoveTask; updateTask: typeof mockUpdateTask }) => unknown
  ) => selector({ removeTask: mockRemoveTask, updateTask: mockUpdateTask }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api/taskApi', () => ({
  __esModule: true,
  TaskAPI: {
    deleteTask: jest.fn(),
    updateTask: jest.fn(),
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

const deleteTaskMock = TaskAPI.deleteTask as jest.Mock;
const updateTaskApiMock = TaskAPI.updateTask as jest.Mock;

function resetWorkflowMocks() {
  (TaskAPI.submitTask as jest.Mock).mockReset();
  (TaskAPI.startReview as jest.Mock).mockReset();
  (TaskAPI.makeApproval as jest.Mock).mockReset();
  (TaskAPI.cancelTask as jest.Mock).mockReset();
  (TaskAPI.lock as jest.Mock).mockReset();
  (TaskAPI.unlock as jest.Mock).mockReset();
  (TaskAPI.revise as jest.Mock).mockReset();
  (TaskAPI.getTask as jest.Mock).mockReset();
}

const LABELS_TOOLTIP = 'Task labels are not supported yet';

/** Flush ListView member-fetch effect after opening the row menu (tasks use project_id from makeTask). */
async function settleListViewMenuFetch(opts?: { advanceTimers?: boolean }) {
  await waitFor(
    () => {
      expect(getProjectMembersMock).toHaveBeenCalled();
    },
    opts?.advanceTimers ? { advanceTimers: true } : undefined
  );
  const ix = getProjectMembersMock.mock.calls.length - 1;
  const pending = getProjectMembersMock.mock.results[ix]?.value as Promise<unknown> | undefined;
  await act(async () => {
    if (pending) await pending;
    if (opts?.advanceTimers) {
      await jest.runOnlyPendingTimersAsync();
    } else {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  });
}

const makeTask = (overrides: Partial<TaskData> = {}): TaskData => ({
  id: 42,
  project_id: 1,
  type: 'task',
  summary: 'Hello task',
  ...overrides,
});

const makeMember = (overrides: Partial<ProjectMemberData> = {}): ProjectMemberData => ({
  id: 1,
  user: { id: 201, username: 'alice', email: 'alice@test.com' },
  project: { id: 1, name: 'Proj' },
  role: 'member',
  is_active: true,
  ...overrides,
});

describe('ListView row context menu (Step 1)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRemoveTask.mockClear();
    mockUpdateTask.mockClear();
    deleteTaskMock.mockReset();
    updateTaskApiMock.mockReset();
    resetWorkflowMocks();
    getProjectMembersMock.mockReset();
    getProjectMembersMock.mockResolvedValue([]);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  async function openMenuOnFirstRow() {
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one' }), makeTask({ id: 8, summary: 'Other' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr');
    expect(row).toBeTruthy();
    fireEvent.contextMenu(row!, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menus = screen.getAllByRole('menu');
    const menu = menus[menus.length - 1];
    return { row: row!, menu };
  }

  it('opens custom menu on right-click and lists actions', async () => {
    const { menu } = await openMenuOnFirstRow();
    expect(within(menu).getByRole('menuitem', { name: /open task/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /copy task link/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^workflow$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^owner$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^approver$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^priority$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^due date$/i })).toBeInTheDocument();
    const labelsItem = within(menu).getByRole('menuitem', { name: /^labels$/i });
    expect(labelsItem).toBeDisabled();
    expect(labelsItem).toHaveAttribute('title', LABELS_TOOLTIP);
    expect(within(menu).getByRole('menuitem', { name: /delete task/i })).toBeInTheDocument();
  });

  it('Labels stub does not call TaskAPI.updateTask when clicked', async () => {
    const { menu } = await openMenuOnFirstRow();
    updateTaskApiMock.mockClear();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^labels$/i }));
    expect(updateTaskApiMock).not.toHaveBeenCalled();
  });

  it('closes menu on Escape', async () => {
    await openMenuOnFirstRow();
    expect(screen.getAllByRole('menu').length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu on outside pointerdown', async () => {
    await openMenuOnFirstRow();
    expect(screen.getAllByRole('menu').length).toBeGreaterThan(0);
    fireEvent.pointerDown(document.body, { bubbles: true });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Open task navigates and closes menu', async () => {
    const { menu } = await openMenuOnFirstRow();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /open task/i }));
    expect(mockPush).toHaveBeenCalledWith('/tasks/7');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Copy task link writes URL and closes menu', async () => {
    const { menu } = await openMenuOnFirstRow();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /copy task link/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/tasks\/7$/)
      );
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Delete opens confirm dialog and removes task on confirm', async () => {
    deleteTaskMock.mockResolvedValue(undefined);
    const { menu } = await openMenuOnFirstRow();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /delete task/i }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /delete task/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteTaskMock).toHaveBeenCalledWith(7);
      expect(mockRemoveTask).toHaveBeenCalledWith(7);
    });
  });
});

describe('ListView row context menu (Step 2 PATCH)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockPush.mockClear();
    mockRemoveTask.mockClear();
    mockUpdateTask.mockClear();
    deleteTaskMock.mockReset();
    updateTaskApiMock.mockReset();
    resetWorkflowMocks();
    getProjectMembersMock.mockReset();
    getProjectMembersMock.mockResolvedValue([]);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('priority calls TaskAPI.updateTask with correct id and payload and updates store', async () => {
    updateTaskApiMock.mockResolvedValue({
      data: { id: 7, priority: 'HIGH', due_date: '2026-01-01' },
    });
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', priority: 'MEDIUM' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^priority$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^high$/i }));

    await waitFor(() => {
      expect(updateTaskApiMock).toHaveBeenCalledWith(7, { priority: 'HIGH' });
      expect(mockUpdateTask).toHaveBeenCalledWith(7, { priority: 'HIGH' });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('due date Today calls TaskAPI.updateTask with YYYY-MM-DD and updates store', async () => {
    updateTaskApiMock.mockResolvedValue({
      data: { id: 7, due_date: '2026-06-15' },
    });
    render(<ListView tasks={[makeTask({ id: 7, summary: 'Row one' })]} loading={false} error={null} />);
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();

    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date('2026-06-15T14:00:00'));
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^due date$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^today$/i }));

    await waitFor(
      () => {
        expect(updateTaskApiMock).toHaveBeenCalledWith(7, { due_date: '2026-06-15' });
        expect(mockUpdateTask).toHaveBeenCalledWith(7, { due_date: '2026-06-15' });
      },
      { advanceTimers: true }
    );
    jest.useRealTimers();
  });

  it('clear due date sends null payload', async () => {
    updateTaskApiMock.mockResolvedValue({
      data: { id: 7, due_date: null },
    });
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', due_date: '2026-01-01' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^due date$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /clear due date/i }));

    await waitFor(() => {
      expect(updateTaskApiMock).toHaveBeenCalledWith(7, { due_date: null });
      expect(mockUpdateTask).toHaveBeenCalledWith(7, { due_date: undefined });
    });
  });

  it('PATCH failure does not update store and shows error toast', async () => {
    updateTaskApiMock.mockRejectedValue({ response: { data: { detail: 'Not allowed' } } });
    render(<ListView tasks={[makeTask({ id: 7, summary: 'Row one' })]} loading={false} error={null} />);
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^priority$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^low$/i }));

    await waitFor(() => {
      expect(updateTaskApiMock).toHaveBeenCalled();
      expect(mockUpdateTask).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Not allowed');
    });
  });
});

describe('ListView row context menu (Step 3 owner / approver)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRemoveTask.mockClear();
    mockUpdateTask.mockClear();
    deleteTaskMock.mockReset();
    updateTaskApiMock.mockReset();
    resetWorkflowMocks();
    getProjectMembersMock.mockReset();
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('fetches project members once per project when opening menu on different rows', async () => {
    const bob = makeMember({
      id: 2,
      user: { id: 202, username: 'bob', email: 'bob@test.com' },
    });
    getProjectMembersMock.mockResolvedValue([makeMember(), bob]);
    render(
      <ListView
        tasks={[
          makeTask({ id: 7, summary: 'Row one', project_id: 1 }),
          makeTask({ id: 8, summary: 'Row two', project_id: 1 }),
        ]}
        loading={false}
        error={null}
      />
    );

    fireEvent.contextMenu(screen.getByText('Row one').closest('tr')!, {
      clientX: 120,
      clientY: 160,
      bubbles: true,
    });
    await settleListViewMenuFetch();
    expect(getProjectMembersMock).toHaveBeenCalledWith(1);
    expect(getProjectMembersMock).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(document.body, { bubbles: true });

    await act(async () => {
      fireEvent.contextMenu(screen.getByText('Row two').closest('tr')!, {
        clientX: 120,
        clientY: 160,
        bubbles: true,
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
    await waitFor(() => expect(screen.getAllByRole('menu').length).toBeGreaterThan(0));
    expect(getProjectMembersMock).toHaveBeenCalledTimes(1);
  });

  it('owner assigns member via PATCH and updates store from response', async () => {
    getProjectMembersMock.mockResolvedValue([makeMember()]);
    updateTaskApiMock.mockResolvedValue({
      data: {
        id: 7,
        owner: { id: 201, username: 'alice', email: 'alice@test.com' },
      },
    });
    render(<ListView tasks={[makeTask({ id: 7, summary: 'Row one', project_id: 1 })]} loading={false} error={null} />);
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^owner$/i }));
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: /^alice$/i })).toBeInTheDocument());
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^alice$/i }));

    await waitFor(() => {
      expect(updateTaskApiMock).toHaveBeenCalledWith(7, { owner_id: 201 });
      expect(mockUpdateTask).toHaveBeenCalledWith(7, {
        owner: { id: 201, username: 'alice', email: 'alice@test.com' },
      });
    });
  });

  it('owner unassigned sends null owner_id', async () => {
    getProjectMembersMock.mockResolvedValue([makeMember()]);
    updateTaskApiMock.mockResolvedValue({
      data: { id: 7, owner: null as unknown as undefined },
    });
    render(<ListView tasks={[makeTask({ id: 7, summary: 'Row one', project_id: 1 })]} loading={false} error={null} />);
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^owner$/i }));
    await waitFor(() => within(menu).getByRole('menuitem', { name: /^unassigned$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^unassigned$/i }));

    await waitFor(() => {
      expect(updateTaskApiMock).toHaveBeenCalledWith(7, { owner_id: null });
    });
  });

  it('approver assigns member via PATCH and updates store', async () => {
    getProjectMembersMock.mockResolvedValue([makeMember()]);
    updateTaskApiMock.mockResolvedValue({
      data: {
        id: 7,
        current_approver: { id: 201, username: 'alice', email: 'alice@test.com' },
        current_approver_id: 201,
      },
    });
    render(<ListView tasks={[makeTask({ id: 7, summary: 'Row one', project_id: 1 })]} loading={false} error={null} />);
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^approver$/i }));
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: /alice/i })).toBeInTheDocument()
    );
    fireEvent.click(within(menu).getByRole('menuitem', { name: /alice/i }));

    await waitFor(() => {
      expect(updateTaskApiMock).toHaveBeenCalledWith(7, { current_approver_id: 201 });
      expect(mockUpdateTask).toHaveBeenCalledWith(7, {
        current_approver: { id: 201, username: 'alice', email: 'alice@test.com' },
        current_approver_id: 201,
      });
    });
  });

  it('LOCKED task disables owner and approver menu rows', async () => {
    getProjectMembersMock.mockResolvedValue([makeMember()]);
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', project_id: 1, status: 'LOCKED' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    expect(within(menu).getByRole('menuitem', { name: /^owner$/i })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /^approver$/i })).toBeDisabled();
  });
});

describe('ListView row context menu (Step 4 workflow)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRemoveTask.mockClear();
    mockUpdateTask.mockClear();
    deleteTaskMock.mockReset();
    updateTaskApiMock.mockReset();
    resetWorkflowMocks();
    getProjectMembersMock.mockReset();
    getProjectMembersMock.mockResolvedValue([]);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('Workflow Submit calls submitTask and updates store', async () => {
    (TaskAPI.submitTask as jest.Mock).mockResolvedValue({
      data: { task: { id: 7, status: 'SUBMITTED', project_id: 1, type: 'task', summary: 'Row one' } },
    });
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', status: 'DRAFT' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^workflow$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^submit$/i }));

    await waitFor(() => {
      expect(TaskAPI.submitTask).toHaveBeenCalledWith(7);
      expect(mockUpdateTask).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'SUBMITTED' }));
    });
  });

  it('Workflow submit failure does not update store', async () => {
    (TaskAPI.submitTask as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'Cannot submit' } },
    });
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', status: 'DRAFT' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^workflow$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^submit$/i }));

    await waitFor(() => {
      expect(mockUpdateTask).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Cannot submit');
    });
  });

  it('UNDER_REVIEW Approve calls makeApproval with approve action', async () => {
    (TaskAPI.makeApproval as jest.Mock).mockResolvedValue({
      data: {
        task: { id: 7, status: 'APPROVED', project_id: 1, type: 'task', summary: 'Row one' },
      },
    });
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', status: 'UNDER_REVIEW' })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^workflow$/i }));
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^approve$/i }));

    await waitFor(() => {
      expect(TaskAPI.makeApproval).toHaveBeenCalledWith(7, { action: 'approve' });
      expect(mockUpdateTask).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'APPROVED' }));
    });
  });

  it('LOCKED: patch rows disabled but Unlock works (TaskAPI.unlock + store)', async () => {
    (TaskAPI.unlock as jest.Mock).mockResolvedValue({
      data: { task: { id: 7, status: 'APPROVED', project_id: 1, type: 'task', summary: 'Row one' } },
    });
    render(
      <ListView
        tasks={[makeTask({ id: 7, summary: 'Row one', status: 'LOCKED', project_id: 1 })]}
        loading={false}
        error={null}
      />
    );
    const row = screen.getByText('Row one').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 120, clientY: 160, bubbles: true });
    await settleListViewMenuFetch();
    const menu = screen.getAllByRole('menu').pop()!;

    expect(within(menu).getByRole('menuitem', { name: /^priority$/i })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /^due date$/i })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /^owner$/i })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /^approver$/i })).toBeDisabled();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /^workflow$/i }));
    const unlockItem = within(menu).getByRole('menuitem', { name: /^unlock$/i });
    expect(unlockItem).not.toBeDisabled();
    fireEvent.click(unlockItem);

    await waitFor(() => {
      expect(TaskAPI.unlock).toHaveBeenCalledWith(7);
      expect(mockUpdateTask).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'APPROVED' }));
    });
  });
});
