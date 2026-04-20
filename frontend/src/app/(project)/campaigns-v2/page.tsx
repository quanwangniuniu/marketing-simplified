'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { useProjectStore } from '@/lib/projectStore';
import { useCampaignData } from '@/hooks/useCampaignData';
import CampaignListFilters from '@/components/campaigns-v2/CampaignListFilters';
import CampaignListTable from '@/components/campaigns-v2/CampaignListTable';
import CreateCampaignDialog from '@/components/campaigns-v2/modals/CreateCampaignDialog';
import CreateCampaignFromTemplateDialog from '@/components/campaigns-v2/modals/CreateCampaignFromTemplateDialog';

export default function CampaignsV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = projectIdParam ? Number(projectIdParam) : activeProject?.id ?? null;

  const { campaigns, loading, error, fetchCampaigns } = useCampaignData();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [fromTemplateOpen, setFromTemplateOpen] = useState(false);

  const reload = () => {
    if (!projectId) return;
    const params: Record<string, string> = { project: String(projectId) };
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    fetchCampaigns(params).catch((err) => {
      console.error('Failed to fetch campaigns:', err);
      toast.error('Failed to load campaigns');
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchQuery, statusFilter]);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter && statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesHypo = c.hypothesis?.toLowerCase().includes(q);
        if (!matchesName && !matchesHypo) return false;
      }
      return true;
    });
  }, [campaigns, searchQuery, statusFilter]);

  const errorMessage = error
    ? (error as any)?.response?.data?.error || (error as any)?.message || 'Failed to load campaigns'
    : null;

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeProject?.name ?? 'No project selected'}
              {' · '}
              <span className="text-gray-400">
                {filtered.length} item{filtered.length === 1 ? '' : 's'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFromTemplateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" />
              From Template
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#3CCED7] to-[#A6E661] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </button>
          </div>
        </header>

        <CampaignListFilters
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
        />

        <CampaignListTable
          campaigns={filtered}
          loading={loading}
          errorMessage={errorMessage}
          onRowClick={(c) => router.push(`/campaigns-v2/${c.id}`)}
        />

        <CreateCampaignDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={reload}
        />
        <CreateCampaignFromTemplateDialog
          open={fromTemplateOpen}
          onOpenChange={setFromTemplateOpen}
        />
      </div>
      <ChatFAB />
    </DashboardLayout>
  );
}
