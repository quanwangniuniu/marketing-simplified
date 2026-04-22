'use client';

import React, { useState } from 'react';
import { preferencesAPI } from '../../lib/api/preferencesApi';
import { SlackIntegration, SlackIntegrationCreate } from '../../types/preferences';
import Modal from './Modal';
import FormInput from '../form/FormInput';
import FormButton from '../form/FormButton';
import ErrorMessage from '../form/ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';

interface SlackWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (integration: SlackIntegration) => void;
  existingIntegration?: SlackIntegration | null;
}

export default function SlackWebhookModal({
  isOpen,
  onClose,
  onSuccess,
  existingIntegration
}: SlackWebhookModalProps) {
  const [formData, setFormData] = useState<SlackIntegrationCreate>({
    webhook_url: existingIntegration?.webhook_url || '',
    channel_name: existingIntegration?.channel_name || '',
    is_active: existingIntegration?.is_active ?? true
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate webhook URL
    if (!formData.webhook_url.trim()) {
      newErrors.webhook_url = 'Webhook URL is required';
    } else if (!preferencesAPI.validateSlackWebhookUrl(formData.webhook_url)) {
      newErrors.webhook_url = 'Invalid Slack webhook URL format. Must be https://hooks.slack.com/services/XXX/YYY/ZZZ';
    }

    // Validate channel name (optional but if provided, should not be empty)
    if (formData.channel_name && !formData.channel_name.trim()) {
      newErrors.channel_name = 'Channel name cannot be empty if provided';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const cleanedData = {
        webhook_url: formData.webhook_url.trim(),
        channel_name: formData.channel_name?.trim() || undefined,
        is_active: formData.is_active
      };

      const result = await preferencesAPI.createOrUpdateSlackIntegration(cleanedData);
      
      toast.success(existingIntegration ? 'Slack integration updated!' : 'Slack integration added!');
      onSuccess(result);
      onClose();
      
      // Reset form
      setFormData({
        webhook_url: '',
        channel_name: '',
        is_active: true
      });
      setErrors({});
    } catch (error: any) {
      console.error('Failed to save Slack integration:', error);
      
      // Handle validation errors from backend
      if (error.response?.data?.webhook_url) {
        setErrors({ webhook_url: error.response.data.webhook_url.join(', ') });
      } else {
        toast.error('Failed to save Slack integration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SlackIntegrationCreate, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing while loading
    
    setFormData({
      webhook_url: existingIntegration?.webhook_url || '',
      channel_name: existingIntegration?.channel_name || '',
      is_active: existingIntegration?.is_active ?? true
    });
    setErrors({});
    onClose();
  };

  const isEditing = !!existingIntegration;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="px-2 pt-4 pb-2">
        <h2 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Slack Integration' : 'Add Slack Integration'}</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Instructions */}
        <div className="bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-[#3CCED7]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-[#1a9ba3]">How to get your Slack webhook URL:</h3>
              <div className="mt-2 text-sm text-[#1a9ba3]">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to your Slack workspace settings</li>
                  <li>Navigate to "Apps" → "Incoming Webhooks"</li>
                  <li>Create a new webhook or copy an existing one</li>
                  <li>Paste the URL below</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Webhook URL */}
        <div>
          <FormInput
            name="webhook_url"
            type="url"
            label="Slack Webhook URL"
            value={formData.webhook_url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('webhook_url', e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            required
            error={errors.webhook_url}
          />
          {errors.webhook_url && <ErrorMessage message={errors.webhook_url} />}
        </div>

        {/* Channel Name */}
        <div>
          <FormInput
            name="channel_name"
            type="text"
            label="Channel Name (Optional)"
            value={formData.channel_name || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('channel_name', e.target.value)}
            placeholder="e.g., #general, Marketing Team"
            error={errors.channel_name}
          />
          <p className="mt-1 text-sm text-gray-500">
            Friendly name to help you identify this integration
          </p>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            id="is_active"
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => handleInputChange('is_active', e.target.checked)}
            disabled={loading}
            className="h-4 w-4 text-[#3CCED7] focus:ring-[#3CCED7] border-gray-300 rounded disabled:opacity-50"
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
            Enable notifications immediately
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <FormButton
            type="submit"
            onClick={undefined}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] border border-transparent rounded-md shadow-sm hover:bg-[#2AB5BD] focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            <span>{loading ? 'Saving...' : (isEditing ? 'Update Integration' : 'Add Integration')}</span>
          </FormButton>
        </div>
      </form>
    </Modal>
  );
} 