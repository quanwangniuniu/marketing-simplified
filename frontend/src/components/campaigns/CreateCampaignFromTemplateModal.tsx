'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { CampaignTemplate, CreateCampaignFromTemplateData, CampaignObjective, CampaignPlatform } from '@/types/campaign';
import { useProjects } from '@/hooks/useProjects';
import { ProjectAPI } from '@/lib/api/projectApi';
import UserPicker, { User } from '@/people/UserPicker';
import Button from '@/components/button/Button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface CreateCampaignFromTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: CampaignTemplate | null; // Optional - if not provided, user selects from list
}

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

export default function CreateCampaignFromTemplateModal({
  isOpen,
  onClose,
  template: providedTemplate,
}: CreateCampaignFromTemplateModalProps) {
  const router = useRouter();
  const { projects, fetchProjects } = useProjects();
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(providedTemplate || null);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string | number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [objective, setObjective] = useState<CampaignObjective | undefined>();
  const [platforms, setPlatforms] = useState<CampaignPlatform[]>([]);
  const [hypothesis, setHypothesis] = useState('');
  const [budgetEstimate, setBudgetEstimate] = useState<number | undefined>();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates if not provided
  useEffect(() => {
    if (isOpen && !providedTemplate) {
      const fetchTemplates = async () => {
        try {
          setLoadingTemplates(true);
          const response = await CampaignAPI.getTemplates();
          // Handle both array response and paginated response with results
          const templatesList = Array.isArray(response.data)
            ? response.data
            : (response.data as any)?.results || response.data || [];
          setTemplates(templatesList);
        } catch (err) {
          console.error('Failed to fetch templates:', err);
        } finally {
          setLoadingTemplates(false);
        }
      };
      fetchTemplates();
    }
  }, [isOpen, providedTemplate]);

  // Update form when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setName(`${selectedTemplate.name} Campaign`);
      setObjective(selectedTemplate.objective);
      setPlatforms(selectedTemplate.platforms || []);
      setHypothesis(selectedTemplate.hypothesis_framework || '');
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      // Reset form
      if (providedTemplate) {
        setSelectedTemplate(providedTemplate);
        setName(`${providedTemplate.name} Campaign`);
        setObjective(providedTemplate.objective);
        setPlatforms(providedTemplate.platforms || []);
        setHypothesis(providedTemplate.hypothesis_framework || '');
      } else {
        setSelectedTemplate(null);
        setName('');
        setObjective(undefined);
        setPlatforms([]);
        setHypothesis('');
      }
      setProjectId('');
      setOwnerId(null);
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate('');
      setBudgetEstimate(undefined);
      setError(null);
    }
  }, [isOpen, providedTemplate, fetchProjects]);

  // Fetch users when project is selected
  useEffect(() => {
    const fetchUsers = async () => {
      if (!projectId) {
        setUsers([]);
        setOwnerId(null);
        return;
      }

      try {
        setLoadingUsers(true);
        const members = await ProjectAPI.getProjectMembers(Number(projectId));
        const userList: User[] = members.map((member) => ({
          id: member.user.id,
          name: member.user.username || member.user.email || 'Unknown',
          email: member.user.email || '',
        }));
        setUsers(userList);
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [projectId]);

  const handlePlatformToggle = (platform: CampaignPlatform) => {
    setPlatforms((prev) => {
      if (prev.includes(platform)) {
        return prev.filter((p) => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    if (!projectId) {
      setError('Project is required');
      return;
    }

    if (!ownerId) {
      setError('Owner is required');
      return;
    }

    if (!startDate) {
      setError('Start date is required');
      return;
    }

    if (platforms.length === 0) {
      setError('At least one platform must be selected');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: CreateCampaignFromTemplateData = {
        name: name.trim(),
        project: Number(projectId),
        owner: Number(ownerId),
        start_date: startDate,
        end_date: endDate || undefined,
        objective: objective,
        platforms: platforms,
        hypothesis: hypothesis.trim() || undefined,
        budget_estimate: budgetEstimate,
      };

      if (!selectedTemplate) {
        setError('Please select a template');
        return;
      }

      const response = await CampaignAPI.createCampaignFromTemplate(selectedTemplate.id, data);
      toast.success('Campaign created successfully');
      onClose();
      // Navigate to new campaign detail page
      router.push(`/campaigns/${response.data.id}`);
    } catch (err: any) {
      console.error('Failed to create campaign from template:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to create campaign from template';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setName('');
      setSelectedTemplate(providedTemplate || null);
      setProjectId('');
      setOwnerId(null);
      setStartDate('');
      setEndDate('');
      setObjective(providedTemplate?.objective);
      setPlatforms(providedTemplate?.platforms || []);
      setHypothesis(providedTemplate?.hypothesis_framework || '');
      setBudgetEstimate(undefined);
      setError(null);
      onClose();
    }
  };

  const activeProjects = projects.filter((p) => p.isActiveResolved || p.is_active);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Campaign from Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection (if not provided) */}
          {!providedTemplate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const template = templates.find((t) => t.id === e.target.value);
                  setSelectedTemplate(template || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                disabled={submitting || loadingTemplates}
              >
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.is_archived && '(Archived)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Template Info (if provided or selected) */}
          {selectedTemplate && (
            <div className="bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-md p-3">
              <p className="text-sm font-medium text-[#0f757a] mb-1">Template: {selectedTemplate.name}</p>
              {selectedTemplate.description && (
                <p className="text-xs text-[#1a9ba3]">{selectedTemplate.description}</p>
              )}
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter campaign name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setOwnerId(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            >
              <option value="">Select a project</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner <span className="text-red-500">*</span>
            </label>
            <UserPicker
              users={users}
              value={ownerId}
              onChange={setOwnerId}
              placeholder={loadingUsers ? 'Loading users...' : projectId ? 'Select owner' : 'Select a project first'}
              disabled={submitting || !projectId || loadingUsers}
              loading={loadingUsers}
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            />
          </div>

          {/* Objective */}
          {selectedTemplate?.objective && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Objective</label>
              <select
                value={objective || ''}
                onChange={(e) => setObjective(e.target.value as CampaignObjective)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                disabled={submitting}
              >
                <option value="">Select objective</option>
                {Object.entries(objectiveLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Platforms */}
          {selectedTemplate?.platforms && selectedTemplate.platforms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platforms <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(platformLabels).map(([value, label]) => {
                  const isSelected = platforms.includes(value as CampaignPlatform);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handlePlatformToggle(value as CampaignPlatform)}
                      disabled={submitting}
                      className={`px-3 py-1 rounded-md border text-sm transition-colors ${
                        isSelected
                          ? 'bg-[#3CCED7]/10 border-[#3CCED7] text-[#1a9ba3]'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hypothesis */}
          {selectedTemplate?.hypothesis_framework && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hypothesis</label>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="Enter hypothesis"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                disabled={submitting}
              />
            </div>
          )}

          {/* Budget Estimate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Budget Estimate</label>
            <input
              type="number"
              value={budgetEstimate || ''}
              onChange={(e) => setBudgetEstimate(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Enter budget estimate"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              disabled={submitting}
            />
          </div>

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
            {submitting ? 'Creating...' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

