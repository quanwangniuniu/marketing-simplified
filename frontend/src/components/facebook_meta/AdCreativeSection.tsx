'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CircleCheck, Info, CirclePlus } from 'lucide-react';
import MediaSelectionModal from './MediaSelectionModal';
import facebookMetaApi from '@/lib/api/facebookMetaApi';

interface MediaFile {
  id: number;
  type: 'photo' | 'video';
  thumbnail?: string;
  caption?: string;
  url?: string;
}

interface AdCreativeSectionProps {
  adCreativeId: string;
  primaryText: string;
  onPrimaryTextChange: (text: string) => void;
  headline: string;
  onHeadlineChange: (text: string) => void;
  description: string;
  onDescriptionChange: (text: string) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  addWebsiteUrl: boolean;
  onAddWebsiteUrlChange: (enabled: boolean) => void;
  displayLink: string;
  onDisplayLinkChange: (link: string) => void;
  callToAction: string;
  onCallToActionChange: (action: string) => void;
  optimizeCreative: boolean;
  onOptimizeCreativeChange: (enabled: boolean) => void;
  selectedMedia: MediaFile[];
  onSelectedMediaChange: (media: MediaFile[]) => void;
}

export default function AdCreativeSection({
  adCreativeId,
  primaryText,
  onPrimaryTextChange,
  headline,
  onHeadlineChange,
  description,
  onDescriptionChange,
  websiteUrl,
  onWebsiteUrlChange,
  addWebsiteUrl,
  onAddWebsiteUrlChange,
  displayLink,
  onDisplayLinkChange,
  callToAction,
  onCallToActionChange,
  optimizeCreative,
  onOptimizeCreativeChange,
  selectedMedia,
  onSelectedMediaChange
}: AdCreativeSectionProps) {
  const [showMediaTooltip, setShowMediaTooltip] = useState(false);
  const [showPrimaryTextTooltip, setShowPrimaryTextTooltip] = useState(false);
  const [showHeadlineTooltip, setShowHeadlineTooltip] = useState(false);
  const [showDescriptionTooltip, setShowDescriptionTooltip] = useState(false);
  const [showWebsiteUrlTooltip, setShowWebsiteUrlTooltip] = useState(false);
  const [showMobileAppTooltip, setShowMobileAppTooltip] = useState(false);
  const [showCallToActionTooltip, setShowCallToActionTooltip] = useState(false);
  const [showCallToActionDropdown, setShowCallToActionDropdown] = useState(false);
  const [showSelectVideos, setShowSelectVideos] = useState(false);
  const [showSelectImages, setShowSelectImages] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Media handling functions
  const handleMediaSelection = async (newMedia: MediaFile[]) => {
    // Photos should come first, then videos
    const photos = newMedia.filter(media => media.type === 'photo');
    const videos = newMedia.filter(media => media.type === 'video');
    
    // Limit to 10 items total
    const limitedMedia = [...photos, ...videos].slice(0, 10);
    
    // Call API to associate media with ad creative FIRST
    try {
      const photoIds = photos.map(p => p.id);
      const videoIds = videos.map(v => v.id);
      
      await facebookMetaApi.associateMedia(adCreativeId, photoIds, videoIds);
      
      // Only update UI if API call succeeds
      onSelectedMediaChange(limitedMedia);
    } catch (error) {
      console.error('Failed to associate media:', error);
      alert('Failed to associate media. Please try again.');
    }
  };

  const handleRemoveMedia = async (mediaId: number, mediaType: 'photo' | 'video') => {
    // Filter out the specific media item by both ID and type
    const updatedMedia = selectedMedia.filter(media => !(media.id === mediaId && media.type === mediaType));
    
    // Update the backend with the new media list FIRST
    const photos = updatedMedia.filter(m => m.type === 'photo');
    const videos = updatedMedia.filter(m => m.type === 'video');
    
    try {
      // Always send both photo_ids and video_ids arrays (even if empty)
      // This ensures the backend clears relationships properly
      await facebookMetaApi.associateMedia(
        adCreativeId,
        photos.map(p => p.id),
        videos.map(v => v.id)
      );
      
      // Only update UI if API call succeeds
      onSelectedMediaChange(updatedMedia);
    } catch (error) {
      console.error('Failed to update media:', error);
      alert('Failed to remove media. Please try again.');
    }
  };

  // Check if required fields are filled
  const isRequiredFieldsFilled = primaryText.trim().length > 0 &&
    (!addWebsiteUrl || websiteUrl.trim().length > 0);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCallToActionDropdown(false);
      }
    };

    if (showCallToActionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCallToActionDropdown]);

  // Custom Facebook warning icon component
  const FacebookWarningIcon = () => (
    <div
      className="w-4 h-4 mr-2"
      style={{
        maskImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/yO/r/Bq0ilbYGkV2.png")',
        maskSize: '17px 303px',
        maskPosition: '0px -51px',
        backgroundColor: '#0a78be'
      }}
    />
  );

  return (
    <>
      <div className="space-y-4">
        {/* Title with status icon */}
        <div className="flex items-center">
          {isRequiredFieldsFilled ? (
            <CircleCheck className="w-5 h-5 text-green-500 mr-2" />
          ) : (
            <FacebookWarningIcon />
          )}
          <h3 className="text-base font-bold text-gray-900">Ad creative</h3>
        </div>

        <p className="text-sm text-gray-600">
          Select and optimise your ad text, media and enhancements.
        </p>

        {/* Media Section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-bold">* Media</h4>
            <div className="relative">
              <Info
                className="w-4 h-4 text-black cursor-pointer"
                onMouseEnter={() => setShowMediaTooltip(true)}
                onMouseLeave={() => setShowMediaTooltip(false)}
              />
              {showMediaTooltip && (
                <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                  <p>
                    Choose up to ten images or videos, and we'll generate multiple combinations using dynamic creative. You can also create new videos or slideshows using templates.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Media buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowSelectImages(true)}
              className="flex-1 px-4 py-2 bg-white border border-[#00000066] rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              Select images
            </button>
            <button
              onClick={() => setShowSelectVideos(true)}
              className="flex-1 px-4 py-2 bg-white border border-[#00000066] rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              Select videos
            </button>
            <button className="flex-1 px-4 py-2 bg-white border border-[#00000066] rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              Create video
            </button>
          </div>

          {/* Selected Media Display */}
          {selectedMedia.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-md pt-4">
              <div className="flex items-center justify-between mb-3 px-4">
                <h4 className="text-sm font-bold">Images, videos and slideshows</h4>
                <span className="text-sm">{selectedMedia.length} of 10</span>
              </div>
              <div className="space-y-2">
                {selectedMedia.map((media, index) => (
                  <div key={`${media.type}-${media.id}`} className={`flex items-center justify-between p-3 ${index < selectedMedia.length - 1 ? 'border-b border-gray-200' : ''}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-[124px] h-[124px] bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                        {media.url || media.thumbnail ? (
                          media.type === 'video' ? (
                            <video 
                              src={media.url} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img 
                              src={media.url || media.thumbnail} 
                              alt={media.caption || `${media.type} preview`}
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : media.type === 'photo' ? (
                          <div className="w-full h-full bg-[#3CCED7] flex items-center justify-center">
                            <span className="text-white text-xs font-bold">IMG</span>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">VID</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <button className="h-9 w-24 text-sm hover:bg-gray-100 rounded-sm border border-gray-400 flex items-center justify-center space-x-1 transition-colors">
                          {media.type === 'video' && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                          <span>Edit {media.type === 'photo' ? 'Media' : 'Video'}</span>
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedia(media.id, media.type)}
                      className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media info alert - shown when no media selected */}
          <div className="pt-6">
            <div className="border-gray-300 border-l-4 border-t border-t-gray-100 rounded-md p-4 shadow-md">
              <div className="flex items-start space-x-3">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">
                    Your ad needs an image or video: Your 1 ad requires at least images or videos AUTOMATIC_FORMAT. Please select media in the ad creative section.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200"></div>

        {/* Optimization Section */}
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <button
              onClick={() => onOptimizeCreativeChange(!optimizeCreative)}
              className={`relative inline-flex h-6 w-11 items-center flex-shrink-0 rounded-full transition-colors ${optimizeCreative ? 'bg-[#3CCED7]' : 'bg-gray-200'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${optimizeCreative ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-900">
                Optimise creative for each <span className="text-[#3CCED7]">person</span>
              </span>
              <p className="text-xs text-gray-600">
                Vary your ad creative and destination based on each person's likelihood of responding.{' '}
                <a href="#" className="text-[#3CCED7] hover:underline">See possible enhancements</a>
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200"></div>

        {/* Text Section */}
        <div className="space-y-4">
          {/* Primary text */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-gray-900">Primary text</label>
              <div className="relative">
                <Info
                  className="w-4 h-4 text-black cursor-pointer"
                  onMouseEnter={() => setShowPrimaryTextTooltip(true)}
                  onMouseLeave={() => setShowPrimaryTextTooltip(false)}
                />
                {showPrimaryTextTooltip && (
                  <div className="absolute bottom-0 left-0 transform translate-x-4 w-40 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                    <p>Add up to five texts.</p>
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={primaryText}
              onChange={(e) => onPrimaryTextChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Add website URL checkbox */}
          <div className="space-y-2">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={addWebsiteUrl}
                onChange={(e) => onAddWebsiteUrlChange(e.target.checked)}
                className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7] mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-gray-900">Add a website URL</span>
                <p className="text-xs text-gray-600 mt-1">
                  If you add a website URL, people who click or tap on your ad will go to your website. If you don't, they'll go to your Facebook Page or Instagram account.
                </p>
              </div>
            </label>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-gray-900">Headline</label>
              <div className="relative">
                <Info
                  className="w-4 h-4 text-black cursor-pointer"
                  onMouseEnter={() => setShowHeadlineTooltip(true)}
                  onMouseLeave={() => setShowHeadlineTooltip(false)}
                />
                {showHeadlineTooltip && (
                  <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                    <p>
                      Add up to five brief headlines to let people know what your ad is about. Each headline can have a maximum of 255 characters. Headlines won't appear in all placements.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <input
              type="text"
              value={headline}
              onChange={(e) => onHeadlineChange(e.target.value)}
              placeholder="Write a short headline"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-gray-900">Description</label>
              <div className="relative">
                <Info
                  className="w-4 h-4 text-black cursor-pointer"
                  onMouseEnter={() => setShowDescriptionTooltip(true)}
                  onMouseLeave={() => setShowDescriptionTooltip(false)}
                />
                {showDescriptionTooltip && (
                  <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                    <p>
                      Add up to five link descriptions to emphasise why people should visit your website. This won't appear in all placements.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Include additional details"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
            />
          </div>

          {/* Website URL */}
          {addWebsiteUrl && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-bold text-gray-900">* Website URL</label>
                <div className="relative">
                  <Info
                    className="w-4 h-4 text-black cursor-pointer"
                    onMouseEnter={() => setShowWebsiteUrlTooltip(true)}
                    onMouseLeave={() => setShowWebsiteUrlTooltip(false)}
                  />
                  {showWebsiteUrlTooltip && (
                    <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                      <p>Enter the URL for the web page that you want people to visit</p>
                    </div>
                  )}
                </div>
              </div>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => onWebsiteUrlChange(e.target.value)}
                placeholder="http://www.example.com/page"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
              />
              <p className="text-xs">Enter the website URL field for your ad.</p>
            </div>
          )}
        </div>

        {/* URL Parameters Alert */}
        <div className="border-gray-300 border-l-4 border-t border-t-gray-100 rounded-md p-4 shadow-md">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm">
                URL parameters have been moved to <strong>Tracking</strong> so that you can manage them in one place.
              </p>
              <div className="pt-2">
                <a href="#" className="text-[#3CCED7] hover:underline">Go to Tracking</a>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Options */}
        <div className="space-y-4">
          {/* Display link */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-900">Display link</label>
            <input
              type="text"
              value={displayLink}
              onChange={(e) => onDisplayLinkChange(e.target.value)}
              placeholder="Enter the link that you want to show on your ad"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
            />
          </div>

          {/* Mobile app */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-gray-900">Mobile app</label>
              <div className="relative">
                <Info
                  className="w-4 h-4 text-black cursor-pointer"
                  onMouseEnter={() => setShowMobileAppTooltip(true)}
                  onMouseLeave={() => setShowMobileAppTooltip(false)}
                />
                {showMobileAppTooltip && (
                  <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                    <p>Only select a mobile app if you are using a universal link (IOS or Android app link.)</p>
                  </div>
                )}
              </div>
            </div>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent">
              <option>Choose app</option>
            </select>
          </div>

          {/* Call to action */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-gray-900">Call to action</label>
              <div className="relative">
                <Info
                  className="w-4 h-4 text-black cursor-pointer"
                  onMouseEnter={() => setShowCallToActionTooltip(true)}
                  onMouseLeave={() => setShowCallToActionTooltip(false)}
                />
                {showCallToActionTooltip && (
                  <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                    <p>
                      Add a button that matches the action you want people to take when they see your ad. You can select up to five calls to action for your ad.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowCallToActionDropdown(!showCallToActionDropdown)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent flex items-center justify-between"
              >
                <span className="text-gray-900">{callToAction}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCallToActionDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-2">
                    {[
                      'Listen now',
                      'Apply now',
                      'Book now',
                      'Contact us',
                      'Download',
                      'Get quote',
                      'Get showtimes',
                      'Learn more'
                    ].map((option) => (
                      <label key={option} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name="callToAction"
                          value={option}
                          checked={callToAction === option}
                          onChange={(e) => {
                            onCallToActionChange(e.target.value);
                            setShowCallToActionDropdown(false);
                          }}
                          className="w-4 h-4 text-[#3CCED7] border-gray-300 focus:ring-[#3CCED7] mr-3"
                        />
                        <span className={`text-sm ${callToAction === option ? 'text-gray-500' : 'text-gray-900'}`}>
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add Another Option */}
          <button className="flex items-center space-x-2 text-[#3CCED7] hover:text-[#1a9ba3]">
            <CirclePlus className="w-4 h-4" />
            <span className="text-sm">Add Another Option</span>
          </button>
        </div>
      </div>
      {showSelectVideos && (
        <MediaSelectionModal
          isOpen={showSelectVideos}
          onClose={() => setShowSelectVideos(false)}
          onContinue={(selectedItems) => {
            const selectedVideos: MediaFile[] = selectedItems.map((item: any) => {
              // Convert relative URLs to absolute
              const videoUrl = item.url?.startsWith('http') 
                ? item.url 
                : `${window.location.origin}${item.url}`;
                
              return {
                id: item.id,
                type: 'video' as const,
                thumbnail: videoUrl,
                caption: item.title || item.message || '',
                url: videoUrl
              };
            });
            
            // Replace existing videos with newly selected videos, keep photos unchanged
            const existingPhotos = selectedMedia.filter(media => media.type === 'photo');
            handleMediaSelection([...existingPhotos, ...selectedVideos]);
            setShowSelectVideos(false);
          }}
          mediaType="video"
          selectedMediaIds={selectedMedia.filter(m => m.type === 'video').map(m => m.id)}
        />
      )}
      {showSelectImages && (
        <MediaSelectionModal
          isOpen={showSelectImages}
          onClose={() => setShowSelectImages(false)}
          onContinue={(selectedItems) => {
            const selectedPhotos: MediaFile[] = selectedItems.map((item: any) => {
              // Convert relative URLs to absolute
              const photoUrl = item.url?.startsWith('http') 
                ? item.url 
                : `${window.location.origin}${item.url}`;
                
              return {
                id: item.id,
                type: 'photo' as const,
                thumbnail: photoUrl,
                caption: item.caption || '',
                url: photoUrl
              };
            });
            
            // Replace existing photos with newly selected photos, keep videos unchanged
            const existingVideos = selectedMedia.filter(media => media.type === 'video');
            handleMediaSelection([...selectedPhotos, ...existingVideos]);
            setShowSelectImages(false);
          }}
          mediaType="image"
          selectedMediaIds={selectedMedia.filter(m => m.type === 'photo').map(m => m.id)}
        />
      )}
    </>
  );
}
