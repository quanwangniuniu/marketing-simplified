'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/lib/projectStore';
import { useCampaignTemplates } from '@/hooks/campaigns-v2/useCampaignTemplates';
import TemplateListTable from '@/components/campaigns-v2/templates/TemplateListTable';
import type { TemplateSharingScope } from '@/types/campaign';

const SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All scopes' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'TEAM', label: 'Team' },
  { value: 'ORGANIZATION', label: 'Organization' },
];

export default function TemplatesListV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = projectIdParam ? Number(projectIdParam) : activeProject?.id ?? null;

  const { items, loading, error, refresh } = useCampaignTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    refresh({
      sharing_scope: scopeFilter !== 'all' ? (scopeFilter as TemplateSharingScope) : undefined,
    }).catch((err) => {
      console.error('Failed to fetch templates:', err);
      toast.error('Failed to load templates');
    });
  }, [scopeFilter, refresh]);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (showArchived && !t.is_archived) return false;
      if (!showArchived && t.is_archived) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.name?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [items, searchQuery, scopeFilter, showArchived]);

  const errorMessage = error
    ? (error as any)?.response?.data?.error || (error as any)?.message || 'Failed to load'
    : null;

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/campaigns-v2')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Button>

        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Campaign Templates</h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeProject?.name ?? 'No project selected'}
              {' · '}
              <span className="text-gray-400">
                {filtered.length} template{filtered.length === 1 ? '' : 's'}
                {showArchived ? ' (archived)' : ''}
              </span>
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#3CCED7]"
            />
            Show archived
          </label>
        </header>

        <div className="mb-3 flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name or description…"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
          />
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="w-44 rounded-md border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <TemplateListTable
          templates={filtered}
          loading={loading}
          errorMessage={errorMessage}
          showArchived={showArchived}
          onRowClick={(t) => router.push(`/campaigns-v2/templates/${t.id}`)}
        />
      </div>
      <ChatFAB />
    </DashboardLayout>
  );
}
