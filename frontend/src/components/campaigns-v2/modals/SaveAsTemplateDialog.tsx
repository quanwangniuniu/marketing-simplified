'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { SaveCampaignAsTemplateData, TemplateSharingScope } from '@/types/campaign';
import { useProjectStore } from '@/lib/projectStore';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';
import { Button } from '@/components/ui/button';
import BrandButton from '../BrandButton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}

const SCOPES: Array<{ value: TemplateSharingScope; label: string }> = [
  { value: 'PERSONAL', label: 'Personal (Private)' },
  { value: 'TEAM', label: 'Team-wide' },
  { value: 'ORGANIZATION', label: 'Organization-wide' },
];

export default function SaveAsTemplateDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: Props) {
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<TemplateSharingScope>('PERSONAL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(`${campaignName} Template`);
      setDescription('');
      setScope('PERSONAL');
      setError(null);
    }
  }, [open, campaignName]);

  const handleClose = (next: boolean) => {
    if (submitting) return;
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if ((scope === 'TEAM' || scope === 'ORGANIZATION') && !activeProject?.id) {
      setError('No active project. Switch to a project first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data: SaveCampaignAsTemplateData = {
        name: name.trim(),
        description: description.trim() || undefined,
        sharing_scope: scope,
      };
      if (scope === 'TEAM' || scope === 'ORGANIZATION') {
        data.project_id = activeProject?.id as any;
      }
      const res = await CampaignAPI.saveCampaignAsTemplate(campaignId, data);
      toast.success('Saved as template');
      handleClose(false);
      router.push(`/campaigns-v2/templates/${res.data.id}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save as template';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleClose}
      title="Save as Template"
      subtitle="Reuse this campaign's structure in future work."
      width="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Template Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            disabled={submitting}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Sharing Scope <span className="text-rose-500">*</span>
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as TemplateSharingScope)}
            disabled={submitting}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 disabled:opacity-50"
          >
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {(scope === 'TEAM' || scope === 'ORGANIZATION') && activeProject && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              Will be shared within project{' '}
              <span className="font-medium text-gray-700">{activeProject.name}</span>.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-800">{error}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={submitting} onClick={() => handleClose(false)}>
          Cancel
        </Button>
        <BrandButton size="sm" disabled={submitting || !name.trim()} onClick={handleSubmit}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Template
        </BrandButton>
      </div>
    </BrandDialog>
  );
}
