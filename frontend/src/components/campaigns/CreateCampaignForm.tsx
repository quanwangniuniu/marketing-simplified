'use client';

import { useState, useEffect, useMemo } from 'react';
import { CreateCampaignData, CampaignObjective, CampaignPlatform } from '@/types/campaign';
import { useProjects } from '@/hooks/useProjects';
import { ProjectAPI } from '@/lib/api/projectApi';
import UserPicker, { User } from '@/people/UserPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface CreateCampaignFormProps {
  formData: Partial<CreateCampaignData>;
  onFormDataChange: (data: Partial<CreateCampaignData>) => void;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: any) => void;
}

const objectiveOptions: { value: CampaignObjective; label: string }[] = [
  { value: 'AWARENESS', label: 'Awareness' },
  { value: 'CONSIDERATION', label: 'Consideration' },
  { value: 'CONVERSION', label: 'Conversion' },
  { value: 'RETENTION', label: 'Retention' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'TRAFFIC', label: 'Traffic' },
  { value: 'LEAD_GENERATION', label: 'Lead Generation' },
  { value: 'APP_PROMOTION', label: 'App Promotion' },
];

const platformOptions: { value: CampaignPlatform; label: string }[] = [
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

export default function CreateCampaignForm({
  formData,
  onFormDataChange,
  errors,
  onFieldChange,
}: CreateCampaignFormProps) {
  const { projects, loading: loadingProjects, fetchProjects } = useProjects();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch users when project is selected
  useEffect(() => {
    const fetchUsers = async () => {
      if (!selectedProjectId) {
        setUsers([]);
        return;
      }

      try {
        setLoadingUsers(true);
        const members = await ProjectAPI.getProjectMembers(Number(selectedProjectId));
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
  }, [selectedProjectId]);

  // Set project ID when formData.project_id changes
  useEffect(() => {
    if (formData.project_id) {
      setSelectedProjectId(String(formData.project_id));
    }
  }, [formData.project_id]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.isActiveResolved || p.is_active),
    [projects]
  );

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    onFieldChange('project_id', Number(projectId));
    // Clear owner when project changes
    onFieldChange('owner_id', undefined);
  };

  const handlePlatformToggle = (platform: CampaignPlatform) => {
    const currentPlatforms = formData.platforms || [];
    const newPlatforms = currentPlatforms.includes(platform)
      ? currentPlatforms.filter((p) => p !== platform)
      : [...currentPlatforms, platform];
    onFieldChange('platforms', newPlatforms);
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();
      const currentTags = formData.tags || [];
      if (!currentTags.includes(newTag)) {
        onFieldChange('tags', [...currentTags, newTag]);
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = formData.tags || [];
    onFieldChange('tags', currentTags.filter((tag) => tag !== tagToRemove));
  };

  // Get default start date (today)
  const getDefaultStartDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      {/* Campaign Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Campaign Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name || ''}
          onChange={(e) => onFieldChange('name', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          } focus:outline-none focus:ring-2 focus:ring-[#3CCED7]`}
          placeholder="Enter campaign name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Objective */}
      <div>
        <label htmlFor="objective" className="block text-sm font-medium text-gray-700 mb-1">
          Objective <span className="text-red-500">*</span>
        </label>
        <Select
          value={formData.objective || ''}
          onValueChange={(value) => onFieldChange('objective', value)}
        >
          <SelectTrigger className={errors.objective ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select objective" />
          </SelectTrigger>
          <SelectContent>
            {objectiveOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.objective && <p className="mt-1 text-sm text-red-600">{errors.objective}</p>}
      </div>

      {/* Platforms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Platforms <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {platformOptions.map((option) => {
            const isSelected = formData.platforms?.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handlePlatformToggle(option.value)}
                className={`px-3 py-1 rounded-md border text-sm transition-colors ${
                  isSelected
                    ? 'bg-[#3CCED7]/10 border-[#3CCED7] text-[#1a9ba3]'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {errors.platforms && <p className="mt-1 text-sm text-red-600">{errors.platforms}</p>}
      </div>

      {/* Project */}
      <div>
        <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
          Project <span className="text-red-500">*</span>
        </label>
        <Select
          value={formData.project_id ? String(formData.project_id) : ''}
          onValueChange={handleProjectChange}
          disabled={loadingProjects}
        >
          <SelectTrigger className={errors.project_id ? 'border-red-500' : ''}>
            <SelectValue placeholder={loadingProjects ? 'Loading projects...' : 'Select project'} />
          </SelectTrigger>
          <SelectContent>
            {activeProjects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.project_id && <p className="mt-1 text-sm text-red-600">{errors.project_id}</p>}
      </div>

      {/* Owner */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Owner <span className="text-red-500">*</span>
        </label>
        <UserPicker
          users={users}
          value={formData.owner_id || null}
          onChange={(userId) => onFieldChange('owner_id', userId ? Number(userId) : undefined)}
          placeholder="Select owner"
          disabled={!selectedProjectId || loadingUsers}
          loading={loadingUsers}
          className={errors.owner_id ? 'border-red-500' : ''}
        />
        {errors.owner_id && <p className="mt-1 text-sm text-red-600">{errors.owner_id}</p>}
        {!selectedProjectId && (
          <p className="mt-1 text-sm text-gray-500">Please select a project first</p>
        )}
      </div>

      {/* Start Date */}
      <div>
        <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
          Start Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          id="start_date"
          value={formData.start_date || getDefaultStartDate()}
          onChange={(e) => onFieldChange('start_date', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.start_date ? 'border-red-500' : 'border-gray-300'
          } focus:outline-none focus:ring-2 focus:ring-[#3CCED7]`}
        />
        {errors.start_date && <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>}
      </div>

      {/* End Date (Optional) */}
      <div>
        <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
          End Date
        </label>
        <input
          type="date"
          id="end_date"
          value={formData.end_date || ''}
          onChange={(e) => onFieldChange('end_date', e.target.value || undefined)}
          min={formData.start_date || ''}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
        />
        {errors.end_date && <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>}
      </div>

      {/* Hypothesis (Optional) */}
      <div>
        <label htmlFor="hypothesis" className="block text-sm font-medium text-gray-700 mb-1">
          Hypothesis
        </label>
        <textarea
          id="hypothesis"
          value={formData.hypothesis || ''}
          onChange={(e) => onFieldChange('hypothesis', e.target.value || undefined)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
          placeholder="Enter your campaign hypothesis"
        />
      </div>

      {/* Tags (Optional) */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <input
          type="text"
          id="tags"
          onKeyDown={handleTagInput}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
          placeholder="Type a tag and press Enter"
        />
      </div>

      {/* Budget Estimate (Optional) */}
      <div>
        <label htmlFor="budget_estimate" className="block text-sm font-medium text-gray-700 mb-1">
          Budget Estimate
        </label>
        <input
          type="number"
          id="budget_estimate"
          value={formData.budget_estimate || ''}
          onChange={(e) =>
            onFieldChange('budget_estimate', e.target.value ? Number(e.target.value) : undefined)
          }
          min="0"
          step="0.01"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

