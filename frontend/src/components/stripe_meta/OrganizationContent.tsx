'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, UserPlus } from 'lucide-react';
import CreateOrganizationModal from './CreateOrganizationModal';
import InviteMembersModal from './InviteMembersModal';
import useStripe from '@/hooks/useStripe';
import { useAuthStore } from '@/lib/authStore';
import { Skeleton } from '@/components/ui/skeleton';

interface OrganizationContentProps {
  user: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    roles?: string[];
    organization?: {
      id: number;
      name: string;
    } | null;
  };
}

function OrganizationMembersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`organization-member-skeleton-${index}`}
          className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrganizationContent({ user }: OrganizationContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { createOrganization, createOrganizationLoading, getOrganizationUsers } = useStripe();
  const [members, setMembers] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // New state for invite modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Check if user has permission to manage members
  const canManageMembers = user.roles?.includes('Organization Admin') || user.roles?.includes('Owner');

  const handleCreateOrganization = async (data: { name: string; description?: string; email_domain?: string }) => {
    try {
      await createOrganization(data);

      // Fetch updated user information from server
      const { getCurrentUser } = useAuthStore.getState();
      await getCurrentUser();

      setIsModalOpen(false);
    } catch (error) {
      // Error is already handled in the hook
      console.error('Failed to create organization:', error);
    }
  };

  useEffect(() => {
    const fetchMembers = async () => {
      if (!user?.organization?.id) return;
      setLoadingMembers(true);
      try {
        const res = await getOrganizationUsers(page, pageSize);
        setMembers(res.results || []);
        setCount(res.count || 0);
      } catch (e) {
        // toast handled in hook
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, [user?.organization?.id, page, pageSize, getOrganizationUsers]);

  if (!user?.organization) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-gray-800">My Organization</div>
            <div className="text-sm text-gray-500">
              Organization Management
            </div>
          </div>

          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="text-xl font-semibold text-gray-700 mb-3">No Organization Found</div>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              You haven&apos;t joined any organization yet. Organization features like team management,
              subscription plans, and usage tracking are not available.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r text-white rounded-lg hover:from-[#3CCED7] hover:to-[#2AB5BD] transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4 inline mr-2" strokeWidth={1.5} />
                Create Organization
              </button>
              <div className="text-sm text-gray-400">
                or
              </div>
              <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium">
                <UserPlus className="w-4 h-4 inline mr-2" />
                Join Existing Organization
              </button>
            </div>
          </div>
        </div>
        <CreateOrganizationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateOrganization}
          loading={createOrganizationLoading}
        />
        <InviteMembersModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-800">My Organization</div>
          <div className="text-sm text-gray-500">
            Organization Management
          </div>
        </div>

        <div className="space-y-2">
          <div className="border border-gray-200 rounded-xl p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-800">Organization Details</div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-900">Name</span>
                <span className="text-sm text-gray-500">{user.organization.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-900">Created</span>
                <span className="text-sm text-gray-500">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-900">Members</span>
                {loadingMembers ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className="text-sm text-gray-500">{count}</span>
                )}
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-800">Organization Members</div>
            </div>
            <div className="space-y-3">
              {loadingMembers ? (
                <OrganizationMembersSkeleton />
              ) : members.length === 0 ? (
                <div className="text-sm text-gray-500">No members found.</div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m?.avatar || "/profile-avatar.svg"}
                        alt={m?.username || m?.email || 'User'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {m.first_name} {m.last_name}
                      </p>
                      <p className="text-xs text-gray-600">{m.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Pagination */}
            {count > pageSize && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {Math.min((page - 1) * pageSize + 1, count)} to {Math.min(page * pageSize, count)} of {count} members
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700 transition-colors"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, Math.ceil(count / pageSize)) }, (_, i) => {
                        const pageNum = i + 1;
                        const isCurrentPage = pageNum === page;
                        return (
                          <button
                            key={pageNum}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isCurrentPage
                              ? 'bg-[#3CCED7] text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700 transition-colors"
                      onClick={() => {
                        const maxPage = Math.max(1, Math.ceil(count / pageSize));
                        setPage((p) => Math.min(maxPage, p + 1));
                      }}
                      disabled={page >= Math.max(1, Math.ceil(count / pageSize))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-800">Organization Actions</div>
            </div>
            <div className="space-y-2">
              {canManageMembers && (
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="w-full text-left text-sm text-gray-500 hover:text-gray-900 transition-colors py-3 px-4 rounded-lg hover:bg-gray-300 "
                >
                  Invite Organization Members
                </button>
              )}
              <button className="w-full text-left text-sm text-gray-500 hover:text-gray-900 transition-colors py-3 px-4 rounded-lg hover:bg-gray-300 ">
                Manage Permissions
              </button>
              <button className="w-full text-left text-sm text-gray-500 hover:text-gray-900 transition-colors py-3 px-4 rounded-lg hover:bg-gray-300 ">
                Organization Settings
              </button>
            </div>
          </div>
        </div>
      </div>
      <InviteMembersModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </>
  );
}
