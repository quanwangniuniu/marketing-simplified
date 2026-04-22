'use client';

import React, { useState } from 'react';
import { preferencesAPI } from '../../lib/api/preferencesApi';
import { SlackIntegration } from '../../types/preferences';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';

interface SlackRemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  integration: SlackIntegration | null;
}

export default function SlackRemoveModal({
  isOpen,
  onClose,
  onSuccess,
  integration
}: SlackRemoveModalProps) {
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!integration) return;

    setLoading(true);
    try {
      await preferencesAPI.deleteSlackIntegration();
      toast.success('Slack integration removed successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to remove Slack integration:', error);
      toast.error('Failed to remove Slack integration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing while loading
    onClose();
  };

  if (!integration) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="px-2 pt-4 pb-2">
        <h2 className="text-lg font-semibold mb-4">Remove Slack Integration</h2>
      </div>
      <div className="space-y-4">
        {/* Warning Icon and Message */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              Are you sure you want to remove this Slack integration?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              This action cannot be undone. You will stop receiving notifications in Slack until you set up a new integration.
            </p>
          </div>
        </div>

        {/* Integration Details */}
        <div className="bg-gray-50 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Integration Details:</h4>
          <dl className="space-y-1">
            {integration.channel_name && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Channel:</dt>
                <dd className="text-gray-900">{integration.channel_name}</dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Status:</dt>
              <dd className={`font-medium ${integration.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                {integration.is_active ? 'Active' : 'Inactive'}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Webhook URL:</dt>
              <dd className="text-gray-900 font-mono text-xs truncate max-w-48" title={integration.webhook_url}>
                {integration.webhook_url}
              </dd>
            </div>
          </dl>
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
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            <span>{loading ? 'Removing...' : 'Remove Integration'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
} 