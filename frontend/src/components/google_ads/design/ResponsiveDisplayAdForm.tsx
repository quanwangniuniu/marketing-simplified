'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleAd, AdImageAsset, AdVideoAsset } from '@/lib/api/googleAdsApi';
import { GoogleAdsPhotoData, GoogleAdsVideoData } from '@/lib/api/googleAdsMediaApi';
import MediaSelectionModal from '../MediaSelectionModal';
import LogoSelectionModal from '../LogoSelectionModal';
import VideoSelectionModal from '../VideoSelectionModal';
import PhotoCard from '../PhotoCard';
import VideoCard from '../VideoCard';

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

interface ResponsiveDisplayAdFormProps {
  ad: GoogleAd;
  onUpdate: (data: any) => Promise<void>;
  saving: boolean;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  onFormDataChange?: (getFormData: () => any) => void; // For optimistic save
}

const CALL_TO_ACTION_OPTIONS = [
  'APPLY_NOW',
  'BOOK_NOW',
  'CONTACT_US',
  'DOWNLOAD',
  'LEARN_MORE',
  'VISIT_SITE',
  'SHOP_NOW',
  'GET_QUOTE',
  'SUBSCRIBE',
  'SEE_MORE',
];

export default function ResponsiveDisplayAdForm({ 
  ad, 
  onUpdate, 
  saving,
  onValidationChange,
  onFormDataChange
}: ResponsiveDisplayAdFormProps) {
  const isInitialLoad = useRef(true);
  
  const [businessName, setBusinessName] = useState(
    ad.responsive_display_ad?.business_name || ''
  );
  const [longHeadline, setLongHeadline] = useState(
    ad.responsive_display_ad?.long_headline?.text || ''
  );
  const [headlines, setHeadlines] = useState<string[]>(() => {
    const adHeadlines = ad.responsive_display_ad?.headlines?.map(h => h.text) || [];
    // Filter out empty strings and ensure at least one empty field for new ads
    const filteredHeadlines = adHeadlines.filter(h => h.trim() !== '');
    return filteredHeadlines.length > 0 ? filteredHeadlines : [''];
  });
  const [descriptions, setDescriptions] = useState<string[]>(() => {
    const adDescriptions = ad.responsive_display_ad?.descriptions?.map(d => d.text) || [];
    // Filter out empty strings and ensure at least one empty field for new ads
    const filteredDescriptions = adDescriptions.filter(d => d.trim() !== '');
    return filteredDescriptions.length > 0 ? filteredDescriptions : [''];
  });
  const [callToActionText, setCallToActionText] = useState(
    ad.responsive_display_ad?.call_to_action_text || ''
  );
  const [mainColor, setMainColor] = useState(
    ad.responsive_display_ad?.main_color || '#1a73e8'
  );
  const [accentColor, setAccentColor] = useState(
    ad.responsive_display_ad?.accent_color || '#ffffff'
  );

  // Media selection state
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaModalType, setMediaModalType] = useState<'image' | 'video'>('image');
  const [mediaModalTarget, setMediaModalTarget] = useState<'marketing' | 'square' | 'logo' | 'square_logo' | 'video' | 'both'>('marketing');
  
  // Logo selection state
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [logoModalTarget, setLogoModalTarget] = useState<'logo' | 'square_logo'>('logo');

  // Video selection state
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Selected media
  const [selectedMarketingImages, setSelectedMarketingImages] = useState<GoogleAdsPhotoData[]>([]);
  const [selectedSquareImages, setSelectedSquareImages] = useState<GoogleAdsPhotoData[]>([]);
  const [selectedLogos, setSelectedLogos] = useState<GoogleAdsPhotoData[]>([]);
  const [selectedSquareLogos, setSelectedSquareLogos] = useState<GoogleAdsPhotoData[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<GoogleAdsVideoData[]>([]);

  const openMediaModal = (type: 'image' | 'video', target: string) => {
    setMediaModalType(type);
    setMediaModalTarget(target as any);
    setShowMediaModal(true);
  };

  const openLogoModal = (target: 'logo' | 'square_logo') => {
    setLogoModalTarget(target);
    setShowLogoModal(true);
  };

  const openVideoModal = () => {
    setShowVideoModal(true);
  };

  const [hasUserSelectedMedia, setHasUserSelectedMedia] = useState(false);

  const handleMediaContinue = (items: any[]) => {
    console.log('handleMediaContinue called with items:', items);
    console.log('Setting hasUserSelectedMedia to true');
    setHasUserSelectedMedia(true); // 标记用户已选择媒体
    switch (mediaModalTarget) {
      case 'marketing':
        setSelectedMarketingImages(items);
        break;
      case 'square':
        setSelectedSquareImages(items);
        break;
      case 'both':
        // when both is selected, add all images to marketing and square lists
        setSelectedMarketingImages(items.slice(0, Math.ceil(items.length / 2)));
        setSelectedSquareImages(items.slice(Math.ceil(items.length / 2)));
        break;
      case 'logo':
        setSelectedLogos(items);
        break;
      case 'square_logo':
        setSelectedSquareLogos(items);
        break;
      case 'video':
        setSelectedVideos(items);
        break;
    }
    setShowMediaModal(false);
    // do not call handleUpdate here, let useEffect handle it
  };

  const handleLogoContinue = (items: any[]) => {
    setHasUserSelectedMedia(true); // mark user as selected media
    switch (logoModalTarget) {
      case 'logo':
        setSelectedLogos(items);
        break;
      case 'square_logo':
        setSelectedSquareLogos(items);
        break;
    }
    setShowLogoModal(false);
    // do not call handleUpdate here, let useEffect handle it
  };

  const handleVideoContinue = (items: any[]) => {
    setHasUserSelectedMedia(true); // mark user as selected media
    setSelectedVideos(items);
    setShowVideoModal(false);
    // do not call handleUpdate here, let useEffect handle it
  };

  const handleHeadlineChange = (index: number, value: string) => {
    const newHeadlines = [...headlines];
    newHeadlines[index] = value;
    setHeadlines(newHeadlines);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    setDescriptions(newDescriptions);
  };

  const addHeadline = () => {
    if (headlines.length < 5) {
      setHeadlines([...headlines, '']);
    }
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > 1) {
      const newHeadlines = headlines.filter((_, i) => i !== index);
      setHeadlines(newHeadlines);
    }
  };

  const addDescription = () => {
    if (descriptions.length < 5) {
      setDescriptions([...descriptions, '']);
    }
  };

  const removeDescription = (index: number) => {
    if (descriptions.length > 1) {
      const newDescriptions = descriptions.filter((_, i) => i !== index);
      setDescriptions(newDescriptions);
    }
  };

  // Get current form data (for optimistic save)
  const getFormData = () => {
    return {
      responsive_display_ad_data: {
        business_name: businessName.trim(),
        long_headline_text: longHeadline.trim() || '',
        headline_texts: headlines.filter(h => h.trim() !== '').length > 0 
          ? headlines.filter(h => h.trim() !== '') 
          : [''],
        description_texts: descriptions.filter(d => d.trim() !== '').length > 0 
          ? descriptions.filter(d => d.trim() !== '') 
          : [''],
        call_to_action_text: callToActionText.trim(),
        main_color: mainColor,
        accent_color: accentColor,
        marketing_image_ids: selectedMarketingImages.map(img => img.id).filter(id => id && id > 0) || [],
        square_marketing_image_ids: selectedSquareImages.map(img => img.id).filter(id => id && id > 0) || [],
        logo_image_ids: selectedLogos.map(img => img.id).filter(id => id && id > 0) || [],
        square_logo_image_ids: selectedSquareLogos.map(img => img.id).filter(id => id && id > 0) || [],
        youtube_video_ids: selectedVideos.map(video => video.id).filter(id => id && id > 0) || []
      },
      // Include full media objects for preview
      media: {
        marketing_images: selectedMarketingImages,
        square_marketing_images: selectedSquareImages,
        logo_images: selectedLogos,
        square_logo_images: selectedSquareLogos,
        youtube_videos: selectedVideos
      }
    };
  };

  // Register form data getter with parent component
  useEffect(() => {
    if (onFormDataChange) {
      console.log('ResponsiveDisplayAdForm - useEffect triggered, updating formDataGetter');
      console.log('Current state - businessName:', businessName, 'headlines:', headlines, 'descriptions:', descriptions);
      onFormDataChange(() => getFormData());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessName, longHeadline, headlines, descriptions, callToActionText, mainColor, accentColor, selectedMarketingImages, selectedSquareImages, selectedLogos, selectedSquareLogos, selectedVideos]);

  const getCharacterCountColor = (count: number, max: number) => {
    if (count > max) return 'text-red-500';
    if (count > max * 0.9) return 'text-yellow-500';
    return 'text-gray-500';
  };

  // Validation function to check if all requirements are met
  const isFormValid = () => {
    const hasBusinessName = businessName.trim() !== '';
    const hasLongHeadline = longHeadline.trim() !== '';
    const hasHeadlines = headlines.filter(h => h.trim() !== '').length >= 1;
    const hasDescriptions = descriptions.filter(d => d.trim() !== '').length >= 1;
    const hasLandscapeImages = selectedMarketingImages.length >= 1;
    const hasSquareImages = selectedSquareImages.length >= 1;
    
    return hasBusinessName && hasLongHeadline && hasHeadlines && hasDescriptions && hasLandscapeImages && hasSquareImages;
  };

  // Get validation errors
  const getValidationErrors = () => {
    const errors = [];
    if (businessName.trim() === '') errors.push('Business name is required');
    if (longHeadline.trim() === '') errors.push('Long headline is required');
    if (headlines.filter(h => h.trim() !== '').length === 0) errors.push('At least 1 headline is required');
    if (descriptions.filter(d => d.trim() !== '').length === 0) errors.push('At least 1 description is required');
    if (selectedMarketingImages.length === 0) errors.push('At least 1 landscape image is required');
    if (selectedSquareImages.length === 0) errors.push('At least 1 square image is required');
    return errors;
  };

  // Reset initial load flag when ad ID changes
  useEffect(() => {
    isInitialLoad.current = true;
    setHasUserSelectedMedia(false); // reset media selection mark
  }, [ad?.id]);

  // Sync state with ad prop changes (only on initial load)
  useEffect(() => {
    if (ad?.responsive_display_ad && isInitialLoad.current) {
      const displayAd = ad.responsive_display_ad;
      
      // Update text fields
      setBusinessName(displayAd.business_name || '');
      setLongHeadline(displayAd.long_headline?.text || '');
      
      // Filter out empty strings for headlines and descriptions
      const adHeadlines = displayAd.headlines?.map(h => h.text) || [];
      const filteredHeadlines = adHeadlines.filter(h => h.trim() !== '');
      setHeadlines(filteredHeadlines.length > 0 ? filteredHeadlines : ['']);
      
      const adDescriptions = displayAd.descriptions?.map(d => d.text) || [];
      const filteredDescriptions = adDescriptions.filter(d => d.trim() !== '');
      setDescriptions(filteredDescriptions.length > 0 ? filteredDescriptions : ['']);
      
      setCallToActionText(displayAd.call_to_action_text || '');
      setMainColor(displayAd.main_color || '#000000');
      setAccentColor(displayAd.accent_color || '#000000');
      
      // Update media selections only if user hasn't selected any media yet
      console.log('hasUserSelectedMedia:', hasUserSelectedMedia);
      if (!hasUserSelectedMedia) {
        console.log('Loading media from backend (initial load)');
        setSelectedMarketingImages(convertImageAssets(displayAd.marketing_images));
        setSelectedSquareImages(convertImageAssets(displayAd.square_marketing_images));
        setSelectedLogos(convertImageAssets(displayAd.logo_images));
        setSelectedSquareLogos(convertImageAssets(displayAd.square_logo_images));
        setSelectedVideos(convertVideoAssets(displayAd.youtube_videos));
      } else {
        console.log('Skipping media sync - user has selected media');
      }
      
      // Mark initial load as complete
      isInitialLoad.current = false;
    }
  }, [ad?.id, hasUserSelectedMedia]); // Only trigger when ad ID changes (new ad loaded)

  // Media selections are stored in local state for optimistic UI
  // No automatic save to backend

  // Notify parent component of validation changes
  useEffect(() => {
    if (onValidationChange) {
      const isValid = isFormValid();
      const errors = getValidationErrors();
      onValidationChange(isValid, errors);
    }
  }, [businessName, longHeadline, headlines, descriptions, selectedMarketingImages, selectedSquareImages, onValidationChange]);

  return (
    <div className="space-y-6">
      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
          }}
          placeholder="Your business name"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
          maxLength={25}
        />
        <div className={`text-xs mt-1 ${getCharacterCountColor(businessName.length, 25)}`}>
          {businessName.length}/25 characters
        </div>
      </div>

      {/* Long Headline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Long Headline <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={longHeadline}
          onChange={(e) => {
            setLongHeadline(e.target.value);
          }}
          placeholder="Your main headline"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
          maxLength={90}
        />
        <div className={`text-xs mt-1 ${getCharacterCountColor(longHeadline.length, 90)}`}>
          {longHeadline.length}/90 characters
        </div>
      </div>

      {/* Headlines */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Headlines <span className="text-red-500">*</span></h3>
          <div className="text-sm text-gray-500">
            {headlines.filter(h => h.trim() !== '').length}/5 headlines
          </div>
        </div>
        <div className="space-y-3">
          {headlines.map((headline, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => handleHeadlineChange(index, e.target.value)}
                  placeholder={`Headline ${index + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                  maxLength={30}
                />
                <div className="flex justify-between items-center mt-1">
                  <div className={`text-xs ${getCharacterCountColor(headline.length, 30)}`}>
                    {headline.length}/30 characters
                  </div>
                  {headlines.length > 1 && (
                    <button
                      onClick={() => removeHeadline(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {headlines.length < 5 && (
          <button
            onClick={addHeadline}
            className="mt-3 text-[#3CCED7] hover:text-[#1a9ba3] text-sm font-medium"
          >
            + Add Headline
          </button>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Add 1-5 headlines.
        </p>
      </div>

      {/* Descriptions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Descriptions <span className="text-red-500">*</span></h3>
          <div className="text-sm text-gray-500">
            {descriptions.filter(d => d.trim() !== '').length}/5 descriptions
          </div>
        </div>
        <div className="space-y-3">
          {descriptions.map((description, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <textarea
                  value={description}
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  placeholder={`Description ${index + 1}`}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] resize-none"
                  maxLength={90}
                />
                <div className="flex justify-between items-center mt-1">
                  <div className={`text-xs ${getCharacterCountColor(description.length, 90)}`}>
                    {description.length}/90 characters
                  </div>
                  {descriptions.length > 1 && (
                    <button
                      onClick={() => removeDescription(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {descriptions.length < 5 && (
          <button
            onClick={addDescription}
            className="mt-3 text-[#3CCED7] hover:text-[#1a9ba3] text-sm font-medium"
          >
            + Add Description
          </button>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Add 1-5 descriptions.
        </p>
      </div>

      {/* Call to Action */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Call to Action
        </label>
        <select
          value={callToActionText}
          onChange={(e) => {
            setCallToActionText(e.target.value);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
        >
          <option value="">Select a call to action</option>
          {CALL_TO_ACTION_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Images Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Images <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">Add up to 15 images</p>
        
        {/* Single image button */}
        <div className="mb-4">
          <button 
            onClick={() => openMediaModal('image', 'both')}
            className="text-[#3CCED7] px-4 py-2 rounded-lg hover:bg-[#3CCED7]/10 mb-2"
          >
            + Image
          </button>
          
          {/* show selected images */}
          {(selectedMarketingImages.length > 0 || selectedSquareImages.length > 0) && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {selectedMarketingImages.map(img => (
                <div key={img.id} className="relative">
                  <img 
                    src={img.url} 
                    alt={img.caption || `Image ${img.id}`}
                    className="w-full h-20 object-cover rounded border"
                  />
                  <button
                    onClick={() => {
                      setSelectedMarketingImages(prev => prev.filter(i => i.id !== img.id));
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              {selectedSquareImages.map(img => (
                <div key={img.id} className="relative">
                  <img 
                    src={img.url} 
                    alt={img.caption || `Image ${img.id}`}
                    className="w-full h-20 object-cover rounded border"
                  />
                  <button
                    onClick={() => {
                      setSelectedSquareImages(prev => prev.filter(i => i.id !== img.id));
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
        
        {/* Validation messages */}
        <div className="text-xs text-gray-500">
          <div className={selectedMarketingImages.length >= 1 ? 'text-green-600' : 'text-red-600'}>
            At least 1 landscape image is required
          </div>
          <div className={selectedSquareImages.length >= 1 ? 'text-green-600' : 'text-red-600'}>
            At least 1 square image is required
          </div>
        </div>
      </div>

      {/* Logos Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Logos
        </label>
        <p className="text-sm text-gray-500 mb-2">Add up to 5 logos</p>
        
        <div className="mb-4">
          <button 
            onClick={() => openLogoModal('logo')}
            className="text-[#3CCED7] px-4 py-2 rounded-lg hover:bg-[#3CCED7]/10 mb-2"
          >
            + Logo
          </button>
          
          {/* show selected logos */}
          {selectedLogos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {selectedLogos.map(img => (
                <div key={img.id} className="relative">
                  <img 
                    src={img.url} 
                    alt={img.caption || `Logo ${img.id}`}
                    className="w-full h-20 object-cover rounded border"
                  />
                  <button
                    onClick={() => {
                      setSelectedLogos(prev => prev.filter(i => i.id !== img.id));
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
      </div>

      {/* Videos Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Videos
        </label>
        <p className="text-sm text-gray-500 mb-2">
          Optional (portrait and landscape around 30 seconds work best)
        </p>
        
        <div className="mb-4">
          <button 
            onClick={openVideoModal}
            className="text-[#3CCED7] px-4 py-2 rounded-lg hover:bg-[#3CCED7]/10 mb-2"
          >
            + Video
          </button>
          <p className="text-xs text-gray-400 mt-1">YouTube URL (placeholder)</p>
          
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
      </div>

      {/* Media Selection Modal */}
      <MediaSelectionModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onContinue={handleMediaContinue}
        mediaType={mediaModalType}
        maxSelection={mediaModalType === 'image' ? 15 : 1}
        imageType="both"
        selectedMediaIds={mediaModalTarget === 'marketing' ? selectedMarketingImages.map(img => img.id) :
                         mediaModalTarget === 'square' ? selectedSquareImages.map(img => img.id) :
                         mediaModalTarget === 'both' ? [...selectedMarketingImages.map(img => img.id), ...selectedSquareImages.map(img => img.id)] :
                         []}
      />

      {/* Logo Selection Modal */}
      <LogoSelectionModal
        isOpen={showLogoModal}
        onClose={() => setShowLogoModal(false)}
        onContinue={handleLogoContinue}
        maxSelection={5}
        selectedMediaIds={logoModalTarget === 'logo' ? selectedLogos.map(img => img.id) :
                         logoModalTarget === 'square_logo' ? selectedSquareLogos.map(img => img.id) :
                         []}
      />

      {/* Video Selection Modal */}
      <VideoSelectionModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onContinue={handleVideoContinue}
        maxSelection={5}
        selectedMediaIds={selectedVideos.map(video => video.id)}
      />

    </div>
  );
}
