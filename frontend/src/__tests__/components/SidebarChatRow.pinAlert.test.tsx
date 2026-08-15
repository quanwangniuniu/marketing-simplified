import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarChatRow from '@/components/messages/LeftSidebar/SidebarChatRow';
import { useChatStore } from '@/lib/chatStore';
import type { Chat } from '@/types/chat';

const channel: Chat = {
  id: 12,
  slug: 'announcements',
  project_id: 3,
  type: 'group',
  name: 'Announcements',
  participants: [],
  created_at: '2026-08-10T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
};

describe('SidebarChatRow pin alerts', () => {
  beforeEach(() => {
    useChatStore.setState({ unseenPinChatIds: {} });
  });

  it('shows a dedicated badge until the pin is acknowledged', () => {
    useChatStore.getState().markChatPinUnseen(channel.id);

    render(
      <SidebarChatRow
        chat={channel}
        isActive={false}
        displayName="Announcements"
        currentUserId={100}
        onClick={jest.fn()}
      />,
    );

    expect(screen.getByTestId('messages-pin-badge')).toHaveAccessibleName('New pinned message');

    act(() => {
      useChatStore.getState().clearChatPinUnseen(channel.id);
    });

    expect(screen.queryByTestId('messages-pin-badge')).not.toBeInTheDocument();
  });
});
