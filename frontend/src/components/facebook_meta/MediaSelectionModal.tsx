'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Search,
  ChevronDown,
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
  VolumeX
} from 'lucide-react';
import { uploadPhoto, getPhotos, PhotoData } from '@/lib/api/facebookMetaPhotoApi';
import { uploadVideo, getVideos, VideoData } from '@/lib/api/facebookMetaVideoApi';
import PhotoCard from './PhotoCard';
import VideoCard from './VideoCard';
import toast from 'react-hot-toast';

interface MediaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (selectedItems: any[]) => void;
  mediaType: 'video' | 'image';
  selectedMediaIds?: number[]; // IDs of already selected media items
}

type VideoSource = 'account' | 'video-url';
type ImageSource = 'all' | 'account' | 'recommended';
type MediaSource = VideoSource | ImageSource;

export default function MediaSelectionModal({
  isOpen,
  onClose,
  onContinue,
  mediaType,
  selectedMediaIds = []
}: MediaSelectionModalProps) {
  const VideoControls = () => {
    const [isPaused, setIsPaused] = useState(false);
    const [muted, setMuted] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Find the video element within the same preview container
    useEffect(() => {
      const container = document.querySelector('[data-preview-container]');
      if (!container) return;
      const vid = container.querySelector('video') as HTMLVideoElement | null;
      if (!vid) return;
      videoRef.current = vid;
      vid.muted = muted;
      if (isPaused) vid.pause(); else vid.play().catch(() => {});

      const onTime = () => setCurrentTime(vid.currentTime);
      const onLoaded = () => setDuration(vid.duration || 0);
      vid.addEventListener('timeupdate', onTime);
      vid.addEventListener('loadedmetadata', onLoaded);
      return () => {
        vid.removeEventListener('timeupdate', onTime);
        vid.removeEventListener('loadedmetadata', onLoaded);
      };
    }, [isPaused, muted, previewMedia]);

    const togglePlay = () => {
      const vid = videoRef.current;
      if (!vid) return;
      if (vid.paused) {
        vid.play().catch(() => {});
        setIsPaused(false);
      } else {
        vid.pause();
        setIsPaused(true);
      }
    };

    const toggleMute = () => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.muted = !vid.muted;
      setMuted(vid.muted);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vid = videoRef.current;
      if (!vid) return;
      const value = Number(e.target.value);
      vid.currentTime = value;
      setCurrentTime(value);
    };

    const formatTime = (t: number) => {
      if (!isFinite(t)) return '0:00';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    return (
      <div className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-black/55 rounded-md text-white select-none">

        {/* Video frame sits above; controls below */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="p-1 hover:bg-white/10 rounded"
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="flex-1 h-1.5 appearance-none bg-white/30 rounded outline-none cursor-pointer [accent-color:#3b82f6]"
          />

          {/* Time text */}
          <div className="text-xs w-16 text-right tabular-nums">
            {formatTime(currentTime)}/{formatTime(duration)}
          </div>

          {/* Mute toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="p-1 hover:bg-white/10 rounded"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };
  const [activeTab, setActiveTab] = useState<MediaSource>(mediaType === 'video' ? 'account' : 'all');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [disableContinue, setDisableContinue] = useState(true);
  const [disableTopControls, setDisableTopControls] = useState(false);
  const [disableUploadOnly, setDisableUploadOnly] = useState(false);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set(selectedMediaIds));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempIdCounter, setTempIdCounter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredMedia, setHoveredMedia] = useState<{ id: number; section?: string } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ id: number; position: { x: number; y: number } } | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update disableTopControls based on active tab
  const handleTabChange = (tab: MediaSource) => {
    setActiveTab(tab);

    if (mediaType === 'video') {
      setDisableTopControls(tab === 'video-url');
      setDisableUploadOnly(false);
    } else {
      // For images: disable upload button only for recommended tab
      setDisableTopControls(false);
      setDisableUploadOnly(tab === 'recommended');
    }
  };

  // Load photos when modal opens or tab changes (for images)
  useEffect(() => {
    if (isOpen && mediaType === 'image' && (activeTab === 'all' || activeTab === 'account')) {
      loadPhotos();
    }
  }, [isOpen, mediaType, activeTab]);

  // Load videos when modal opens or tab changes (for videos)
  useEffect(() => {
    if (isOpen && mediaType === 'video' && activeTab === 'account') {
      loadVideos();
    }
  }, [isOpen, mediaType, activeTab]);

  // Update selectedMedia when selectedMediaIds prop changes
  useEffect(() => {
    setSelectedMedia(new Set(selectedMediaIds));
  }, [selectedMediaIds]);

  const loadPhotos = async () => {
    try {
      const response = await getPhotos();
      setPhotos(response.results);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const response = await getVideos();
      setVideos(response.results);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    if (mediaType === 'image') {
      // Create placeholder photos and add to the beginning of photos array
      const placeholderPhotos: PhotoData[] = Array.from(files).map((file, index) => ({
        id: -(tempIdCounter + index + 1), // Use negative IDs for temp photos
        url: URL.createObjectURL(file),
        caption: '',
        image_hash: '',
        isUploading: true
      }));

      setTempIdCounter(prev => prev + files.length);

      // Add placeholders to the BEGINNING of the photos array
      setPhotos(prev => [...placeholderPhotos, ...prev]);

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const placeholderId = placeholderPhotos[i].id;

        try {
          await uploadPhoto(file);

          // Mark as successfully uploaded (will be replaced when we refetch)
          setPhotos(prev =>
            prev.map(p =>
              p.id === placeholderId
                ? { ...p, isUploading: false }
                : p
            )
          );

        } catch (error) {
          console.error('Upload failed:', error);

          // Mark as error
          setPhotos(prev =>
            prev.map(p =>
              p.id === placeholderId
                ? { ...p, isUploading: false, uploadError: true }
                : p
            )
          );

          // Remove failed upload after 2 seconds
          setTimeout(() => {
            setPhotos(prev => prev.filter(p => p.id !== placeholderId));
            URL.revokeObjectURL(placeholderPhotos[i].url);
          }, 2000);
        }
      }

      setIsUploading(false);

      // Refetch photos to get the real data from backend
      await loadPhotos();

      // Clean up placeholder URLs
      placeholderPhotos.forEach(p => URL.revokeObjectURL(p.url));
    } else if (mediaType === 'video') {
      // Create placeholder videos and add to the beginning of videos array
      const placeholderVideos: VideoData[] = Array.from(files).map((file, index) => ({
        id: -(tempIdCounter + index + 1), // Use negative IDs for temp videos
        url: URL.createObjectURL(file),
        title: file.name,
        message: '',
        video_id: '',
        isUploading: true
      }));

      setTempIdCounter(prev => prev + files.length);

      // Add placeholders to the BEGINNING of the videos array
      setVideos(prev => [...placeholderVideos, ...prev]);

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const placeholderId = placeholderVideos[i].id;
        
        // Show loading toast
        const toastId = toast.loading(`Uploading video\nProcessing ${file.name}...`);

        try {
          await uploadVideo(file, file.name);

          // Mark as successfully uploaded (will be replaced when we refetch)
          setVideos(prev =>
            prev.map(v =>
              v.id === placeholderId
                ? { ...v, isUploading: false }
                : v
            )
          );

          // Update to success toast
          toast.success(
            `Your video ${file.name} has been uploaded successfully\nReview your video ad to finish and publish.`,
            { id: toastId, duration: 5000 }
          );

        } catch (error) {
          console.error('Upload failed:', error);

          // Mark as error
          setVideos(prev =>
            prev.map(v =>
              v.id === placeholderId
                ? { ...v, isUploading: false, uploadError: true }
                : v
            )
          );

          // Update to error toast
          toast.error(
            `Upload failed\nFailed to upload ${file.name}. Please try again.`,
            { id: toastId, duration: 5000 }
          );

          // Remove failed upload after 2 seconds
          setTimeout(() => {
            setVideos(prev => prev.filter(v => v.id !== placeholderId));
            URL.revokeObjectURL(placeholderVideos[i].url);
          }, 2000);
        }
      }

      setIsUploading(false);

      // Refetch videos to get the real data from backend
      await loadVideos();

      // Clean up placeholder URLs
      placeholderVideos.forEach(v => URL.revokeObjectURL(v.url));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleMediaSelection = (mediaId: number) => {
    setSelectedMedia(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mediaId)) {
        newSet.delete(mediaId);
      } else {
        newSet.add(mediaId);
      }
      return newSet;
    });
  };

  // Generic preview handlers
  const handlePreviewShow = (
    id: number, 
    position: { x: number; y: number }, 
    setter: (value: { id: number; position: { x: number; y: number } } | null) => void
  ) => {
    // Clear any pending timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setter({ id, position });
  };

  const handlePreviewHide = (setter: (value: null) => void) => {
    // Set a timeout before hiding
    previewTimeoutRef.current = setTimeout(() => {
      setter(null);
    }, 500);
  };

  const handlePreviewEnter = () => {
    // Cancel hide timeout when entering preview
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  };

  const handlePreviewLeave = (setter: (value: null) => void) => {
    // Immediately hide when leaving preview
    setter(null);
  };

  // Filter photos based on search query
  const getFilteredPhotos = () => {
    if (!searchQuery.trim()) return photos;
    
    return photos.filter(photo => {
      const filename = photo.url.split('/').pop() || '';
      return filename.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const filteredPhotos = getFilteredPhotos();

  if (!isOpen) return null;

  // Reusable photo grid renderer
  const renderPhotoGrid = (showSections = false) => {
    // Check if we have a search query and no results
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasResults = filteredPhotos.length > 0;

    // Show "No images match your search" message
    if (hasSearchQuery && !hasResults) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-6">
              <FileImage className="w-20 h-20 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No images match your search</h3>
            <p className="text-gray-600 text-sm">We couldn't find any images that match your search. Try adjusting your filters or searching for something else.</p>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Account Images Section - only in All tab */}
        {showSections && filteredPhotos.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm flex items-center">
                <span className="mr-2 w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center"><FileImage className="w-4 h-4" /></span>
                Account images
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Showing first {filteredPhotos.length} images</span>
                <a
                  href="#"
                  className="text-xs text-[#3CCED7] hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    handleTabChange('account');
                  }}
                >
                  See all
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Photos Grid */}
        {filteredPhotos.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {filteredPhotos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                section="account"
                isSelected={selectedMedia.has(photo.id)}
                isHovered={hoveredMedia?.id === photo.id && hoveredMedia?.section === 'account'}
                onSelect={toggleMediaSelection}
                onMouseEnter={(photoId, section) => setHoveredMedia({ id: photoId, section })}
                onMouseLeave={() => {
                  setHoveredMedia(null);
                  handlePreviewHide(setPreviewMedia);
                }}
                onPreviewShow={(photoId, position) => handlePreviewShow(photoId, position, setPreviewMedia)}
                onPreviewHide={() => handlePreviewHide(setPreviewMedia)}
              />
            ))}
          </div>
        )}

        {/* Recommended Images Section - only in All tab */}
        {showSections && filteredPhotos.filter(p => !p.isUploading && !p.uploadError).length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm flex items-center">
                <span className="mr-2 w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center"><Star className="w-4 h-4" /></span>
                Recommended images
                <Info className="w-3 h-3 ml-1 text-gray-400" />
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Showing first {filteredPhotos.filter(p => !p.isUploading).length} images</span>
                <a
                  href="#"
                  className="text-xs text-[#3CCED7] hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    handleTabChange('recommended');
                  }}
                >
                  See all
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {filteredPhotos.filter(p => !p.isUploading && !p.uploadError).map(photo => (
                <PhotoCard
                  key={`rec-${photo.id}`}
                  photo={photo}
                  section="recommended"
                  isSelected={selectedMedia.has(photo.id)}
                  isHovered={hoveredMedia?.id === photo.id && hoveredMedia?.section === 'recommended'}
                  onSelect={toggleMediaSelection}
                  onMouseEnter={(photoId, section) => setHoveredMedia({ id: photoId, section })}
                  onMouseLeave={() => {
                    setHoveredMedia(null);
                    handlePreviewHide(setPreviewMedia);
                  }}
                  onPreviewShow={(photoId, position) => handlePreviewShow(photoId, position, setPreviewMedia)}
                  onPreviewHide={() => handlePreviewHide(setPreviewMedia)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAccountTab = () => {
    // For images, show photo grid
    if (mediaType === 'image') {
      // Check if we have a search query but no results
      const hasSearchQuery = searchQuery.trim().length > 0;
      
      if (photos.length === 0) {
        return (
          <div className="h-full flex items-center justify-center">
            {/* Empty State */}
            <div className="flex flex-col items-center justify-center">
              <div className="mb-6">
                <FileImage className="w-20 h-20 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Your account has no images</h3>
              <p className="text-gray-600 text-sm">Upload images from your computer.</p>
            </div>
          </div>
        );
      }

      // If searching and no results, show search empty state
      if (hasSearchQuery && filteredPhotos.length === 0) {
        return (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-6">
                <FileImage className="w-20 h-20 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No images match your search</h3>
              <p className="text-gray-600 text-sm">We couldn't find any images that match your search. Try adjusting your filters or searching for something else.</p>
            </div>
          </div>
        );
      }

      return renderPhotoGrid(false);
    }

    // For videos, show video grid
    if (videos.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          {/* Empty State */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-6">
              <SquarePlay className="w-20 h-20 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Your account has no videos</h3>
            <p className="text-gray-600 text-sm">Upload videos from your computer.</p>
          </div>
        </div>
      );
    }

    // Render videos grid
    return (
      <div className="flex flex-wrap gap-4">
        {videos.map(video => (
          <VideoCard
            key={video.id}
            video={video}
            isSelected={selectedMedia.has(video.id)}
            isHovered={hoveredMedia?.id === video.id}
            onSelect={toggleMediaSelection}
            onMouseEnter={(videoId) => setHoveredMedia({ id: videoId })}
            onMouseLeave={() => {
              setHoveredMedia(null);
              handlePreviewHide(setPreviewMedia);
            }}
            onPreviewShow={(videoId, position) => handlePreviewShow(videoId, position, setPreviewMedia)}
            onPreviewHide={() => handlePreviewHide(setPreviewMedia)}
          />
        ))}
      </div>
    );
  };

  const renderUrlTab = () => (
    <div className="h-full flex flex-col items-center justify-center overflow-y-auto">
      {/* Content */}
      <div className="flex flex-col items-center justify-center">
        {/* Directly copied from facebook */}
        <div className="mb-6">
          <i
            className="inline-block"
            style={{
              backgroundImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/yL/r/WAs8F6EkDPQ.png")',
              backgroundPosition: '-251px -251px',
              backgroundSize: '401px 502px',
              width: '87px',
              height: '90px',
              backgroundRepeat: 'no-repeat',
              display: 'inline-block'
            }}
            aria-label="No media illustration"
          />
        </div>

        <p className="text-gray-700 text-sm text-center mb-6">
          {mediaType === 'video'
            ? 'Quickly upload a video by pasting the link of a hosted video file.'
            : 'Quickly upload an image by pasting the link of a hosted image file.'}
        </p>

        {/* Media URL Input */}
        <div className="w-full space-y-4">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              {mediaType === 'video' ? 'Video URL' : 'Image URL'}
              <Info className="w-3 h-3 ml-1 text-gray-400" />
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={`Paste the link of your ${mediaType} file`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              Title • Optional
              <Info className="w-3 h-3 ml-1 text-gray-400" />
            </label>
            <div className="relative">
              <input
                type="text"
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                placeholder={`Name your ${mediaType} file`}
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent text-sm"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                {mediaTitle.length}/50
              </span>
            </div>
          </div>

          <button
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${mediaUrl.trim()
              ? 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            disabled={!mediaUrl.trim()}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );

  const renderAllTab = () => {
    const hasSearchQuery = searchQuery.trim().length > 0;
    
    if (photos.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-6">
              <FileImage className="w-20 h-20 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No images found</h3>
            <p className="text-gray-600 text-sm">Upload images to get started.</p>
          </div>
        </div>
      );
    }

    // If searching and no results, show search empty state
    if (hasSearchQuery && filteredPhotos.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-6">
              <FileImage className="w-20 h-20 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No images match your search</h3>
            <p className="text-gray-600 text-sm">We couldn't find any images that match your search. Try adjusting your filters or searching for something else.</p>
          </div>
        </div>
      );
    }

    return renderPhotoGrid(true);
  };

  const renderRecommendedTab = () => {
    const hasSearchQuery = searchQuery.trim().length > 0;
    
    if (photos.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-6">
              <Star className="w-20 h-20 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No recommended images</h3>
            <p className="text-gray-600 text-sm">We'll show recommended images here when available.</p>
          </div>
        </div>
      );
    }

    // If searching and no results, show search empty state
    if (hasSearchQuery && filteredPhotos.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-6">
              <FileImage className="w-20 h-20 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No images match your search</h3>
            <p className="text-gray-600 text-sm">We couldn't find any images that match your search. Try adjusting your filters or searching for something else.</p>
          </div>
        </div>
      );
    }

    return renderPhotoGrid(false);
  };


  const renderTabContent = () => {
    if (mediaType === 'video') {
      switch (activeTab) {
        case 'account':
          return renderAccountTab();
        case 'video-url':
          return renderUrlTab();
        default:
          return renderAccountTab();
      }
    } else {
      switch (activeTab) {
        case 'all':
          return renderAllTab();
        case 'account':
          return renderAccountTab();
        case 'recommended':
          return renderRecommendedTab();
        default:
          return renderAllTab();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-white rounded-md shadow-xl w-full max-w-5xl h-[80vh] sm:h-[85vh] md:h-[90vh] flex flex-col overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 flex-shrink-0 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-base font-semibold">
            {mediaType === 'video' ? 'Select videos' : 'Select images'}
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex-shrink-0 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex px-6 space-x-2">
            {mediaType === 'video' ? (
              <>
                <button
                  onClick={() => handleTabChange('account')}
                  className={`flex items-center px-3 py-2 rounded-sm text-sm font-medium transition-colors relative ${activeTab === 'account'
                    ? 'border-[#3CCED7] text-[#3CCED7] bg-[#3CCED7]/15 hover:bg-blue-200 font-semibold'
                    : 'border-transparent hover:bg-gray-100'
                    }`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Account
                </button>
                <button
                  onClick={() => handleTabChange('video-url')}
                  className={`flex items-center px-3 py-2 rounded-sm text-sm font-medium transition-colors ${activeTab === 'video-url'
                    ? 'border-[#3CCED7] text-[#3CCED7] bg-[#3CCED7]/15 hover:bg-blue-200 font-semibold'
                    : 'border-transparent hover:bg-gray-100'
                    }`}
                >
                  <FolderInput className="w-4 h-4 mr-2" />
                  Video URL
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleTabChange('all')}
                  className={`flex items-center px-3 py-2 rounded-sm text-sm font-medium transition-colors relative ${activeTab === 'all'
                    ? 'border-[#3CCED7] text-[#3CCED7] bg-[#3CCED7]/15 hover:bg-blue-200 font-semibold'
                    : 'border-transparent hover:bg-gray-100'
                    }`}
                >
                  <FileImage className="w-4 h-4 mr-2" />
                  All
                </button>
                <button
                  onClick={() => handleTabChange('account')}
                  className={`flex items-center px-3 py-2 rounded-sm text-sm font-medium transition-colors ${activeTab === 'account'
                    ? 'border-[#3CCED7] text-[#3CCED7] bg-[#3CCED7]/15 hover:bg-blue-200 font-semibold'
                    : 'border-transparent hover:bg-gray-100'
                    }`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Account
                </button>
                <button
                  onClick={() => handleTabChange('recommended')}
                  className={`flex items-center px-3 py-2 rounded-sm text-sm font-medium transition-colors ${activeTab === 'recommended'
                    ? 'border-[#3CCED7] text-[#3CCED7] bg-[#3CCED7]/15 hover:bg-blue-200 font-semibold'
                    : 'border-transparent hover:bg-gray-100'
                    }`}
                >
                  <Star className="w-4 h-4 mr-2" />
                  Recommended
                </button>
              </>
            )}
          </div>
        </div>

        {/* Top Controls */}
        <div className={`flex items-center space-x-3 px-6 py-3 border-b border-gray-300 flex-shrink-0 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex-1">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${(disableTopControls || isUploading) ? 'text-gray-300' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Search media"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={disableTopControls || isUploading}
                className={`w-full pl-10 ${searchQuery ? 'pr-10' : 'pr-4'} py-2 border border-gray-300 rounded-md text-sm ${(disableTopControls || isUploading)
                    ? 'bg-gray-100 cursor-not-allowed text-gray-400'
                    : 'focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent'
                  }`}
              />
              {searchQuery && !disableTopControls && !isUploading && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <button
            disabled={disableTopControls || isUploading}
            className={`flex items-center px-3 py-2 border rounded-sm transition-colors text-sm ${(disableTopControls || isUploading)
                ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-300'
                : 'hover:bg-gray-200 border-gray-400'
              }`}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>

          <button
            onClick={handleUploadClick}
            disabled={disableTopControls || disableUploadOnly || isUploading}
            className={`flex items-center px-3 py-2 border rounded-sm transition-colors text-sm ${(disableTopControls || disableUploadOnly || isUploading)
                ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-300'
                : 'hover:bg-gray-200 border-gray-400'
              }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </button>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={mediaType === 'video' 
              ? "video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/x-flv,video/webm" 
              : "image/jpeg,image/jpg,image/png,image/gif,image/webp"
            }
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Content - This will take remaining space and scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>

        {/* Selected Images Bar - Shows above footer when images are selected */}
        {selectedMedia.size > 0 && mediaType === 'image' && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Selected images ({selectedMedia.size} of {Math.min(10, photos.filter(p => !p.isUploading).length)})
                </h4>
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-3">
              {Array.from(selectedMedia).slice(0, 10).map(photoId => {
                const photo = photos.find(p => p.id === photoId);
                if (!photo || photo.isUploading) return null;
                return (
                  <div
                    key={photoId}
                    className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-[#3CCED7] flex-shrink-0"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Selected'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedMedia.size > 0 && mediaType === 'video' && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Selected videos ({selectedMedia.size} of {Math.min(10, videos.filter(v => !v.isUploading).length)})
                </h4>
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-3">
              {Array.from(selectedMedia).slice(0, 10).map(videoId => {
                const video = videos.find(v => v.id === videoId);
                if (!video || video.isUploading) return null;
                return (
                  <div
                    key={videoId}
                    className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-[#3CCED7] flex-shrink-0"
                  >
                    <video
                      src={video.url}
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer - Fixed at bottom */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 flex-shrink-0 bg-white border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (mediaType === 'image') {
                const selectedPhotos = photos.filter(photo => selectedMedia.has(photo.id));
                onContinue(selectedPhotos);
              } else {
                const selectedVideos = videos.filter(video => selectedMedia.has(video.id));
                onContinue(selectedVideos);
              }
            }}
            disabled={selectedMedia.size === 0 || isUploading}
            className={`px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-md transition-colors ${(selectedMedia.size === 0 || isUploading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#2AB5BD]'}`}
          >
            Continue
          </button>
        </div>

        {/* Media Preview Tooltip */}
        {previewMedia && (
          <div 
            className="fixed z-[10000]"
            style={{
              left: `${previewMedia.position.x}px`,
              top: `${previewMedia.position.y}px`
            }}
            onMouseEnter={handlePreviewEnter}
            onMouseLeave={() => handlePreviewLeave(setPreviewMedia)}
          >
            <div className="bg-white rounded-lg p-2 shadow-2xl border-2 border-gray-200 overflow-hidden" data-preview-container>
              {mediaType === 'image' ? (
                <img
                  src={photos.find(p => p.id === previewMedia.id)?.url}
                  alt="Preview"
                  className="object-contain"
                  style={{ maxWidth: '400px', maxHeight: '500px' }}
                />
              ) : (
                <div className="relative" style={{ maxWidth: '400px', maxHeight: '500px' }}>
                  <video
                    src={videos.find(v => v.id === previewMedia.id)?.url}
                    autoPlay
                    loop
                    muted
                    controls={false}
                    className="object-contain max-w-full max-h-[500px]"
                  />

                  {/* Simple controls overlay */}
                  <VideoControls />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}