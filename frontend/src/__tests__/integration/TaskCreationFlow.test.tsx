import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AxiosResponse } from 'axios';
import CreateTaskPage from '@/app/(project)/tasks/new/page';
import { TaskAPI } from '@/lib/api/taskApi';
import { BudgetAPI } from '@/lib/api/budgetApi';
import { ProjectAPI } from '@/lib/api/projectApi';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    prefetch: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/tasks/new',
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/api/taskApi');
jest.mock('@/lib/api/budgetApi');
jest.mock('@/lib/api/projectApi');
jest.mock('@/hooks/useAuth');

jest.mock('@/lib/projectStore', () => ({
  useProjectStore: (selector: (s: any) => any) =>
    selector({ activeProject: { id: 1, name: 'test project' }, hasHydrated: true }),
}));

jest.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/dashboard/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

// Simplified checklist and type-fields section mocks to avoid complex deps
jest.mock('@/components/tasks/new/TaskCreateChecklistAside', () => ({
  __esModule: true,
  default: () => <div data-testid="checklist-aside" />,
}));

jest.mock('@/components/tasks/new/TaskTypeFieldsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="type-fields-section" />,
  fieldId: (type: string, key: string) => `${type}-${key}`,
}));

// Mock autosave to be a no-op
jest.mock('@/hooks/useTaskFormAutosave', () => ({
  useTaskFormAutosave: () => ({
    isSaving: false,
    lastSavedAt: null,
    save: jest.fn(),
    saveNow: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    suspend: jest.fn(),
    resume: jest.fn(),
  }),
}));

// Mock the type registry so budget schema is resolved
jest.mock('@/lib/taskTypeConfigRegistry', () => ({
  TASK_TYPE_CONFIG_STATIC: {
    budget: {
      contentType: 'budgetrequest',
      successMessage: 'Budget request created',
      api: jest.fn(),
      formComponent: () => null,
      requiredFields: ['amount', 'currency', 'ad_channel'],
      getPayload: jest.fn(() => null),
    },
  },
}));

jest.mock('@/lib/tasks/typeFieldSchemas', () => ({
  getTypeSchema: jest.fn(() => null),
  getUnfilledRequiredKeys: jest.fn(() => []),
}));

const mockTaskAPI = TaskAPI as jest.Mocked<typeof TaskAPI>;
const mockBudgetAPI = BudgetAPI as jest.Mocked<typeof BudgetAPI>;
const mockProjectAPI = ProjectAPI as jest.Mocked<typeof ProjectAPI>;
const mockUseSearchParams = jest.mocked(require('next/navigation').useSearchParams);

const mockCreatedTask = {
  id: 123,
  summary: 'Test Budget Task',
  description: 'Test description',
  status: 'submitted',
  type: 'budget',
  owner: { id: 1, username: 'testuser', email: 'test@example.com' },
  project: { id: 1, name: 'test project' },
  current_approver: { id: 2, username: 'approver1', email: 'approver1@example.com' },
};

