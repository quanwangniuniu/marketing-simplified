'use client';

import type { SheetPresenceUser } from '@/lib/sheetSocketStore';
import { rowColToA1 } from '@/lib/spreadsheets/a1';

interface Props {
  users: SheetPresenceUser[];
  maxVisible?: number;
}

function cursorLabel(user: SheetPresenceUser): string {
  const row = user.cursor?.row;
  const col = user.cursor?.col;
  // Grid selection is 0-based; A1 helper expects 1-based.
  if (row == null || col == null || row < 0 || col < 0) {
    return user.username;
  }
  const a1 = rowColToA1(row + 1, col + 1);
  return a1 ? `${user.username} · ${a1}` : user.username;
}

export default function PresenceAvatars({ users, maxVisible = 5 }: Props) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - visible.length;

  return (
    <div
      className="flex items-center"
      data-testid="sheet-presence-avatars"
      aria-label={`${users.length} collaborators online`}
    >
      <div className="flex -space-x-2">
        {visible.map((user) => {
          const initial = (user.username.trim().charAt(0) || '?').toUpperCase();
          return (
            <div
              key={`${user.userId}:${user.clientId}`}
              data-testid="sheet-presence-avatar"
              data-user-id={user.userId}
              title={cursorLabel(user)}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: user.color }}
            >
              {initial}
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <span className="ml-2 text-xs font-medium text-gray-500">+{overflow}</span>
      )}
    </div>
  );
}
