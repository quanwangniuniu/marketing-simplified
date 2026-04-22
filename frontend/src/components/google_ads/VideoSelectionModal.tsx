'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  FolderInput,
  Settings2,
  SquarePlay,
  FileImage,
  Star,
  Loader2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Search
} from 'lucide-react';
import { getGoogleAdsVideos, createGoogleAdsVideo, GoogleAdsVideoData } from '@/lib/api/googleAdsMediaApi';
import VideoCard from './VideoCard';
import toast from 'react-hot-toast';

interface VideoSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (selectedItems: any[]) => void;
  selectedMediaIds?: number[];
  maxSelection?: number;
}

const VideoSelectionModal: React.FC<VideoSelectionModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  selectedMediaIds = [],
  maxSelection = 5
}) => {
  const [videos, setVideos] = useState<GoogleAdsVideoData[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set(selectedMediaIds));
  const [isUploading, setIsUploading] = useState(false);
  const [hoveredMedia, setHoveredMedia] = useState<{ id: number; section?: string } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ id: number } | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);

  const tabs = [
    { id: 'account', label: 'Asset Library', icon: FolderInput },
    { id: 'youtube', label: 'Use YouTube Video', icon: SquarePlay }
  ];
  const [activeTab, setActiveTab] = useState('account');

  // Load videos when modal opens
  useEffect(() => {
    console.log('=== useEffect for loadVideos ===');
    console.log('isOpen:', isOpen, 'activeTab:', activeTab);
    if (isOpen && activeTab === 'account') {
      console.log('Calling loadVideos...');
      loadVideos();
    }
  }, [isOpen, activeTab]);

  // Update selectedMedia when selectedMediaIds prop changes (only if provided)
  useEffect(() => {
    console.log('useEffect triggered - selectedMediaIds:', selectedMediaIds);
    if (selectedMediaIds && selectedMediaIds.length > 0) {
      console.log('Updating selectedMedia from prop:', selectedMediaIds);
      setSelectedMedia(new Set(selectedMediaIds));
    }
  }, [selectedMediaIds]);

  const loadVideos = async () => {
    try {
      console.log('=== loadVideos called ===');
      console.log('Current videos count before load:', videos.length);
      const response = await getGoogleAdsVideos();
      console.log('Videos loaded from API:', response.length);
      setVideos(response);
      console.log('Videos set to state, new count:', response.length);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleMediaSelect = (mediaId: number) => {
    console.log('handleMediaSelect called with mediaId:', mediaId);
    console.log('Current selectedMedia:', Array.from(selectedMedia));
    console.log('maxSelection:', maxSelection);
    
    setSelectedMedia(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mediaId)) {
        newSet.delete(mediaId);
        console.log('Removed mediaId:', mediaId);
      } else {
        if (newSet.size >= maxSelection) {
          toast.error(`Maximum ${maxSelection} items allowed`);
          console.log('Max selection reached');
          return prev;
        }
        newSet.add(mediaId);
        console.log('Added mediaId:', mediaId);
      }
      console.log('New selectedMedia:', Array.from(newSet));
      return newSet;
    });
  };

  const handleMediaMouseEnter = (mediaId: number, section?: string) => {
    setHoveredMedia({ id: mediaId, section });
  };

  const handleMediaMouseLeave = () => {
    setHoveredMedia(null);
  };

  const handlePreviewShow = (mediaId: number) => {
    setPreviewMedia({ id: mediaId });
  };

  const handlePreviousVideo = () => {
    if (!previewMedia) return;
    
    const currentIndex = videos.findIndex(item => item.id === previewMedia.id);
    if (currentIndex > 0) {
      const previousItem = videos[currentIndex - 1];
      setPreviewMedia({ id: previousItem.id });
    }
  };

  const handleNextVideo = () => {
    if (!previewMedia) return;
    
    const currentIndex = videos.findIndex(item => item.id === previewMedia.id);
    if (currentIndex < videos.length - 1) {
      const nextItem = videos[currentIndex + 1];
      setPreviewMedia({ id: nextItem.id });
    }
  };

  // Extract YouTube video ID from URL
  const extractYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Handle YouTube URL submission
  const handleYouTubeUrlSubmit = async () => {
    if (!youtubeUrl.trim()) {
      toast.error('Please enter a YouTube URL');
      return;
    }

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    setIsValidatingUrl(true);
    try {
      const response = await createGoogleAdsVideo(youtubeUrl);
      if (response.success && response.video) {
        // Add the new video to the list
        setVideos(prevVideos => [response.video!, ...prevVideos]);
        
        // Auto-select the new video if under limit
        if (selectedMedia.size < maxSelection) {
          setSelectedMedia(prev => new Set([...prev, response.video!.id]));
        }
        
        toast.success('Video added successfully');
        setYoutubeUrl('');
      } else {
        toast.error('Failed to add video');
      }
    } catch (error) {
      console.error('Failed to add video:', error);
      toast.error('Failed to add video');
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // validate video selection requirements
  const validateVideoSelection = () => {
    console.log('=== validateVideoSelection ===');
    console.log('selectedMedia:', selectedMedia);
    
    const selectedVideos = videos.filter(v => selectedMedia.has(v.id));
    console.log('selectedVideos:', selectedVideos);
    
    // check total limit
    if (selectedVideos.length > maxSelection) {
      console.log('Exceeds max selection limit:', selectedVideos.length, '>', maxSelection);
      return false;
    }
    
    // For videos, we only need to check the count limit
    const result = selectedVideos.length > 0;
    console.log('Final validation result:', result);
    return result;
  };

  const handleContinue = () => {
    const selectedItems = videos.filter(v => selectedMedia.has(v.id));
    onContinue(selectedItems);
  };

  // Update disableContinue based on selection
  useEffect(() => {
    console.log('=== useEffect for disableContinue ===');
    const isValid = validateVideoSelection();
    console.log('Validation result:', isValid);
    console.log('Setting disableContinue to:', !isValid);
    setDisableContinue(!isValid);
  }, [selectedMedia, videos, maxSelection]);

  const [disableContinue, setDisableContinue] = useState(true);

  // Keyboard navigation for preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewMedia) return;
      
      if (e.key === 'ArrowLeft') {
        handlePreviousVideo();
      } else if (e.key === 'ArrowRight') {
        handleNextVideo();
      } else if (e.key === 'Escape') {
        setPreviewMedia(null);
      }
    };

    if (previewMedia) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [previewMedia]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-[#3CCED7]">
            Select Videos
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#3CCED7] text-[#3CCED7]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'account' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Asset Library</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      isSelected={selectedMedia.has(video.id)}
                      isHovered={hoveredMedia?.id === video.id && hoveredMedia?.section === 'account'}
                      onSelect={handleMediaSelect}
                      onMouseEnter={handleMediaMouseEnter}
                      onMouseLeave={handleMediaMouseLeave}
                      onPreviewShow={handlePreviewShow}
                      onPreviewHide={() => setPreviewMedia(null)}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'youtube' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Add YouTube Video</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                      />
                      <button
                        onClick={handleYouTubeUrlSubmit}
                        disabled={isValidatingUrl || !youtubeUrl.trim()}
                        className="px-4 py-2 bg-[#3CCED7] text-white rounded-md hover:bg-[#2AB5BD] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isValidatingUrl ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {isValidatingUrl ? 'Adding...' : 'Add Video'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter a YouTube video URL to add it to your library
                    </p>
                  </div>

                  {/* Show recently added videos */}
                  {videos.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">Recently Added Videos</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {videos.slice(0, 6).map((video) => (
                          <VideoCard
                            key={video.id}
                            video={video}
                            isSelected={selectedMedia.has(video.id)}
                            isHovered={hoveredMedia?.id === video.id && hoveredMedia?.section === 'youtube'}
                            onSelect={handleMediaSelect}
                            onMouseEnter={handleMediaMouseEnter}
                            onMouseLeave={handleMediaMouseLeave}
                            onPreviewShow={handlePreviewShow}
                            onPreviewHide={() => setPreviewMedia(null)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedMedia.size} of {maxSelection} selected
            <div className="mt-1 text-xs">
              <div className={selectedMedia.size <= maxSelection ? 'text-green-600' : 'text-red-600'}>
                At most {maxSelection} videos allowed
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={disableContinue}
              className={`px-4 py-2 rounded-lg font-medium ${
                disableContinue
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD]'
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <h3 className="text-xl font-semibold">
                    {(() => {
                      const currentItem = videos.find(item => item.id === previewMedia.id);
                      return currentItem ? (
                        <span className="break-words max-w-md">
                          {currentItem.title || `video-${currentItem.id}`}
                        </span>
                      ) : (
                        'Video Preview'
                      );
                    })()}
                  </h3>
                  {(() => {
                    const currentIndex = videos.findIndex(item => item.id === previewMedia.id);
                    return (
                      <span className="text-sm text-gray-500">
                        {currentIndex + 1} of {videos.length}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Video Details Sidebar */}
              <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto">
                {(() => {
                  const video = videos.find(v => v.id === previewMedia.id);
                  return video ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Video Details</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Title:</span>
                            <div className="text-gray-600">{video.title || 'Untitled'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Video ID:</span>
                            <div className="text-gray-600">{video.video_id}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Duration:</span>
                            <div className="text-gray-600">{(video as any).duration || 'Unknown'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Source:</span>
                            <div className="text-gray-600">YouTube</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Main Video Display */}
              <div className="flex-1 flex items-center justify-center p-6 relative">
                {(() => {
                  const video = videos.find(v => v.id === previewMedia.id);
                  return video ? (
                    <div className="w-full max-w-4xl">
                      <iframe
                        width="100%"
                        height="400"
                        src={`https://www.youtube.com/embed/${video.video_id}`}
                        title={video.title || `Video ${video.id}`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="text-gray-500">Video not found</div>
                  );
                })()}

                {/* Navigation Arrows */}
                {(() => {
                  const currentIndex = videos.findIndex(item => item.id === previewMedia.id);
                  const hasPrevious = currentIndex > 0;
                  const hasNext = currentIndex < videos.length - 1;
                  
                  return (
                    <>
                      {/* Previous Arrow */}
                      {hasPrevious && (
                        <button
                          onClick={handlePreviousVideo}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all z-10"
                          title="Previous (←)"
                        >
                          <ChevronLeft className="w-6 h-6 text-gray-700" />
                        </button>
                      )}
                      
                      {/* Next Arrow */}
                      {hasNext && (
                        <button
                          onClick={handleNextVideo}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all z-10"
                          title="Next (→)"
                        >
                          <ChevronRight className="w-6 h-6 text-gray-700" />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoSelectionModal;
