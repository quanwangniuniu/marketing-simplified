'use client';

import React, { useState, useEffect } from 'react';
import { GoogleAd, AdCreateRequest, AdType } from '@/lib/api/googleAdsApi';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdCreateRequest) => Promise<GoogleAd>;
  submitting: boolean;
  mode?: 'create' | 'update';
  ad?: GoogleAd | null;
  existingAds?: GoogleAd[]; // For name uniqueness validation
}

const AdModal: React.FC<AdModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  mode = 'create',
  ad,
  existingAds = [],
}) => {
  const [formData, setFormData] = useState<Partial<AdCreateRequest>>({
    name: '',
    type: 'RESPONSIVE_SEARCH_AD',
    status: 'DRAFT',
    customer_account_id: 1, // This should be set based on selected account
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'update' && ad) {
        setFormData({
          name: ad.name || '',
          type: ad.type || 'RESPONSIVE_SEARCH_AD',
          status: ad.status || 'DRAFT',
          customer_account_id: ad.customer_account?.id || 1,
        });
      } else {
        setFormData({
          name: '',
          type: 'RESPONSIVE_SEARCH_AD',
          status: 'DRAFT',
          customer_account_id: 1,
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, ad]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    } else if (mode === 'create') {
      // Check for duplicate names (only in create mode)
      const duplicateAd = existingAds.find(
        ad => ad.name?.toLowerCase() === formData.name?.toLowerCase().trim()
      );
      if (duplicateAd) {
        newErrors.name = 'An ad with this name already exists';
      }
    } else if (mode === 'update' && ad) {
      // In update mode, check if the new name conflicts with other ads (excluding current ad)
      const duplicateAd = existingAds.find(
        existingAd => 
          existingAd.id !== ad.id && 
          existingAd.name?.toLowerCase() === formData.name?.toLowerCase().trim()
      );
      if (duplicateAd) {
        newErrors.name = 'An ad with this name already exists';
      }
    }

    if (!formData.type) {
      newErrors.type = 'Ad type is required';
    }

    // Validate Final URLs
    if (!formData.final_urls || formData.final_urls.length === 0) {
      newErrors.final_urls = 'At least one Final URL is required';
    } else {
      // Validate URL format
      const urlRegex = /^https?:\/\/.+/;
      const invalidUrls = formData.final_urls.filter(url => !urlRegex.test(url));
      if (invalidUrls.length > 0) {
        newErrors.final_urls = 'Please enter valid URLs (starting with http:// or https://)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData: AdCreateRequest = {
      name: formData.name!,
      type: formData.type!,
      status: formData.status || 'DRAFT',
      final_urls: formData.final_urls!,
    };

    try {
      await onSubmit(submitData);
    } catch (error) {
      console.error('Failed to submit ad:', error);
    }
  };

  const handleClose = () => {
    // Only close if no required fields are filled or if user confirms
    const hasRequiredData = formData.name?.trim();
    
    if (hasRequiredData) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) return;
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {mode === 'create' ? 'Create New Ad' : 'Edit Ad'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Ad Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] sm:text-sm ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter ad name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Ad Type Field */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Ad Type
              </label>
              <select
                id="type"
                value={formData.type || ''}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AdType })}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] sm:text-sm ${
                  errors.type ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="RESPONSIVE_SEARCH_AD">Responsive Search Ad</option>
                <option value="RESPONSIVE_DISPLAY_AD">Responsive Display Ad</option>
                <option value="VIDEO_RESPONSIVE_AD">Video Responsive Ad</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type}</p>
              )}
            </div>

            {/* Status Field (only for update mode) */}
            {mode === 'update' && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status || 'DRAFT'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] sm:text-sm"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            )}

            {/* Final URLs Field */}
            <div>
              <label htmlFor="final_urls" className="block text-sm font-medium text-gray-700">
                Final URLs
              </label>
              <input
                type="url"
                id="final_urls"
                value={formData.final_urls?.join(', ') || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  final_urls: e.target.value.split(',').map(url => url.trim()).filter(url => url)
                })}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] sm:text-sm ${
                  errors.final_urls ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="https://example.com/page"
                required
              />
              {errors.final_urls && (
                <p className="mt-1 text-sm text-red-600">{errors.final_urls}</p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3CCED7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] border border-transparent rounded-md hover:bg-[#2AB5BD] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3CCED7] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : mode === 'create' ? 'Next' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdModal;
