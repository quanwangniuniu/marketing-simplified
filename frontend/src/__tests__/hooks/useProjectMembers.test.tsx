import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { ProjectAPI } from '@/lib/api/projectApi';

jest.mock('@/lib/api/projectApi');

const mockProjectAPI = ProjectAPI as jest.Mocked<typeof ProjectAPI>;

const makeMember = (id: number, name: string, email: string) => ({
  id,
  user: { id: id + 100, username: name.toLowerCase(), email, name },
  project: { id: 3, name: 'Testing Project' },
  role: 'member',
  is_active: true,
});

// Harness to render the hook's return values into the DOM for inspection
function Harness({ projectId }: { projectId: number | null | undefined }) {
  const { members, isLoading, error } = useProjectMembers(projectId);
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="count">{members.length}</span>
      {members.map((m) => (
        <span key={m.id} data-testid="member">
          {m.user.name}
        </span>
      ))}
    </div>
  );
}

describe('useProjectMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not fetch when projectId is null', async () => {
    render(<Harness projectId={null} />);
    expect(mockProjectAPI.getAllProjectMembers).not.toHaveBeenCalled();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  test('does not fetch when projectId is undefined', async () => {
    render(<Harness projectId={undefined} />);
    expect(mockProjectAPI.getAllProjectMembers).not.toHaveBeenCalled();
  });

  test('does not fetch when projectId is 0 or negative', async () => {
    render(<Harness projectId={0} />);
    expect(mockProjectAPI.getAllProjectMembers).not.toHaveBeenCalled();

    render(<Harness projectId={-1} />);
    expect(mockProjectAPI.getAllProjectMembers).not.toHaveBeenCalled();
  });

  test('fetches members for a valid projectId', async () => {
    const members = [
      makeMember(1, 'Alice', 'alice@test.com'),
      makeMember(2, 'Bob', 'bob@test.com'),
    ];
    mockProjectAPI.getAllProjectMembers.mockResolvedValue(members);

    render(<Harness projectId={3} />);

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2');
    });

    expect(mockProjectAPI.getAllProjectMembers).toHaveBeenCalledWith(3);
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  test('clears members and sets error on API failure', async () => {
    mockProjectAPI.getAllProjectMembers.mockRejectedValue(new Error('Network error'));

    render(<Harness projectId={3} />);

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Network error');
    });

    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  test('re-fetches when projectId changes', async () => {
    const membersA = [makeMember(1, 'Alice', 'alice@test.com')];
    const membersB = [makeMember(2, 'Bob', 'bob@test.com'), makeMember(3, 'Carol', 'carol@test.com')];

    mockProjectAPI.getAllProjectMembers
      .mockResolvedValueOnce(membersA)
      .mockResolvedValueOnce(membersB);

    const { rerender } = render(<Harness projectId={3} />);
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });

    rerender(<Harness projectId={5} />);
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2');
    });

    expect(mockProjectAPI.getAllProjectMembers).toHaveBeenCalledTimes(2);
    expect(mockProjectAPI.getAllProjectMembers).toHaveBeenNthCalledWith(1, 3);
    expect(mockProjectAPI.getAllProjectMembers).toHaveBeenNthCalledWith(2, 5);
  });

  test('clears members when projectId becomes null', async () => {
    const members = [makeMember(1, 'Alice', 'alice@test.com')];
    mockProjectAPI.getAllProjectMembers.mockResolvedValue(members);

    const { rerender } = render(<Harness projectId={3} />);
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });

    rerender(<Harness projectId={null} />);
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('0');
    });
  });
});
