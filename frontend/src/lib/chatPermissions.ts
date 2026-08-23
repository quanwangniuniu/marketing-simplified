import type { Chat, ChatParticipant } from '@/types/chat';

type ChannelPermissionChat = Pick<Chat, 'type' | 'created_by_id' | 'participants'>;

function getActiveParticipants(chat: ChannelPermissionChat): ChatParticipant[] {
  return (chat.participants ?? []).filter(
    (participant) => participant.user && participant.is_active !== false,
  );
}

function getFallbackManagerUserId(participants: ChatParticipant[]): number | null {
  const firstParticipant = [...participants].sort((a, b) => {
    const aJoined = a.joined_at ? new Date(a.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bJoined = b.joined_at ? new Date(b.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (aJoined !== bJoined) return aJoined - bJoined;
    return a.id - b.id;
  })[0];

  return firstParticipant?.user.id ?? null;
}

/** Mirror ChatService.is_channel_manager for channel-management UI. */
export function isChannelManager(
  chat: ChannelPermissionChat,
  userId: number | null | undefined,
): boolean {
  if (chat.type !== 'group' || userId == null) return false;

  const participants = getActiveParticipants(chat);
  const participant = participants.find((candidate) => candidate.user.id === userId);
  if (!participant) return false;
  if (participant.is_manager) return true;
  if (chat.created_by_id === userId) return true;

  const hasExplicitManager = participants.some((candidate) => candidate.is_manager);
  return !hasExplicitManager && getFallbackManagerUserId(participants) === userId;
}
