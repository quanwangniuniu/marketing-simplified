// Shared sender-avatar palette: the same mapping MessageItem uses for the
// timeline, so pins UI avatars match the message list exactly.
export const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
];

export function avatarColor(userId?: number | null): string {
  return AVATAR_COLORS[(userId ?? 0) % AVATAR_COLORS.length];
}
