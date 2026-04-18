import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomeSidebar from '@/components/messages/LeftSidebar/HomeSidebar';
import type { Chat, ChatParticipant } from '@/types/chat';
import type { ProjectMemberData } from '@/lib/api/projectApi';

// ── Mocks ──────────────────────────────────────────────────

jest.mock('@/lib/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({ user: { id: 100, email: 'me@test.com', username: 'me' } }),
}));

jest.mock('@/lib/api/chatApi', () => ({
  listStarredChats: jest.fn().mockResolvedValue([]),
  starChat: jest.fn(),
  unstarChat: jest.fn(),
  reorderStarredChats: jest.fn(),
}));

jest.mock('@/components/messages/LeftSidebar/FilesSidebarView', () => {
  return function MockFilesSidebarView() {
    return <div data-testid="files-view" />;
  };
});

jest.mock('@/components/messages/LeftSidebar/ActivitySidebarView', () => {
  return function MockActivitySidebarView() {
    return <div data-testid="activity-view" />;
  };
});

// ── Test helpers ───────────────────────────────────────────

const makeParticipant = (userId: number, username: string): ChatParticipant => ({
  id: userId,
  user: { id: userId, email: `${username}@test.com`, username },
  chat_id: 0,
  joined_at: '2026-01-01T00:00:00Z',
});

const makePrivateChat = (
  id: number,
  otherUserId: number,
  otherUsername: string
): Chat => ({
  id,
  project_id: 3,
  type: 'private',
  name: null,
  participants: [
    makeParticipant(100, 'me'),
    makeParticipant(otherUserId, otherUsername),
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const makeGroupChat = (id: number, name: string): Chat => ({
  id,
  project_id: 3,
  type: 'group',
  name,
  participants: [makeParticipant(100, 'me')],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const makeMember = (
  id: number,
  userId: number,
  name: string
): ProjectMemberData => ({
  id,
  user: { id: userId, username: name.toLowerCase(), email: `${name.toLowerCase()}@test.com`, name },
  project: { id: 3, name: 'Test' },
  role: 'member',
  is_active: true,
});

const defaultProps = {
  view: 'home' as const,
  selectedProjectId: 3,
  chats: [] as Chat[],
  currentChatId: null,
  onSelectChat: jest.fn(),
  onCreateChat: jest.fn(),
  onCreateChannel: jest.fn(),
  isLoading: false,
  emptyState: <div>Empty</div>,
  roleByUserId: {},
  projectMembers: [] as ProjectMemberData[],
  isLoadingMembers: false,
  onStartDM: jest.fn(),
};

// ── Tests ──────────────────────────────────────────────────

describe('HomeSidebar — Project members integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AC: When a project is selected, the DM panel shows project members
  test('shows "Project members" section when project is selected', async () => {
    const members = [makeMember(1, 101, 'Alice'), makeMember(2, 102, 'Bob')];
    render(<HomeSidebar {...defaultProps} projectMembers={members} />);

    await waitFor(() => {
      expect(screen.getByText('Project members')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  // AC: When no project is selected (global view), behaviour is unchanged
  test('hides "Project members" section when no project selected', () => {
    const members = [makeMember(1, 101, 'Alice')];
    render(
      <HomeSidebar
        {...defaultProps}
        selectedProjectId={null}
        projectMembers={members}
      />
    );

    expect(screen.queryByText('Project members')).not.toBeInTheDocument();
  });

  // AC: Members the user has already DM'd appear under "Direct messages", not in members section
  test('deduplicates: members with existing DMs appear only in DM list', async () => {
    const dmChat = makePrivateChat(10, 101, 'alice');
    const members = [makeMember(1, 101, 'Alice'), makeMember(2, 102, 'Bob')];

    render(
      <HomeSidebar
        {...defaultProps}
        chats={[dmChat]}
        projectMembers={members}
      />
    );

    await waitFor(() => {
      // Alice should appear in DM section (as a chat row), not in project members
      const memberRows = screen.getAllByTestId('project-member-dm-row');
      const memberNames = memberRows.map((r) => r.textContent);
      expect(memberNames.some((n) => n?.includes('Alice'))).toBe(false);
      expect(memberNames.some((n) => n?.includes('Bob'))).toBe(true);
    });

    // Alice's DM thread is shown in the DM section
    const chatRows = screen.getAllByTestId('messages-chat-row');
    expect(chatRows.length).toBeGreaterThanOrEqual(1);
  });

  // AC: "No direct messages" empty state is replaced by member list when in project context
  test('shows member list instead of only "No direct messages" when project has members', async () => {
    const members = [makeMember(1, 101, 'Alice')];
    render(<HomeSidebar {...defaultProps} projectMembers={members} />);

    await waitFor(() => {
      expect(screen.getByText('No direct messages')).toBeInTheDocument();
      expect(screen.getByText('Project members')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  // AC: "No other members yet" when only the current user
  test('shows "No other members yet" when project has no other members', async () => {
    const members = [makeMember(4, 100, 'Me')]; // current user only
    render(<HomeSidebar {...defaultProps} projectMembers={members} />);

    await waitFor(() => {
      expect(screen.getByText('No other members yet')).toBeInTheDocument();
    });
  });

  // AC: Clicking a member calls onStartDM
  test('clicking a project member triggers onStartDM with the user id', async () => {
    const onStartDM = jest.fn();
    const members = [makeMember(1, 101, 'Alice')];
    render(
      <HomeSidebar {...defaultProps} projectMembers={members} onStartDM={onStartDM} />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Alice'));
    expect(onStartDM).toHaveBeenCalledWith(101);
  });

  // AC: Section visible in DMs nav view as well
  test('shows Project members in DMs view', async () => {
    const members = [makeMember(1, 101, 'Alice')];
    render(<HomeSidebar {...defaultProps} view="dms" projectMembers={members} />);

    await waitFor(() => {
      expect(screen.getByText('Project members')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  // AC: Section NOT visible in files/activity views
  test('hides Project members in activity view', () => {
    const members = [makeMember(1, 101, 'Alice')];
    render(<HomeSidebar {...defaultProps} view="activity" projectMembers={members} />);
    expect(screen.queryByText('Project members')).not.toBeInTheDocument();
  });

  test('hides Project members in files view', () => {
    const members = [makeMember(1, 101, 'Alice')];
    render(<HomeSidebar {...defaultProps} view="files" projectMembers={members} />);
    expect(screen.queryByText('Project members')).not.toBeInTheDocument();
  });

  // AC: Loading state
  test('shows skeleton loader while members are loading', () => {
    render(<HomeSidebar {...defaultProps} isLoadingMembers={true} />);

    expect(screen.getByText('Project members')).toBeInTheDocument();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
