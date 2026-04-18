import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectMembersSection from '@/components/messages/LeftSidebar/ProjectMembersSection';
import type { ProjectMemberData } from '@/lib/api/projectApi';

const makeMember = (
  id: number,
  userId: number,
  name: string,
  email: string
): ProjectMemberData => ({
  id,
  user: { id: userId, username: name.toLowerCase().replace(' ', '.'), email, name },
  project: { id: 3, name: 'Test Project' },
  role: 'member',
  is_active: true,
});

const alice = makeMember(1, 101, 'Alice Wang', 'alice@test.com');
const bob = makeMember(2, 102, 'Bob Chen', 'bob@test.com');
const carol = makeMember(3, 103, 'Carol Li', 'carol@test.com');
const currentUser = makeMember(4, 100, 'Current User', 'me@test.com');

describe('ProjectMembersSection', () => {
  const defaultProps = {
    members: [alice, bob, carol, currentUser],
    isLoading: false,
    currentUserId: 100,
    dmUserIds: new Set<number>(),
    onStartDM: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AC: Members sorted alphabetically
  test('renders members sorted alphabetically, excluding current user', () => {
    render(<ProjectMembersSection {...defaultProps} />);

    const rows = screen.getAllByTestId('project-member-dm-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Alice Wang');
    expect(rows[1]).toHaveTextContent('Bob Chen');
    expect(rows[2]).toHaveTextContent('Carol Li');
  });

  // AC: Current user excluded
  test('does not show current user in the list', () => {
    render(<ProjectMembersSection {...defaultProps} />);
    expect(screen.queryByText('Current User')).not.toBeInTheDocument();
  });

  // AC: Members with existing DMs are deduplicated out
  test('excludes members who already have DM threads (deduplication)', () => {
    const dmUserIds = new Set([101]); // Alice already has a DM
    render(<ProjectMembersSection {...defaultProps} dmUserIds={dmUserIds} />);

    expect(screen.queryByText('Alice Wang')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Chen')).toBeInTheDocument();
    expect(screen.getByText('Carol Li')).toBeInTheDocument();
  });

  // AC: Clicking member starts a DM
  test('calls onStartDM with correct userId when clicking a member', () => {
    const onStartDM = jest.fn();
    render(<ProjectMembersSection {...defaultProps} onStartDM={onStartDM} />);

    fireEvent.click(screen.getByText('Bob Chen'));
    expect(onStartDM).toHaveBeenCalledWith(102);
    expect(onStartDM).toHaveBeenCalledTimes(1);
  });

  // AC: Loading state shows skeleton
  test('shows skeleton loader while loading', () => {
    render(<ProjectMembersSection {...defaultProps} isLoading={true} />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
    expect(screen.queryByTestId('project-member-dm-row')).not.toBeInTheDocument();
  });

  // AC: "No other members yet" state
  test('shows empty message when only the current user is in the project', () => {
    render(
      <ProjectMembersSection
        {...defaultProps}
        members={[currentUser]}
      />
    );

    expect(screen.getByText('No other members yet')).toBeInTheDocument();
    expect(screen.queryByTestId('project-member-dm-row')).not.toBeInTheDocument();
  });

  // AC: "No other members yet" when all others have existing DMs
  test('shows empty message when all non-self members are deduplicated', () => {
    const dmUserIds = new Set([101, 102, 103]);
    render(<ProjectMembersSection {...defaultProps} dmUserIds={dmUserIds} />);

    expect(screen.getByText('No other members yet')).toBeInTheDocument();
  });

  test('renders avatar initial for each member', () => {
    render(<ProjectMembersSection {...defaultProps} />);

    const rows = screen.getAllByTestId('project-member-dm-row');
    // First member "Alice Wang" → initial "A"
    expect(rows[0].querySelector('.rounded-full')).toHaveTextContent('A');
    expect(rows[1].querySelector('.rounded-full')).toHaveTextContent('B');
    expect(rows[2].querySelector('.rounded-full')).toHaveTextContent('C');
  });
});
