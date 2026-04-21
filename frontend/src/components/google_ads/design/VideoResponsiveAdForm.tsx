'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleAd, AdVideoAsset, AdImageAsset } from '@/lib/api/googleAdsApi';
import { GoogleAdsVideoData, GoogleAdsPhotoData } from '@/lib/api/googleAdsMediaApi';
import VideoSelectionModal from '../VideoSelectionModal';

// Helper function to convert AdVideoAsset[] to GoogleAdsVideoData[]
const convertVideoAssets = (assets: AdVideoAsset[] | undefined): GoogleAdsVideoData[] => {
  if (!assets) return [];
  return assets
    .filter((asset): asset is AdVideoAsset & { id: number } => asset.id !== undefined)
    .map(asset => ({
      id: asset.id!,
      title: asset.asset || 'Video',
      video_id: asset.video_id || '',
      image_url: asset.url,
      message: undefined,
    }));
};

// Helper function to convert AdImageAsset[] to GoogleAdsPhotoData[]
const convertImageAssets = (assets: AdImageAsset[] | undefined): GoogleAdsPhotoData[] => {
  if (!assets) return [];
  return assets
    .filter((asset): asset is AdImageAsset & { id: number } => asset.id !== undefined)
    .map(asset => ({
      id: asset.id!,
      url: asset.url || asset.asset || '',
      caption: undefined,
      image_hash: undefined,
      uploaded: false,
    }));
};

interface VideoResponsiveAdFormProps {
  ad: GoogleAd;
  onUpdate: (data: any) => Promise<void>;
  saving: boolean;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  onFormDataChange?: (getFormData: () => any) => void;
}

const CALL_TO_ACTION_OPTIONS = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'DOWNLOAD',
  'BOOK_NOW',
  'CONTACT_US',
  'APPLY_NOW',
  'GET_QUOTE',
  'SUBSCRIBE',
  'NO_BUTTON'
];

