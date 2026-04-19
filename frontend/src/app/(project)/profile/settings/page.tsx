'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { usePreferences } from '@/hooks/usePreferences';
import { PreferencesFormData, LanguageOption, TimezoneOption } from '@/types/preferences';
import Toggle from '@/components/ui/Toggle';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SlackWebhookModal from '@/components/ui/SlackWebhookModal';
import SlackRemoveModal from '@/components/ui/SlackRemoveModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Language options
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-hans', label: '简体中文' },
  { value: 'zh-hant', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko-kr', label: '한국어' },
];

// Timezone options (commonly used timezones)
const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

// Main settings page content component
function SettingsPageContent() {
  const router = useRouter();
  const { 
    formData, 
    loading, 
    saving, 
    updatePreferences,
    slackIntegration,
    slackLoading,
    toggleSlackIntegration,
    hasSlackIntegration,
    isSlackActive
  } = usePreferences();
  
  const [localFormData, setLocalFormData] = useState<PreferencesFormData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Slack modal states
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [showSlackRemoveModal, setShowSlackRemoveModal] = useState(false);

  // Initialize local form data when preferences are loaded
  useEffect(() => {
    if (formData && !localFormData) {
      setLocalFormData(formData);
    }
  }, [formData, localFormData]);

  // Check if form has changes
  useEffect(() => {
    if (formData && localFormData) {
      const hasChanges = (
        formData.language !== localFormData.language ||
        formData.timezone !== localFormData.timezone ||
        formData.slack_enabled !== localFormData.slack_enabled
      );
      setHasChanges(hasChanges);
    }
  }, [formData, localFormData]);

  const handleFormChange = (field: keyof PreferencesFormData, value: any) => {
    if (localFormData) {
      setLocalFormData(prev => ({
        ...prev!,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localFormData) {
      const result = await updatePreferences(localFormData);
      if (result.success) {
        setHasChanges(false);
      }
    }
  };

  const handleReset = () => {
    if (formData) {
      setLocalFormData(formData);
      setHasChanges(false);
    }
  };

  // Slack handlers
  const handleSlackToggle = async (checked: boolean) => {
    if (!hasSlackIntegration && checked) {
      setShowSlackModal(true);
    } else if (hasSlackIntegration) {
      const result = await toggleSlackIntegration();
      if (result.success) {
        handleFormChange('slack_enabled', checked);
      }
    }
  };

  const handleAddSlack = () => {
    setShowSlackModal(true);
  };

  const handleEditSlack = () => {
    setShowSlackModal(true);
  };

  const handleRemoveSlack = () => {
    setShowSlackRemoveModal(true);
  };

  const handleSlackModalSuccess = () => {
    if (localFormData) {
      setLocalFormData(prev => ({
        ...prev!,
        slack_enabled: true
      }));
    }
  };

  const handleSlackRemoveSuccess = () => {
    if (localFormData) {
      setLocalFormData(prev => ({
        ...prev!,
        slack_enabled: false
      }));
    }
  };

  const handleBackToCampaigns = () => {
    router.push('/campaigns');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!localFormData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Unable to load preferences
          </h2>
          <p className="text-gray-500">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Navigation */}
      <div className="mb-6">
        <button
          onClick={handleBackToCampaigns}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span className="text-sm font-medium">Back to Campaigns</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your language, timezone, and Slack notification preferences
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Language and Timezone Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                id="language"
                value={localFormData.language || ''}
                onChange={(e) => handleFormChange('language', e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select language</option>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={localFormData.timezone || ''}
                onChange={(e) => handleFormChange('timezone', e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select timezone</option>
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Slack Integration Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Slack Integration
            </h3>
            <div className="border border-gray-200 rounded-md">
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Toggle
                        id="slack_enabled"
                        label="Slack Notifications"
                        description={
                          hasSlackIntegration 
                            ? `Connected to ${slackIntegration?.channel_name || 'Slack'}`
                            : "Set up Slack integration to receive notifications"
                        }
                        checked={localFormData.slack_enabled && hasSlackIntegration}
                        onChange={handleSlackToggle}
                        disabled={saving || slackLoading}
                      />
                      {slackLoading && <LoadingSpinner size="sm" />}
                    </div>
                    
                    {hasSlackIntegration && (
                      <div className="mt-2 text-sm">
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isSlackActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isSlackActive ? 'Active' : 'Inactive'}
                          </span>
                          {slackIntegration?.channel_name && (
                            <span className="text-gray-500">
                              Channel: {slackIntegration.channel_name}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {hasSlackIntegration ? (
                      <>
                        <button
                          type="button"
                          onClick={handleEditSlack}
                          disabled={slackLoading}
                          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveSlack}
                          disabled={slackLoading}
                          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAddSlack}
                        disabled={slackLoading}
                        className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        Set up
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving && <LoadingSpinner size="sm" />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      <SlackWebhookModal
        isOpen={showSlackModal}
        onClose={() => setShowSlackModal(false)}
        onSuccess={handleSlackModalSuccess}
        existingIntegration={slackIntegration}
      />

      <SlackRemoveModal
        isOpen={showSlackRemoveModal}
        onClose={() => setShowSlackRemoveModal(false)}
        onSuccess={handleSlackRemoveSuccess}
        integration={slackIntegration}
      />
    </div>
  );
}

// Export the page with route protection
export default function SettingsPage() {
  return (
    <ProtectedRoute >
      <SettingsPageContent />
    </ProtectedRoute>
  );
}