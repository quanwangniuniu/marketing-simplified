'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Shield, UserCheck } from 'lucide-react';
import type { ProjectInvitationSummary } from '@/types/overview';

interface TeamCardProps {
  pendingInvitations: ProjectInvitationSummary[];
  memberCount?: number | null;
  canAdminister?: boolean;
}

export default function TeamCard({
  pendingInvitations,
  memberCount,
  canAdminister = false,
}: TeamCardProps) {
  const router = useRouter();
  const topInvites = pendingInvitations.slice(0, 3);

  return (
    <Card
      data-overview-card="team"
      className="border-[0.5px] border-gray-200 bg-white shadow-none"
    >
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <CardTitle className="text-sm font-medium text-gray-900">Team</CardTitle>
          {memberCount != null && (
            <span className="ml-auto text-xs text-gray-400">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        <button
          onClick={() => router.push('/projects')}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md bg-[#3CCED7]/10 border border-[#3CCED7]/20 hover:bg-[#3CCED7]/15 transition-colors"
        >
          <Mail className="w-4 h-4 text-[#3CCED7]" />
          <div className="flex-1 text-left text-xs text-gray-700">
            <span className="font-semibold text-[#1a9ba3]">
              {pendingInvitations.length}
            </span>
            <span className="ml-1">
              pending {pendingInvitations.length === 1 ? 'invitation' : 'invitations'}
            </span>
          </div>
          <span className="text-[11px] text-[#3CCED7] font-medium">Manage →</span>
        </button>

        {topInvites.length > 0 && (
          <div className="space-y-1">
            {topInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-1.5 px-1 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-gray-800 truncate">{inv.projectName}</p>
                  {inv.invitedBy && (
                    <p className="text-[10px] text-gray-400 truncate">from {inv.invitedBy}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canAdminister && (
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-100">
            <button
              onClick={() => router.push('/admin/roles')}
              className="flex flex-col items-center gap-1 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] text-gray-600">Roles</span>
            </button>
            <button
              onClick={() => router.push('/admin/permissions')}
              className="flex flex-col items-center gap-1 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] text-gray-600">Permissions</span>
            </button>
            <button
              onClick={() => router.push('/admin/approvers')}
              className="flex flex-col items-center gap-1 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] text-gray-600">Approvers</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