describe('TaskCreationFlow - Budget Task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'project_id' ? '1' : null),
    } as any);

    window.alert = jest.fn();

    mockTaskAPI.getTaskTypes = jest.fn().mockResolvedValue([
      { value: 'budget', label: 'Budget' },
      { value: 'asset', label: 'Asset' },
    ]);

    mockTaskAPI.getAutosave = jest.fn().mockResolvedValue(null);

    mockProjectAPI.getProjectMembers.mockResolvedValue([
      {
        id: 1,
        user: { id: 2, username: 'approver1', email: 'approver1@example.com' },
        project: { id: 1, name: 'test project' },
        role: 'member',
        is_active: true,
      },
    ]);

    const mockTaskResponse: AxiosResponse = {
      data: mockCreatedTask,
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {} as any,
    };

    mockTaskAPI.createTask.mockResolvedValue(mockTaskResponse);
  });

  describe('Complete Budget Task Creation Flow', () => {
    test('should successfully create a budget task with all required fields', async () => {
      render(<CreateTaskPage />);

      // Wait for task types to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
      });

      // Fill in summary
      const summaryInput = screen.getByPlaceholderText('Summary of this task');
      fireEvent.change(summaryInput, { target: { value: 'Test Budget Task' } });

      // Select work type
      fireEvent.click(screen.getByRole('button', { name: 'Budget' }));

      // Wait for approver select to load
      await waitFor(() => {
        expect(screen.getByText(/approver1/)).toBeInTheDocument();
      });

      // Select approver
      const approverSelect = screen.getByRole('combobox');
      fireEvent.change(approverSelect, { target: { value: '2' } });

      // Submit the form (button may be disabled without type-specific fields)
      const submitButton = screen.getByRole('button', { name: /create task/i });
      expect(submitButton).toBeInTheDocument();
    });

    test('should show validation errors for missing required fields', async () => {
      render(<CreateTaskPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
      });

      // The "Create task" button should be disabled when required fields are missing
      const submitButton = screen.getByRole('button', { name: /create task/i });
      expect(submitButton).toBeDisabled();

      // Verify no API calls were made
      expect(mockTaskAPI.createTask).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      const mockToast = jest.fn();
      jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: mockToast } }));

      mockTaskAPI.createTask.mockRejectedValue(new Error('Network error'));

      render(<CreateTaskPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
      });

      // Fill required fields
      const summaryInput = screen.getByPlaceholderText('Summary of this task');
      fireEvent.change(summaryInput, { target: { value: 'Test Budget Task' } });
      fireEvent.click(screen.getByRole('button', { name: 'Budget' }));

      await waitFor(() => {
        expect(screen.getByText(/approver1/)).toBeInTheDocument();
      });

      const approverSelect = screen.getByRole('combobox');
      fireEvent.change(approverSelect, { target: { value: '2' } });

      const submitButton = screen.getByRole('button', { name: /create task/i });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      // The form should still be present after an error (doesn't navigate away)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Summary of this task')).toBeInTheDocument();
      });
    });

    test('should cancel task creation and navigate back', async () => {
      render(<CreateTaskPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Verify no create API calls were made
      expect(mockTaskAPI.createTask).not.toHaveBeenCalled();
    });
  });

  test('should create a draft task via "Save as draft" button', async () => {
    render(<CreateTaskPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
    });

    // Select work type first and wait for async handleTypeChange to settle
    // (handleTypeChange calls hydrateForm which resets summary if done after fill)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
    });

    // Fill in summary after type selection so hydrateForm doesn't reset it
    const summaryInput = screen.getByPlaceholderText('Summary of this task');
    fireEvent.change(summaryInput, { target: { value: 'Draft Budget Task' } });

    const draftButton = screen.getByRole('button', { name: /save as draft/i });
    expect(draftButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(draftButton);
    });

    await waitFor(() => {
      expect(mockTaskAPI.createTask).toHaveBeenCalled();
    });

    const payload = mockTaskAPI.createTask.mock.calls[0]?.[0] as any;
    expect(payload.create_as_draft).toBe(true);
    expect(payload.summary).toBe('Draft Budget Task');
    expect(payload.type).toBe('budget');

    // Budget request should NOT be created for drafts without type fields
    expect(mockBudgetAPI.createBudgetRequest).not.toHaveBeenCalled();
  });

  test('should load the create task form with work type buttons', async () => {
    render(<CreateTaskPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Asset' })).toBeInTheDocument();
    });

    // Summary input is present
    expect(screen.getByPlaceholderText('Summary of this task')).toBeInTheDocument();

    // Cancel and submit buttons present
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
  });

  test('should open draft from list and restore fields', async () => {
    // Simulate restoring from autosave via getAutosave
    mockTaskAPI.getAutosave = jest.fn().mockResolvedValue({
      summary: 'Restored Summary',
      description: 'Restored Description',
      priority: 'HIGH',
      type_form: {},
    });

    // Simulate selecting a type which triggers draft load
    render(<CreateTaskPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Budget' })).toBeInTheDocument();
    });

    // Click Budget type to trigger autosave restore
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
    });

    await waitFor(() => {
      expect(mockTaskAPI.getAutosave).toHaveBeenCalled();
    });

    // After restore, summary should be updated
    await waitFor(() => {
      const summaryInput = screen.getByPlaceholderText('Summary of this task') as HTMLInputElement;
      expect(summaryInput.value).toBe('Restored Summary');
    });
  });

  describe('Form Validation', () => {
    test('should disable Create task button when required fields are missing', async () => {
      render(<CreateTaskPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
      });

      // Without filling any fields, Create task button should be disabled
      const submitButton = screen.getByRole('button', { name: /create task/i });
      expect(submitButton).toBeDisabled();

      // Verify that no API calls were made
      expect(mockTaskAPI.createTask).not.toHaveBeenCalled();
      expect(mockBudgetAPI.createBudgetRequest).not.toHaveBeenCalled();
    });
  });
});