export default function VideoResponsiveAdForm({ 
  ad, 
  onUpdate, 
  saving,
  onValidationChange,
  onFormDataChange
}: VideoResponsiveAdFormProps) {
  const [longHeadlines, setLongHeadlines] = useState<string[]>(['']);
  const [descriptions, setDescriptions] = useState<string[]>(['']);
  const [callToActions, setCallToActions] = useState<string[]>([]);
  const [callToActionsEnabled, setCallToActionsEnabled] = useState(false);
  const [companionBannerEnabled, setCompanionBannerEnabled] = useState(false);
  const [breadcrumb1, setBreadcrumb1] = useState('');
  const [breadcrumb2, setBreadcrumb2] = useState('');

  // Video selection state
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<GoogleAdsVideoData[]>([]);
  
  // Companion banner state (retained for data integrity but no longer user-editable)
  const [selectedCompanionBanners, setSelectedCompanionBanners] = useState<GoogleAdsPhotoData[]>([]);
  
  // Track initial load to prevent overwriting user changes
  const isInitialLoad = useRef(true);
  const hasUserSelectedMedia = useRef(false);

  // Validation functions
  const isFormValid = () => {
    const errors: string[] = [];
    
    // Check required fields
    const hasLongHeadline = longHeadlines.some(h => h.trim() !== '');
    const hasDescription = descriptions.some(d => d.trim() !== '');
    const hasVideos = selectedVideos.length > 0;
    
    if (!hasLongHeadline) {
      errors.push('long headline is required');
    }
    if (!hasDescription) {
      errors.push('description is required');
    }
    if (!hasVideos) {
      errors.push('At least 1 video is required');
    }
    
    // Check conditional fields
    if (callToActionsEnabled && callToActions.length === 0) {
      errors.push('call to action is required when enabled');
    }
    if (companionBannerEnabled && selectedCompanionBanners.length === 0) {
      errors.push('companion banner is required when enabled');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const getValidationErrors = () => {
    return isFormValid().errors;
  };

  // Sync state with ad data on initial load
  useEffect(() => {
    console.log('VideoResponsiveAdForm useEffect - ad?.id:', ad?.id, 'isInitialLoad.current:', isInitialLoad.current, 'ad?.video_responsive_ad:', ad?.video_responsive_ad);
    
    if (isInitialLoad.current && ad?.video_responsive_ad) {
      const videoAd = ad.video_responsive_ad;
      console.log('VideoResponsiveAdForm useEffect - videoAd:', videoAd);
      
      // Only update if user hasn't selected media yet
      if (!hasUserSelectedMedia.current) {
        const longHeadlinesFromAd = videoAd.long_headlines?.map(h => h.text).filter(text => text.trim() !== '') || [];
        console.log('VideoResponsiveAdForm useEffect - longHeadlinesFromAd:', longHeadlinesFromAd);
        setLongHeadlines(longHeadlinesFromAd.length > 0 ? longHeadlinesFromAd : ['']);
        
        const descriptionsFromAd = videoAd.descriptions?.map(d => d.text).filter(text => text.trim() !== '') || [];
        console.log('VideoResponsiveAdForm useEffect - descriptionsFromAd:', descriptionsFromAd);
        setDescriptions(descriptionsFromAd.length > 0 ? descriptionsFromAd : ['']);
        setCallToActions(
          videoAd.call_to_actions?.map(c => c.text).filter(text => text.trim() !== '') || []
        );
        setCallToActionsEnabled(videoAd.call_to_actions_enabled || false);
        setCompanionBannerEnabled(videoAd.companion_banner_enabled || false);
        setBreadcrumb1(videoAd.breadcrumb1 || '');
        setBreadcrumb2(videoAd.breadcrumb2 || '');
        setSelectedVideos(convertVideoAssets(videoAd.videos));
        setSelectedCompanionBanners(convertImageAssets(videoAd.companion_banners));
      }
      
      isInitialLoad.current = false;
    }
  }, [ad?.id]);

  // Reset initial load flag when ad changes
  useEffect(() => {
    isInitialLoad.current = true;
    hasUserSelectedMedia.current = false;
  }, [ad?.id]);

  // Ensure we always have at least one empty input for new ads
  useEffect(() => {
    if (!ad?.video_responsive_ad && longHeadlines.length === 0) {
      console.log('VideoResponsiveAdForm - Setting default empty longHeadlines');
      setLongHeadlines(['']);
    }
    if (!ad?.video_responsive_ad && descriptions.length === 0) {
      console.log('VideoResponsiveAdForm - Setting default empty descriptions');
      setDescriptions(['']);
    }
  }, [ad?.video_responsive_ad, longHeadlines.length, descriptions.length]);

  // Auto-update when media selections change
  useEffect(() => {
    // Only trigger update if we're not in initial load and media has been selected
    if (!isInitialLoad.current && (selectedVideos.length > 0 || selectedCompanionBanners.length > 0)) {
      handleUpdate();
    }
  }, [selectedVideos, selectedCompanionBanners]);

  // Notify parent component of validation changes
  useEffect(() => {
    if (onValidationChange) {
      const validation = isFormValid();
      onValidationChange(validation.isValid, validation.errors);
    }
  }, [longHeadlines, descriptions, selectedVideos, callToActionsEnabled, callToActions, companionBannerEnabled, selectedCompanionBanners]);

  const handleMediaContinue = (items: GoogleAdsVideoData[]) => {
    setSelectedVideos(items);
    setShowMediaModal(false);
    hasUserSelectedMedia.current = true;
    // Don't call handleUpdate here, let useEffect handle it
  };

  const handleLongHeadlineChange = (index: number, value: string) => {
    const newLongHeadlines = [...longHeadlines];
    newLongHeadlines[index] = value;
    setLongHeadlines(newLongHeadlines);
    handleUpdate(newLongHeadlines, descriptions);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    setDescriptions(newDescriptions);
    handleUpdate(longHeadlines, newDescriptions);
  };

  const handleCallToActionChange = (index: number, value: string) => {
    const newCallToActions = [...callToActions];
    newCallToActions[index] = value;
    setCallToActions(newCallToActions);
    handleUpdate(undefined, undefined, newCallToActions);
  };

  const addCallToAction = () => {
    if (callToActions.length < 1) {
      setCallToActions([...callToActions, '']);
    }
  };

  const removeCallToAction = (index: number) => {
    const newCallToActions = callToActions.filter((_, i) => i !== index);
    setCallToActions(newCallToActions);
    handleUpdate();
  };

  const handleUpdate = async (
    longHeadlinesToUse?: string[], 
    descriptionsToUse?: string[],
    callToActionsToUse?: string[],
    breadcrumb1ToUse?: string,
    breadcrumb2ToUse?: string
  ) => {
    try {
      const currentLongHeadlines = longHeadlinesToUse || longHeadlines;
      const currentDescriptions = descriptionsToUse || descriptions;
      const currentCallToActions = callToActionsToUse || callToActions;
      const currentBreadcrumb1 = breadcrumb1ToUse !== undefined ? breadcrumb1ToUse : breadcrumb1;
      const currentBreadcrumb2 = breadcrumb2ToUse !== undefined ? breadcrumb2ToUse : breadcrumb2;
      
      await onUpdate({
        video_responsive_ad_data: {
          long_headline_texts: currentLongHeadlines.length > 0 ? currentLongHeadlines : [''],
          description_texts: currentDescriptions.length > 0 ? currentDescriptions : [''],
          call_to_action_texts: currentCallToActions.length > 0 ? currentCallToActions : [''],
          call_to_actions_enabled: callToActionsEnabled,
          companion_banner_enabled: companionBannerEnabled,
          breadcrumb1: currentBreadcrumb1.trim(),
          breadcrumb2: currentBreadcrumb2.trim(),
          video_ids: selectedVideos.map(video => video.id).filter(id => id && id > 0) || [],
          companion_banner_ids: selectedCompanionBanners.map(banner => banner.id).filter(id => id && id > 0) || [],
        }
      });
    } catch (error) {
      console.error('Failed to update ad:', error);
    }
  };

  // Get current form data (for optimistic save and preview)
  const getFormData = () => {
    return {
      video_responsive_ad_data: {
        long_headline_texts: longHeadlines.length > 0 ? longHeadlines : [''],
        description_texts: descriptions.length > 0 ? descriptions : [''],
        call_to_action_texts: callToActions.length > 0 ? callToActions : [''],
        call_to_actions_enabled: callToActionsEnabled,
        companion_banner_enabled: companionBannerEnabled,
        breadcrumb1: breadcrumb1.trim(),
        breadcrumb2: breadcrumb2.trim(),
        video_ids: selectedVideos.map(video => video.id).filter(id => id && id > 0) || [],
        companion_banner_ids: selectedCompanionBanners.map(banner => banner.id).filter(id => id && id > 0) || [],
      },
      // Include full media objects for preview
      media: {
        videos: selectedVideos,
        companion_banners: selectedCompanionBanners
      }
    };
  };

  // Register form data getter with parent component
  useEffect(() => {
    if (onFormDataChange) {
      console.log('VideoResponsiveAdForm - useEffect triggered, updating formDataGetter');
      console.log('Current state - longHeadlines:', longHeadlines, 'descriptions:', descriptions);
      onFormDataChange(() => getFormData());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [longHeadlines, descriptions, callToActions, breadcrumb1, breadcrumb2, selectedVideos, selectedCompanionBanners, callToActionsEnabled, companionBannerEnabled]);

  const getCharacterCountColor = (count: number, max: number) => {
    if (count > max) return 'text-red-500';
    if (count > max * 0.9) return 'text-yellow-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Long Headlines */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Long Headlines <span className="text-red-500">*</span>
          </h3>
          <div className="text-sm text-gray-500">
            {longHeadlines.filter(h => h.trim() !== '').length}/1 headlines
          </div>
        </div>
        <div className="space-y-3">
          {longHeadlines.map((headline, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => handleLongHeadlineChange(index, e.target.value)}
                  placeholder="Long headline"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                  maxLength={90}
                />
                <div className={`text-xs mt-1 ${getCharacterCountColor(headline.length, 90)}`}>
                  {headline.length}/90 characters
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Add 1 long headline for your video ad.
        </p>
      </div>

      {/* Descriptions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Descriptions <span className="text-red-500">*</span>
          </h3>
          <div className="text-sm text-gray-500">
            {descriptions.filter(d => d.trim() !== '').length}/1 descriptions
          </div>
        </div>
        <div className="space-y-3">
          {descriptions.map((description, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <textarea
                  value={description}
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  placeholder="Description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] resize-none"
                  maxLength={90}
                />
                <div className={`text-xs mt-1 ${getCharacterCountColor(description.length, 90)}`}>
                  {description.length}/90 characters
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Add 1 description for your video ad.
        </p>
      </div>

      {/* Call to Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Call to Actions {callToActionsEnabled && <span className="text-red-500">*</span>}
          </h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={callToActionsEnabled}
              onChange={(e) => {
                setCallToActionsEnabled(e.target.checked);
                handleUpdate();
              }}
              className="rounded border-gray-300 text-[#3CCED7] shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700">Enable call to action</span>
          </label>
        </div>
        
        {callToActionsEnabled && (
          <div className="space-y-3">
            {callToActions.map((cta, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={cta}
                    onChange={(e) => handleCallToActionChange(index, e.target.value)}
                    placeholder="Call to action text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                    maxLength={10}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <div className={`text-xs ${getCharacterCountColor(cta.length, 10)}`}>
                      {cta.length}/10 characters
                    </div>
                    <button
                      onClick={() => removeCallToAction(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {callToActions.length < 1 && (
              <button
                onClick={addCallToAction}
                className="text-[#3CCED7] hover:text-[#1a9ba3] text-sm font-medium"
              >
                + Add Call to Action
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Add a call to action button to your video ad.
        </p>
      </div>

      {/* Breadcrumbs */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Breadcrumbs (Optional)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Breadcrumb 1
            </label>
            <input
              type="text"
              value={breadcrumb1}
              onChange={(e) => {
                const newValue = e.target.value;
                setBreadcrumb1(newValue);
                handleUpdate(undefined, undefined, undefined, newValue);
              }}
              placeholder="e.g., Home"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              maxLength={15}
            />
            <div className={`text-xs mt-1 ${getCharacterCountColor(breadcrumb1.length, 15)}`}>
              {breadcrumb1.length}/15 characters
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Breadcrumb 2
            </label>
            <input
              type="text"
              value={breadcrumb2}
              onChange={(e) => {
                const newValue = e.target.value;
                setBreadcrumb2(newValue);
                handleUpdate(undefined, undefined, undefined, undefined, newValue);
              }}
              placeholder="e.g., Products"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              maxLength={15}
            />
            <div className={`text-xs mt-1 ${getCharacterCountColor(breadcrumb2.length, 15)}`}>
              {breadcrumb2.length}/15 characters
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Breadcrumbs appear in your ad's URL path.
        </p>
      </div>

      {/* Videos Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Videos <span className="text-red-500">*</span>
        </h3>
        <div className="mb-4">
          <button 
            onClick={() => setShowMediaModal(true)}
            className="btn btn-secondary mb-2"
          >
            + video
          </button>
          <p className="text-xs text-gray-400">Enter YouTube URL only</p>
          
          {/* show selected videos */}
          {selectedVideos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {selectedVideos.map(video => (
                <div key={video.id} className="relative">
                  <img 
                    src={video.image_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                    alt={video.title || `Video ${video.id}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <button
                    onClick={() => {
                      setSelectedVideos(prev => prev.filter(v => v.id !== video.id));
                      handleUpdate();
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Upload 1-5 videos for your video responsive ad
        </p>
      </div>

      {/* Video Selection Modal */}
      <VideoSelectionModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onContinue={handleMediaContinue}
        maxSelection={5}
        selectedMediaIds={selectedVideos.map(video => video.id)}
      />
    </div>
  );
}
