import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NewTaskForm from '@/components/tasks/NewTaskForm';
import { ProjectAPI } from '@/lib/api/projectApi';
import { useProjects } from '@/hooks/useProjects';
import { CreateTaskData } from '@/types/task';
import { UseFormValidationReturn } from '@/hooks/useFormValidation';

jest.mock('@/lib/api/projectApi');
jest.mock('@/hooks/useProjects');

const mockProjectAPI = ProjectAPI as jest.Mocked<typeof ProjectAPI>;
const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

type ValidationType = UseFormValidationReturn<CreateTaskData>;

const createValidationMock = (): ValidationType => ({
  errors: {},
  validateField: jest.fn().mockReturnValue(''),
  validateForm: jest.fn().mockReturnValue(true),
  clearErrors: jest.fn(),
  setErrors: jest.fn(),
  clearFieldError: jest.fn(),
});

const setupProjectsMock = (projects: any[] = []) => {
  mockUseProjects.mockReturnValue({
    projects,
    loading: false,
    error: null,
    updatingProjectId: null,
    activeProjectIds: [],
    inactiveProjectIds: [],
    fetchProjects: jest.fn(),
    setActiveProject: jest.fn().mockResolvedValue(true),
    deletingProjectId: null,
    deleteProject: jest.fn().mockResolvedValue(undefined),
    toggleCompletedProjectId: jest.fn(),
    completedProjectIds: [],
  });
};

describe('NewTaskForm approver selection (project-based)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not load approvers when no project is selected', async () => {
    setupProjectsMock([]); // no active projects
    const validation = createValidationMock();
    const onTaskDataChange = jest.fn();

    render(
      <NewTaskForm
        onTaskDataChange={onTaskDataChange}
        taskData={{} as Partial<CreateTaskData>}
        validation={validation}
      />
    );

    // Effect runs, but since project_id is falsy, it should not call the API
    await waitFor(() => {
      expect(mockProjectAPI.getProjectMembers).not.toHaveBeenCalled();
    });
  });

  test('loads approvers from selected project members', async () => {
    // Provide an active project with id=1 so NewTaskForm keeps project_id
    setupProjectsMock([
      {
        id: 1,
        name: 'Test Project',
        isActiveResolved: true,
        is_active: true,
        derivedStatus: 'active',
      },
    ]);

    const validation = createValidationMock();
    const onTaskDataChange = jest.fn();

    mockProjectAPI.getProjectMembers.mockResolvedValue([
      {
        id: 1,
        user: { id: 2, username: 'approver1', email: 'approver1@example.com' },
        project: { id: 1, name: 'Test Project' },
        role: 'member',
        is_active: true,
      },
      {
        id: 2,
        user: { id: 3, username: 'approver2', email: 'approver2@example.com' },
        project: { id: 1, name: 'Test Project' },
        role: 'member',
        is_active: true,
      },
    ] as any);

    render(
      <NewTaskForm
        onTaskDataChange={onTaskDataChange}
        taskData={{ project_id: 1 } as Partial<CreateTaskData>}
        validation={validation}
      />
    );

    // API is called with the selected project id
    await waitFor(() => {
      expect(mockProjectAPI.getProjectMembers).toHaveBeenCalledWith(1);
    });

    // Approver options are rendered using project members
    await waitFor(() => {
      expect(screen.getByText('approver1')).toBeInTheDocument();
      expect(screen.getByText('approver2')).toBeInTheDocument();
    });
  });

  test('shows "No approvers found" when project has no members', async () => {
    setupProjectsMock([
      {
        id: 1,
        name: 'Empty Project',
        isActiveResolved: true,
        is_active: true,
        derivedStatus: 'active',
      },
    ]);

    const validation = createValidationMock();
    const onTaskDataChange = jest.fn();

    mockProjectAPI.getProjectMembers.mockResolvedValue([] as any);

    render(
      <NewTaskForm
        onTaskDataChange={onTaskDataChange}
        taskData={{ project_id: 1 } as Partial<CreateTaskData>}
        validation={validation}
      />
    );

    await waitFor(() => {
      expect(mockProjectAPI.getProjectMembers).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText('No approvers found')).toBeInTheDocument();
    });
  });

  test('updates current_approver_id when an approver is selected', async () => {
    setupProjectsMock([
      {
        id: 1,
        name: 'Test Project',
        isActiveResolved: true,
        is_active: true,
        derivedStatus: 'active',
      },
    ]);

    const validation = createValidationMock();
    const onTaskDataChange = jest.fn();

    mockProjectAPI.getProjectMembers.mockResolvedValue([
      {
        id: 1,
        user: { id: 2, username: 'approver1', email: 'approver1@example.com' },
        project: { id: 1, name: 'Test Project' },
        role: 'member',
        is_active: true,
      },
    ] as any);

    render(
      <NewTaskForm
        onTaskDataChange={onTaskDataChange}
        taskData={{ project_id: 1 } as Partial<CreateTaskData>}
        validation={validation}
      />
    );

    // Wait for approver to appear
    await waitFor(() => {
      expect(screen.getByText('approver1')).toBeInTheDocument();
    });

    const approverSelect = screen.getByLabelText(/Assign an approver/i);
    fireEvent.change(approverSelect, { target: { value: '2' } });

    // onTaskDataChange should be called with current_approver_id = 2
    expect(onTaskDataChange).toHaveBeenCalled();
    const lastCallArg = onTaskDataChange.mock.calls[onTaskDataChange.mock.calls.length - 1][0];
    expect(lastCallArg.current_approver_id).toBe(2);
  });
});
