'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Button from '@/components/button/Button';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { SaveCampaignAsTemplateData, TemplateSharingScope } from '@/types/campaign';
import { useProjects } from '@/hooks/useProjects';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
}

const sharingScopeOptions: Array<{ value: TemplateSharingScope; label: string }> = [
  { value: 'PERSONAL', label: 'Personal (Private)' },
  { value: 'TEAM', label: 'Team-wide' },
  { value: 'ORGANIZATION', label: 'Organization-wide' },
];

export default function SaveAsTemplateModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
}: SaveAsTemplateModalProps) {
  const router = useRouter();
  const { projects, fetchProjects } = useProjects();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sharingScope, setSharingScope] = useState<TemplateSharingScope>('PERSONAL');
  const [projectId, setProjectId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setName(`${campaignName} Template`);
      setDescription('');
      setSharingScope('PERSONAL');
      setProjectId('');
      setError(null);
      // Fetch projects if needed
      fetchProjects();
    }
  }, [isOpen, campaignName, fetchProjects]);

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if ((sharingScope === 'TEAM' || sharingScope === 'ORGANIZATION') && !projectId) {
      setError('Project is required for Team/Organization templates');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: SaveCampaignAsTemplateData = {
        name: name.trim(),
        description: description.trim() || undefined,
        sharing_scope: sharingScope,
        project_id: projectId ? Number(projectId) : undefined,
      };

      const response = await CampaignAPI.saveCampaignAsTemplate(campaignId, data);
      toast.success('Campaign saved as template successfully');
      onClose();
      // Navigate to template detail page
      router.push(`/campaigns/templates/${response.data.id}`);
    } catch (err: any) {
      console.error('Failed to save campaign as template:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to save campaign as template';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setName('');
      setDescription('');
      setSharingScope('PERSONAL');
      setProjectId('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Campaign as Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter template description (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            />
          </div>

          {/* Sharing Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sharing Scope <span className="text-red-500">*</span>
            </label>
            <Select
              value={sharingScope}
              onValueChange={(value) => {
                setSharingScope(value as TemplateSharingScope);
                if (value === 'PERSONAL') {
                  setProjectId('');
                }
              }}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sharing scope" />
              </SelectTrigger>
              <SelectContent>
                {sharingScopeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project (required for TEAM/ORGANIZATION) */}
          {(sharingScope === 'TEAM' || sharingScope === 'ORGANIZATION') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project <span className="text-red-500">*</span>
              </label>
              <Select value={projectId} onValueChange={setProjectId} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

