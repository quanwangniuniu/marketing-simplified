import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineView from '@/components/tasks/timeline/TimelineView';
import TimelineHeader from '@/components/tasks/timeline/TimelineHeader';
import type { TaskData } from '@/types/task';

// Mock TaskAPI
jest.mock('@/lib/api/taskApi', () => ({
  TaskAPI: {
    updateTask: jest.fn().mockResolvedValue({}),
  },
}));

const makeTask = (overrides: Partial<TaskData>): TaskData => ({
  id: Math.floor(Math.random() * 10000),
  summary: 'Task',
  type: 'budget',
  project_id: 1,
  project: { id: 1, name: 'Q4 Performance Campaign' },
  start_date: '2024-02-01',
  due_date: '2024-02-10',
  ...overrides,
});

describe('TimelineView', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-02-05T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('renders task rows', () => {
    const tasks = [
      makeTask({ summary: 'Finalize Q4 Budget', project: { id: 1, name: 'Q4 Performance Campaign' } }),
      makeTask({ summary: 'Launch Creative Review', project: { id: 2, name: 'Social Media Launch' }, project_id: 2 }),
    ];

    render(<TimelineView tasks={tasks} />);

    expect(screen.getByText('Finalize Q4 Budget')).toBeInTheDocument();
    expect(screen.getByText('Launch Creative Review')).toBeInTheDocument();
  });

  it('switches scale buttons', () => {
    render(<TimelineView tasks={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Months' }));
    expect(screen.getByRole('button', { name: 'Months' })).toHaveClass('bg-[#3CCED7]');

    fireEvent.click(screen.getByRole('button', { name: 'Weeks' }));
    expect(screen.getByRole('button', { name: 'Weeks' })).toHaveClass('bg-[#3CCED7]');

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('button', { name: 'Today' })).toHaveClass('bg-[#3CCED7]');
  });

  it('filters tasks by timeline search', () => {
    // TimelineHeader is now a standalone component; test its search input directly
    const onSearchChange = jest.fn();
    render(
      <TimelineHeader
        searchValue=""
        onSearchChange={onSearchChange}
        workTypeOptions={[{ value: 'all', label: 'All work types' }]}
        selectedWorkType="all"
        onWorkTypeChange={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Search timeline'), {
      target: { value: 'Asset' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('Asset');
  });

  it('filters tasks by work type', () => {
    // TimelineHeader is now a standalone component; test its work type select directly
    const onWorkTypeChange = jest.fn();
    render(
      <TimelineHeader
        searchValue=""
        onSearchChange={jest.fn()}
        workTypeOptions={[
          { value: 'all', label: 'All work types' },
          { value: 'asset', label: 'Asset' },
          { value: 'budget', label: 'Budget' },
        ]}
        selectedWorkType="all"
        onWorkTypeChange={onWorkTypeChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Work type filter'), {
      target: { value: 'asset' },
    });

    expect(onWorkTypeChange).toHaveBeenCalledWith('asset');
  });

  it('shows current user initials in the timeline header avatar', () => {
    // TimelineHeader renders the avatar; test it directly
    render(
      <TimelineHeader
        searchValue=""
        onSearchChange={jest.fn()}
        workTypeOptions={[{ value: 'all', label: 'All work types' }]}
        selectedWorkType="all"
        onWorkTypeChange={jest.fn()}
        currentUser={{ username: 'bob.smith' }}
      />
    );
    expect(screen.getByText('BS')).toBeInTheDocument();
  });

  it('renders task bars', () => {
    const tasks = [
      makeTask({ id: 101, summary: 'Budget Review', type: 'budget' }),
      makeTask({ id: 202, summary: 'Asset Draft', type: 'asset', project: { id: 1, name: 'Q4 Performance Campaign' } }),
    ];

    render(<TimelineView tasks={tasks} />);

    expect(screen.getByTestId('task-bar-101')).toBeInTheDocument();
    expect(screen.getByTestId('task-bar-202')).toBeInTheDocument();
  });
});
