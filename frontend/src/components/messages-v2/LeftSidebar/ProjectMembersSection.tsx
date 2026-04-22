'use client';

import { useMemo } from 'react';
import { User, UserPlus } from 'lucide-react';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectMembersSectionProps {
  members: ProjectMemberData[];
  isLoading: boolean;
  currentUserId: number | null;
  /**
   * Set of user IDs that already have a DM thread open.
   * These members will be excluded from the list.
   */
  dmUserIds: Set<number>;
  onStartDM: (userId: number) => void;
}

export default function ProjectMembersSection({
  members,
  isLoading,
  currentUserId,
  dmUserIds,
  onStartDM,
}: ProjectMembersSectionProps) {
  // Filter out self and members who already have DM threads, then sort alphabetically
  const visibleMembers = useMemo(() => {
    return members
      .filter((m) => {
        const uid = m.user?.id;
        if (typeof uid !== 'number') return false;
        // Exclude current user
        if (uid === currentUserId) return false;
        // Exclude members who already have a DM thread
        if (dmUserIds.has(uid)) return false;
        return true;
      })
      .sort((a, b) => {
        const nameA = (a.user?.name || a.user?.username || a.user?.email || '').toLowerCase();
        const nameB = (b.user?.name || b.user?.username || b.user?.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [members, currentUserId, dmUserIds]);

  if (isLoading) {
    return (
      <div className="space-y-2 px-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (visibleMembers.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500">
        No other members yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5 mx-1">
      {visibleMembers.map((member) => {
        const displayName =
          member.user?.name || member.user?.username || member.user?.email || 'Unknown';
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onStartDM(member.user.id)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 text-left rounded-md group/member"
            title={`Message ${displayName}`}
            data-testid="project-member-dm-row"
            data-user-id={String(member.user.id)}
          >
            <div className="w-6 h-6 rounded-full bg-[#3CCED7]/15 text-[#3CCED7] flex items-center justify-center flex-shrink-0 text-xs font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 min-w-0 truncate">{displayName}</span>
            <UserPlus className="w-4 h-4 text-gray-400 opacity-0 group-hover/member:opacity-100 transition-opacity" />
          </button>
        );
      })}
    </div>
  );
}
