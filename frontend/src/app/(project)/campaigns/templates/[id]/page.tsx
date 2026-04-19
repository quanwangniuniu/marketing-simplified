'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CampaignObjective, CampaignPlatform, CampaignTemplate, UpdateTemplateData } from '@/types/campaign';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { Badge } from '@/components/ui/badge';
import InlineEditController from '@/inline-edit/InlineEditController';
import InlineSelectController from '@/inline-edit/InlineSelectController';
import InlineMultiSelectController from '@/inline-edit/InlineMultiSelectController';
import UserAvatar from '@/people/UserAvatar';
import Button from '@/components/button/Button';
import { ArrowLeft, User, FolderOpen, Trash2, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import CreateCampaignFromTemplateModal from '@/components/campaigns/CreateCampaignFromTemplateModal';

const objectiveLabels: Record<string, string> = {
  AWARENESS: 'Awareness',
  CONSIDERATION: 'Consideration',
  CONVERSION: 'Conversion',
  RETENTION: 'Retention',
  ENGAGEMENT: 'Engagement',
  TRAFFIC: 'Traffic',
  LEAD_GENERATION: 'Lead Gen',
  APP_PROMOTION: 'App Promotion',
};

const objectiveOptions: Array<{ value: CampaignObjective; label: string }> = [
  { value: 'AWARENESS', label: 'Awareness' },
  { value: 'CONSIDERATION', label: 'Consideration' },
  { value: 'CONVERSION', label: 'Conversion' },
  { value: 'RETENTION', label: 'Retention' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'TRAFFIC', label: 'Traffic' },
  { value: 'LEAD_GENERATION', label: 'Lead Gen' },
  { value: 'APP_PROMOTION', label: 'App Promotion' },
];

const platformLabels: Record<string, string> = {
  META: 'Meta',
  GOOGLE_ADS: 'Google Ads',
  TIKTOK: 'TikTok',
  LINKEDIN: 'LinkedIn',
  SNAPCHAT: 'Snapchat',
  TWITTER: 'Twitter',
  PINTEREST: 'Pinterest',
  REDDIT: 'Reddit',
  PROGRAMMATIC: 'Programmatic',
  EMAIL: 'Email',
};

const platformOptions: Array<{ value: CampaignPlatform; label: string }> = [
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

const sharingScopeLabels: Record<string, string> = {
  PERSONAL: 'Personal',
  TEAM: 'Team',
  ORGANIZATION: 'Organization',
};

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;
  const [template, setTemplate] = useState<CampaignTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [createCampaignModalOpen, setCreateCampaignModalOpen] = useState(false);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await CampaignAPI.getTemplate(templateId);
      setTemplate(response.data);
    } catch (err: any) {
      console.error('Failed to fetch template:', err);
      setError(err);
      toast.error('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: UpdateTemplateData) => {
    if (!templateId) return;
    
    try {
      const response = await CampaignAPI.updateTemplate(templateId, data);
      setTemplate(response.data);
      toast.success('Template updated successfully');
    } catch (err: any) {
      console.error('Failed to update template:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update template';
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!templateId || !template) return;
    
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await CampaignAPI.deleteTemplate(templateId);
      toast.success('Template deleted successfully');
      router.push('/campaigns/templates');
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete template';
      toast.error(errorMessage);
    }
  };

  const handleBack = () => {
    router.push('/campaigns/templates');
  };

  const handleNameSave = async (newName: string) => {
    if (newName.trim() === template?.name) {
      return;
    }
    await handleUpdate({ name: newName.trim() });
  };

  const handleDescriptionSave = async (newDescription: string) => {
    const trimmedDescription = newDescription.trim() || undefined;
    if (trimmedDescription === template?.description) {
      return;
    }
    await handleUpdate({ description: trimmedDescription });
  };

  const handleObjectiveSave = async (newObjective: CampaignObjective) => {
    if (newObjective === template?.objective) {
      return;
    }
    await handleUpdate({ objective: newObjective });
  };

  const handlePlatformsSave = async (newPlatforms: CampaignPlatform[]) => {
    if (JSON.stringify(newPlatforms.sort()) === JSON.stringify((template?.platforms || []).sort())) {
      return;
    }
    await handleUpdate({ platforms: newPlatforms });
  };

  const handleHypothesisSave = async (newHypothesis: string) => {
    const trimmedHypothesis = newHypothesis.trim() || undefined;
    if (trimmedHypothesis === template?.hypothesis_framework) {
      return;
    }
    await handleUpdate({ hypothesis_framework: trimmedHypothesis });
  };

  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Template name is required';
    }
    if (value.trim().length < 3) {
      return 'Template name must be at least 3 characters';
    }
    return null;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading template...</span>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error || !template) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">Failed to load template. Please try again.</p>
              <Button onClick={handleBack} variant="secondary" className="mt-4">
                Back to Templates
              </Button>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const creatorName = template.creator?.username || template.creator?.email || 'Unknown';
  const creatorDisplay = {
    name: creatorName,
    email: template.creator?.email,
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          {/* Back Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back to Templates
          </Button>

          {/* Template Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            {/* Template Name with Inline Editing */}
            <div className="mb-4">
              <InlineEditController
                value={template.name}
                onSave={handleNameSave}
                validate={validateName}
                inputType="input"
                className="text-2xl font-bold text-gray-900"
                renderTrigger={(value) => (
                  <h1 className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer">
                    {value}
                  </h1>
                )}
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-500 mb-1">Description:</p>
              <InlineEditController
                value={template.description || ''}
                onSave={handleDescriptionSave}
                inputType="textarea"
                placeholder="Add a description for this template..."
                className="text-sm text-gray-700"
                renderTrigger={(value) => (
                  <p className="text-sm text-gray-700 hover:text-blue-600 transition-colors cursor-pointer min-h-[1.5rem]">
                    {value || <span className="text-gray-400 italic">Add a description for this template...</span>}
                  </p>
                )}
              />
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Sharing Scope */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Sharing Scope:</span>
                <Badge variant="outline" className="text-xs">
                  {template.sharing_scope_display}
                </Badge>
              </div>

              {/* Creator */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Creator:</span>
                <div className="flex items-center gap-2">
                  <UserAvatar user={creatorDisplay} size="sm" />
                  <span className="text-sm text-gray-900">{creatorName}</span>
                </div>
              </div>

              {/* Project */}
              {template.project && (
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Project:</span>
                  <span className="text-sm text-gray-900">{template.project.name}</span>
                </div>
              )}

              {/* Usage Count */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Usage Count:</span>
                <span className="text-sm text-gray-900">{template.usage_count}</span>
              </div>

              {/* Version */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Version:</span>
                <span className="text-sm text-gray-900">v{template.version_number}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateCampaignModalOpen(true)}
                leftIcon={<Play className="h-4 w-4" />}
              >
                Create Campaign
              </Button>
              {!template.is_archived && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDelete}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Template Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Configuration</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Objective */}
              {template.objective && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Objective:</label>
                  <InlineSelectController
                    value={template.objective}
                    options={objectiveOptions}
                    onSave={handleObjectiveSave}
                    className="text-sm text-gray-900"
                  />
                </div>
              )}

              {/* Platforms */}
              {template.platforms && template.platforms.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Platforms:</label>
                  <InlineMultiSelectController
                    value={template.platforms}
                    options={platformOptions}
                    onSave={handlePlatformsSave}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Hypothesis Framework */}
              {template.hypothesis_framework && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Hypothesis Framework:</label>
                  <InlineEditController
                    value={template.hypothesis_framework}
                    onSave={handleHypothesisSave}
                    inputType="textarea"
                    placeholder="Add hypothesis framework..."
                    className="text-sm text-gray-700"
                    renderTrigger={(value) => (
                      <p className="text-sm text-gray-700 hover:text-blue-600 transition-colors cursor-pointer min-h-[1.5rem]">
                        {value}
                      </p>
                    )}
                  />
                </div>
              )}

              {/* Tag Suggestions */}
              {template.tag_suggestions && template.tag_suggestions.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Tag Suggestions:</label>
                  <div className="flex flex-wrap gap-1">
                    {template.tag_suggestions.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Variation Count */}
              {template.recommended_variation_count && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Recommended Variations:</label>
                  <span className="text-sm text-gray-900">{template.recommended_variation_count}</span>
                </div>
              )}
            </div>
          </div>

          {/* Create Campaign Modal */}
          {createCampaignModalOpen && (
            <CreateCampaignFromTemplateModal
              isOpen={createCampaignModalOpen}
              onClose={() => setCreateCampaignModalOpen(false)}
              template={template}
            />
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

