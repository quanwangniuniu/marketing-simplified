'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { Button } from '@/components/ui/button';
import InlineEditController from '@/inline-edit/InlineEditController';
import InlineSelectController from '@/inline-edit/InlineSelectController';
import InlineMultiSelectController from '@/inline-edit/InlineMultiSelectController';
import { useCampaignTemplate } from '@/hooks/campaigns/useCampaignTemplate';
import SharingScopePill from '@/components/campaigns/pills/SharingScopePill';
import TemplateActionBar from '@/components/campaigns/templates/TemplateActionBar';
import BrandConfirmDialog from '@/components/campaigns/BrandConfirmDialog';
import CreateCampaignFromTemplateDialog from '@/components/campaigns/modals/CreateCampaignFromTemplateDialog';
import type {
  CampaignObjective,
  CampaignPlatform,
} from '@/types/campaign';

const OBJECTIVE_OPTIONS = [
  { value: 'AWARENESS', label: 'Awareness' },
  { value: 'CONSIDERATION', label: 'Consideration' },
  { value: 'CONVERSION', label: 'Conversion' },
  { value: 'RETENTION', label: 'Retention' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'TRAFFIC', label: 'Traffic' },
  { value: 'LEAD_GENERATION', label: 'Lead Generation' },
  { value: 'APP_PROMOTION', label: 'App Promotion' },
];

const PLATFORM_OPTIONS = [
  { value: 'META', label: 'Meta' },
  { value: 'GOOGLE_ADS', label: 'Google Ads' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'SNAPCHAT', label: 'Snapchat' },
  { value: 'TWITTER', label: 'Twitter' },
  { value: 'PINTEREST', label: 'Pinterest' },
  { value: 'REDDIT', label: 'Reddit' },
  { value: 'PROGRAMMATIC', label: 'Programmatic' },
  { value: 'EMAIL', label: 'Email' },
];

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function TemplateV2DetailPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params?.id as string;
  const { data, loading, error, refresh, update, archive, unarchive, destroy } =
    useCampaignTemplate(templateId);

  const [useOpen, setUseOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    refresh().catch((err) => {
      console.error('Failed to fetch template:', err);
      toast.error('Failed to load template');
    });
  }, [templateId, refresh]);

  const handleFieldSave = async (field: string, value: any) => {
    try {
      await update({ [field]: value } as any);
      toast.success('Saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to save');
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await archive();
      toast.success('Template archived');
      setArchiveOpen(false);
      router.push('/campaigns/templates');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to archive');
    } finally {
      setBusy(false);
    }
  };

  const handleUnarchive = async () => {
    setBusy(true);
    try {
      await unarchive();
      toast.success('Template unarchived');
      setUnarchiveOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to unarchive');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await destroy();
      toast.success('Template deleted');
      setDeleteOpen(false);
      router.push('/campaigns/templates');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#3CCED7]" />
          <span className="ml-3 text-sm text-gray-600">Loading template...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="px-6 py-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/campaigns/templates')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Templates
          </Button>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-800">
              {(error as any)?.response?.data?.error || (error as any)?.message || 'Template not found'}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/campaigns/templates')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Button>

        <div className="mb-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <InlineEditController
                  value={data.name}
                  onSave={(next) => handleFieldSave('name', next)}
                  className="text-2xl font-semibold text-gray-900"
                />
                <SharingScopePill scope={data.sharing_scope} />
                <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                  v{data.version_number}
                </span>
                {data.is_archived && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 italic">
                    archived
                  </span>
                )}
              </div>
              <div className="mt-2">
                <InlineEditController
                  value={data.description || ''}
                  onSave={(next) => handleFieldSave('description', next)}
                  className="text-sm text-gray-600"
                  placeholder="Add a description..."
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                by {data.creator?.username ?? 'Unknown'} · Last updated {formatDate(data.updated_at)} · Used{' '}
                {data.usage_count ?? 0} time{data.usage_count === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <TemplateActionBar
              template={data}
              onUse={() => setUseOpen(true)}
              onArchive={() => setArchiveOpen(true)}
              onUnarchive={() => setUnarchiveOpen(true)}
              onDelete={() => setDeleteOpen(true)}
              busy={busy}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Structure</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="mb-1 text-xs font-medium text-gray-500">Objective</dt>
                  <dd>
                    <InlineSelectController
                      value={data.objective || ''}
                      options={OBJECTIVE_OPTIONS}
                      onSave={(next) => handleFieldSave('objective', next)}
                      className="text-sm text-gray-900"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-medium text-gray-500">Platforms</dt>
                  <dd>
                    <InlineMultiSelectController
                      value={data.platforms || []}
                      options={PLATFORM_OPTIONS}
                      onSave={(next) => handleFieldSave('platforms', next)}
                      className="text-sm text-gray-900"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-medium text-gray-500">Hypothesis Framework</dt>
                  <dd>
                    <InlineEditController
                      value={data.hypothesis_framework || ''}
                      onSave={(next) => handleFieldSave('hypothesis_framework', next)}
                      className="text-sm text-gray-700"
                      placeholder="Add a hypothesis framework..."
                    />
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-medium text-gray-500">Tag Suggestions</dt>
                  <dd>
                    {(data.tag_suggestions || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(data.tag_suggestions || []).map((tag: string) => (
                          <span
                            key={tag}
                            className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No tags</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="space-y-5 lg:col-span-1">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Metadata</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">Version</dt>
                  <dd className="text-gray-900 font-medium">v{data.version_number}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">Usage count</dt>
                  <dd className="text-gray-900">{data.usage_count ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">Created</dt>
                  <dd className="text-gray-700">{formatDate(data.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">Last updated</dt>
                  <dd className="text-gray-700">{formatDate(data.updated_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">Sharing scope</dt>
                  <dd><SharingScopePill scope={data.sharing_scope} /></dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-gray-400">
                Scope change not allowed. To move scope, open a campaign and save as a new template.
              </p>
            </section>
          </div>
        </div>

        <CreateCampaignFromTemplateDialog
          open={useOpen}
          onOpenChange={setUseOpen}
          template={data}
        />

        <BrandConfirmDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          title="Archive Template?"
          message={`"${data.name}" will be hidden from lists. You can unarchive later.`}
          confirmLabel="Archive"
          loading={busy}
          onConfirm={handleArchive}
        />
        <BrandConfirmDialog
          open={unarchiveOpen}
          onOpenChange={setUnarchiveOpen}
          title="Unarchive Template?"
          message={`"${data.name}" will be visible in lists again.`}
          confirmLabel="Unarchive"
          loading={busy}
          onConfirm={handleUnarchive}
        />
        <BrandConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Template?"
          message={`"${data.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          loading={busy}
          onConfirm={handleDelete}
        />
      </div>
      <ChatFAB />
    </DashboardLayout>
  );
}
