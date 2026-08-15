import { isChannelManager } from '@/lib/chatPermissions';
import type { Chat, ChatParticipant } from '@/types/chat';

function participant(
  id: number,
  userId: number,
  joinedAt: string,
  overrides: Partial<ChatParticipant> = {},
): ChatParticipant {
  return {
    id,
    user: {
      id: userId,
      email: `user-${userId}@example.com`,
      username: `user-${userId}`,
    },
    chat_id: 1,
    joined_at: joinedAt,
    is_active: true,
    is_manager: false,
    ...overrides,
  };
}

function chat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: 1,
    slug: 'general',
    project_id: 1,
    type: 'group',
    name: 'General',
    participants: [],
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('isChannelManager', () => {
  it('accepts an active explicit manager', () => {
    const manager = participant(1, 10, '2026-07-01T00:00:00Z', { is_manager: true });

    expect(isChannelManager(chat({ participants: [manager] }), 10)).toBe(true);
  });

  it('accepts the channel creator when they are an active participant', () => {
    const creator = participant(1, 10, '2026-07-01T00:00:00Z');

    expect(isChannelManager(chat({ created_by_id: 10, participants: [creator] }), 10)).toBe(true);
  });

  it('uses the earliest active participant as the legacy fallback manager', () => {
    const later = participant(2, 20, '2026-07-02T00:00:00Z');
    const first = participant(1, 10, '2026-07-01T00:00:00Z');

    const legacyChat = chat({ participants: [later, first] });

    expect(isChannelManager(legacyChat, 10)).toBe(true);
    expect(isChannelManager(legacyChat, 20)).toBe(false);
  });

  it('does not use the legacy fallback when an explicit manager exists', () => {
    const first = participant(1, 10, '2026-07-01T00:00:00Z');
    const manager = participant(2, 20, '2026-07-02T00:00:00Z', { is_manager: true });

    const managedChat = chat({ participants: [first, manager] });

    expect(isChannelManager(managedChat, 10)).toBe(false);
    expect(isChannelManager(managedChat, 20)).toBe(true);
  });

  it('rejects inactive participants and private chats', () => {
    const inactiveManager = participant(1, 10, '2026-07-01T00:00:00Z', {
      is_active: false,
      is_manager: true,
    });

    expect(isChannelManager(chat({ participants: [inactiveManager] }), 10)).toBe(false);
    expect(
      isChannelManager(chat({ type: 'private', participants: [inactiveManager] }), 10),
    ).toBe(false);
  });
});
