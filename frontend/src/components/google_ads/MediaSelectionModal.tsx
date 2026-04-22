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
  VolumeX
} from 'lucide-react';
import { uploadGoogleAdsPhoto, getGoogleAdsPhotos, GoogleAdsPhotoData } from '@/lib/api/googleAdsMediaApi';
import { createGoogleAdsVideo, getGoogleAdsVideos, GoogleAdsVideoData } from '@/lib/api/googleAdsMediaApi';
import PhotoCard from './PhotoCard';
import VideoCard from './VideoCard';
import toast from 'react-hot-toast';

interface MediaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (selectedItems: any[]) => void;
  mediaType: 'video' | 'image';
  selectedMediaIds?: number[]; // IDs of already selected media items
  maxSelection?: number; // 15 for images, 5 for logos, 1 for videos
  imageType?: 'landscape' | 'square' | 'both';
}

type VideoSource = 'video-url';
type ImageSource = 'account' | 'upload';
type MediaSource = VideoSource | ImageSource;

export default function MediaSelectionModal({
  isOpen,
  onClose,
  onContinue,
  mediaType,
  selectedMediaIds = [],
  maxSelection = 15,
  imageType = 'both'
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
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="p-1 hover:bg-white/10 rounded"
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="flex-1 h-1.5 appearance-none bg-white/30 rounded outline-none cursor-pointer [accent-color:#3b82f6]"
          />

          <div className="text-xs w-16 text-right tabular-nums">
            {formatTime(currentTime)}/{formatTime(duration)}
          </div>

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

  // Video mode only shows YouTube URL input, no Asset Library label
  const tabs = mediaType === 'video' 
    ? [{ id: 'video-url' as const, label: 'YouTube URL' }]
    : [
        { id: 'account' as const, label: 'Asset Library' },
        { id: 'upload' as const, label: 'Upload' }
      ];

  const [activeTab, setActiveTab] = useState<MediaSource>(mediaType === 'video' ? 'video-url' : 'account');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [disableContinue, setDisableContinue] = useState(true);
  const [photos, setPhotos] = useState<GoogleAdsPhotoData[]>([]);
  const [videos, setVideos] = useState<GoogleAdsVideoData[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set(selectedMediaIds));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempIdCounter, setTempIdCounter] = useState(0);
  const [hoveredMedia, setHoveredMedia] = useState<{ id: number; section?: string } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ id: number } | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ [key: number]: { width: number; height: number; aspectRatio: string; orientation: string } }>({});
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Load photos when modal opens or tab changes (for images)
  useEffect(() => {
    if (isOpen && mediaType === 'image' && activeTab === 'account') {
      loadPhotos();
    }
  }, [isOpen, mediaType, activeTab]);

  // Load videos when modal opens or tab changes (for videos)
  useEffect(() => {
    if (isOpen && mediaType === 'video' && activeTab === 'video-url') {
      loadVideos();
    }
  }, [isOpen, mediaType, activeTab]);

  // Preload image dimensions when photos are loaded
  useEffect(() => {
    if (photos.length > 0) {
      photos.forEach(photo => {
        loadImageDimensions(photo);
      });
    }
  }, [photos]);

  // Update selectedMedia when selectedMediaIds prop changes (only if provided)
  useEffect(() => {
    console.log('useEffect triggered - selectedMediaIds:', selectedMediaIds);
    if (selectedMediaIds && selectedMediaIds.length > 0) {
      console.log('Updating selectedMedia from prop:', selectedMediaIds);
      setSelectedMedia(new Set(selectedMediaIds));
    }
  }, [selectedMediaIds]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'upload' || mediaType !== 'image') {
      setIsDragOver(false);
    }
  }, [isOpen, activeTab, mediaType]);

  const loadPhotos = async () => {
    try {
      console.log('Loading photos...');
      const response = await getGoogleAdsPhotos();
      console.log('Photos loaded:', response);
      setPhotos(response);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const response = await getGoogleAdsVideos();
      setVideos(response);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleUploadClick = () => {
    if (isUploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processImageFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const placeholderPhotos: GoogleAdsPhotoData[] = files.map((file, index) => ({
      id: -(tempIdCounter + index + 1),
      url: URL.createObjectURL(file),
      caption: '',
      image_hash: ''
    }));

    setTempIdCounter(prev => prev + files.length);

    setPhotos(prev => [...placeholderPhotos, ...prev]);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const placeholderId = placeholderPhotos[i].id;

        try {
          const result = await uploadGoogleAdsPhoto(file);
          if (result.success && result.photo) {
            setPhotos(prev =>
              prev.map(p =>
                p.id === placeholderId
                  ? result.photo!
                  : p
              )
            );
          }
        } catch (error) {
          console.error('Upload failed:', error);
          toast.error('Upload failed');
          setPhotos(prev => prev.filter(p => p.id !== placeholderId));
          URL.revokeObjectURL(placeholderPhotos[i].url);
        }
      }
    } finally {
      setIsUploading(false);
      placeholderPhotos.forEach(p => URL.revokeObjectURL(p.url));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (mediaType === 'image') {
      await processImageFiles(Array.from(files));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (mediaType !== 'image') return;
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (mediaType !== 'image') return;
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    if (mediaType !== 'image') return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    if (isUploading) return;

    const files = Array.from(event.dataTransfer?.files ?? []).filter(file =>
      file.type.startsWith('image')
    );

    if (files.length === 0) {
      toast.error('Please drag image files');
      return;
    }

    await processImageFiles(files);
  };

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleAddVideo = async () => {
    if (!mediaUrl.trim()) {
      toast.error('Please enter a YouTube URL');
      return;
    }

    if (!validateYouTubeUrl(mediaUrl)) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    try {
      const result = await createGoogleAdsVideo(mediaUrl, mediaTitle);
      if (result.success && result.video) {
        setVideos(prev => [result.video!, ...prev]);
        setMediaUrl('');
        setMediaTitle('');
        toast.success('Video added successfully');
      }
    } catch (error) {
      console.error('Failed to add video:', error);
      toast.error('Failed to add video');
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
        
        // Load image dimensions when selecting an image
        if (mediaType === 'image') {
          const photo = photos.find(p => p.id === mediaId);
          if (photo) {
            loadImageDimensions(photo);
          }
        }
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
    // Load image dimensions when preview is shown
    if (mediaType === 'image') {
      const photo = photos.find(p => p.id === mediaId);
      if (photo) {
        loadImageDimensions(photo);
      }
    }
  };

  const handlePreviewHide = () => {
    setPreviewMedia(null);
  };

  // Navigation functions for preview
  const handlePreviousImage = () => {
    if (!previewMedia) return;
    
    const currentMedia = mediaType === 'image' ? photos : videos;
    const currentIndex = currentMedia.findIndex(item => item.id === previewMedia.id);
    
    if (currentIndex > 0) {
      const previousItem = currentMedia[currentIndex - 1];
      setPreviewMedia({ id: previousItem.id });
      if (mediaType === 'image') {
        loadImageDimensions(previousItem);
      }
    }
  };

  const handleNextImage = () => {
    if (!previewMedia) return;
    
    const currentMedia = mediaType === 'image' ? photos : videos;
    const currentIndex = currentMedia.findIndex(item => item.id === previewMedia.id);
    
    if (currentIndex < currentMedia.length - 1) {
      const nextItem = currentMedia[currentIndex + 1];
      setPreviewMedia({ id: nextItem.id });
      if (mediaType === 'image') {
        loadImageDimensions(nextItem);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewMedia) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handlePreviewHide();
      }
    };

    if (previewMedia) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [previewMedia, photos, videos, mediaType]);

  // Load image dimensions for preview
  const loadImageDimensions = (photo: any) => {
    if (imageDimensions[photo.id]) return; // Already loaded
    
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = (width / height).toFixed(2);
      
      let orientation: string;
      if (width > height) {
        orientation = 'landscape';
      } else if (height > width) {
        orientation = 'portrait';
      } else {
        orientation = 'square';
      }
      
      setImageDimensions(prev => ({
        ...prev,
        [photo.id]: {
          width,
          height,
          aspectRatio: `${aspectRatio}:1`,
          orientation
        }
      }));
    };
    img.src = photo.url;
  };

  // validate image type requirements
  const validateImageSelection = () => {
    console.log('=== validateImageSelection ===');
    console.log('mediaType:', mediaType);
    console.log('imageType:', imageType);
    console.log('selectedMedia:', selectedMedia);
    console.log('imageDimensions:', imageDimensions);
    
    if (mediaType !== 'image' || imageType !== 'both') {
      console.log('Not image type or not both - returning:', selectedMedia.size > 0);
      return selectedMedia.size > 0;
    }
    
    const selectedPhotos = photos.filter(p => selectedMedia.has(p.id));
    console.log('selectedPhotos:', selectedPhotos);
    
    // check total limit
    if (selectedPhotos.length > maxSelection) {
      console.log('Exceeds max selection limit:', selectedPhotos.length, '>', maxSelection);
      return false;
    }
    
    // check landscape and square image requirements
    if (imageType === 'both') {
      let hasLandscape = false;
      let hasSquare = false;
      
      selectedPhotos.forEach(photo => {
        const dimensions = imageDimensions[photo.id];
        console.log(`Photo ${photo.id} dimensions:`, dimensions);
        if (dimensions) {
          if (dimensions.orientation === 'landscape') {
            hasLandscape = true;
            console.log('Found landscape image:', photo.id);
          } else if (dimensions.orientation === 'square') {
            hasSquare = true;
            console.log('Found square image:', photo.id);
          }
        }
      });
      
      console.log('hasLandscape:', hasLandscape, 'hasSquare:', hasSquare);
      const result = hasLandscape && hasSquare;
      console.log('Final validation result:', result);
      return result;
    }
    
    console.log('Returning selectedPhotos.length > 0:', selectedPhotos.length > 0);
    return selectedPhotos.length > 0;
  };

  const handleContinue = () => {
    const selectedItems = mediaType === 'image' 
      ? photos.filter(p => selectedMedia.has(p.id))
      : videos.filter(v => selectedMedia.has(v.id));
    
    onContinue(selectedItems);
  };

  // Update disableContinue based on selection
  useEffect(() => {
    console.log('=== useEffect for disableContinue ===');
    const isValid = validateImageSelection();
    console.log('Validation result:', isValid);
    console.log('Setting disableContinue to:', !isValid);
    setDisableContinue(!isValid);
  }, [selectedMedia, photos, imageType, maxSelection, imageDimensions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-[#3CCED7]">
            Select Images
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
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#3CCED7] text-[#3CCED7]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {mediaType === 'image' ? (
              <>
                {activeTab === 'account' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Asset Library</h3>
                    </div>
                    
                    <div className="grid grid-cols-6 gap-4">
                      {photos.map((photo) => (
                          <PhotoCard
                            key={photo.id}
                            photo={photo}
                            section="account"
                            isSelected={selectedMedia.has(photo.id)}
                            isHovered={hoveredMedia?.id === photo.id}
                            onSelect={handleMediaSelect}
                            onMouseEnter={handleMediaMouseEnter}
                            onMouseLeave={handleMediaMouseLeave}
                            onPreviewShow={handlePreviewShow}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {activeTab === 'upload' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Upload Images</h3>
                      <button
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 text-[#3CCED7] rounded-lg hover:bg-[#3CCED7]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="w-4 h-4" />
                        {isUploading ? 'Uploading...' : 'Upload Images'}
                      </button>
                    </div>

                    <div
                      className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                        isDragOver
                          ? 'border-[#3CCED7] bg-[#3CCED7]/10 text-[#3CCED7]'
                          : 'border-gray-300 bg-gray-50 text-gray-600'
                      } ${isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={handleUploadClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleUploadClick();
                        }
                      }}
                      onDragEnter={handleDragOver}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      aria-disabled={isUploading}
                    >
                      <Upload className="w-8 h-8" />
                      <div className="text-base font-medium">Drag images here</div>
                      <div className="text-sm text-gray-500">
                        or click to select files (supports multiple selection)
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    <div className="grid grid-cols-6 gap-4">
                      {photos.map((photo) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          section="upload"
                          isSelected={selectedMedia.has(photo.id)}
                          isHovered={hoveredMedia?.id === photo.id}
                          onSelect={handleMediaSelect}
                          onMouseEnter={handleMediaMouseEnter}
                          onMouseLeave={handleMediaMouseLeave}
                          onPreviewShow={handlePreviewShow}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {activeTab === 'video-url' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">YouTube Videos</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <input
                          type="text"
                          placeholder="Enter YouTube URL..."
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Video title (optional)"
                          value={mediaTitle}
                          onChange={(e) => setMediaTitle(e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
                        />
                        <button
                          onClick={handleAddVideo}
                          className="px-4 py-2 bg-[#3CCED7] text-white rounded-lg hover:bg-[#2AB5BD]"
                        >
                          Add Video
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        {videos.map((video) => (
                          <VideoCard
                            key={video.id}
                            video={video}
                            isSelected={selectedMedia.has(video.id)}
                            isHovered={hoveredMedia?.id === video.id}
                            onSelect={handleMediaSelect}
                            onMouseEnter={handleMediaMouseEnter}
                            onMouseLeave={handleMediaMouseLeave}
                            onPreviewShow={handlePreviewShow}
                            onPreviewHide={handlePreviewHide}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedMedia.size} of {maxSelection} selected
            {imageType === 'both' && (
              <div className="mt-1 text-xs">
                <div className={(() => {
                  const selectedPhotos = photos.filter(p => selectedMedia.has(p.id));
                  let hasLandscape = false;
                  selectedPhotos.forEach(photo => {
                    const dimensions = imageDimensions[photo.id];
                    if (dimensions && dimensions.orientation === 'landscape') {
                      hasLandscape = true;
                    }
                  });
                  return hasLandscape ? 'text-green-600' : 'text-red-600';
                })()}>
                  At least 1 landscape image is required
                </div>
                <div className={(() => {
                  const selectedPhotos = photos.filter(p => selectedMedia.has(p.id));
                  let hasSquare = false;
                  selectedPhotos.forEach(photo => {
                    const dimensions = imageDimensions[photo.id];
                    if (dimensions && dimensions.orientation === 'square') {
                      hasSquare = true;
                    }
                  });
                  return hasSquare ? 'text-green-600' : 'text-red-600';
                })()}>
                  At least 1 square image is required
                </div>
                <div className={selectedMedia.size <= maxSelection ? 'text-green-600' : 'text-red-600'}>
                  At most {maxSelection} images allowed
                </div>
              </div>
            )}
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
              className="px-4 py-2 bg-[#3CCED7] text-white rounded-lg hover:bg-[#2AB5BD] disabled:opacity-50 disabled:cursor-not-allowed"
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
                      const currentMedia = mediaType === 'image' ? photos : videos;
                      const currentItem = currentMedia.find(item => item.id === previewMedia.id);
                      return currentItem ? (
                        <span className="break-words max-w-md">
                          {mediaType === 'image' 
                            ? (currentItem as GoogleAdsPhotoData).url.split('/').pop() || `image-${currentItem.id}`
                            : (currentItem as GoogleAdsVideoData).title || `video-${currentItem.id}`
                          }
                        </span>
                      ) : (
                        `${mediaType === 'image' ? 'Image' : 'Video'} Preview`
                      );
                    })()}
                  </h3>
                  {(() => {
                    const currentMedia = mediaType === 'image' ? photos : videos;
                    const currentIndex = currentMedia.findIndex(item => item.id === previewMedia.id);
                    return (
                      <span className="text-sm text-gray-500">
                        {currentIndex + 1} of {currentMedia.length}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={handlePreviewHide}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Image Details Sidebar */}
              <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto">
                {mediaType === 'image' ? (
                  (() => {
                    const photo = photos.find(p => p.id === previewMedia.id);
                    return photo ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Image Details</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Type:</span>
                              <div className="text-gray-600">Image</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Dimensions:</span>
                              <div className="text-gray-600">
                                {imageDimensions[photo.id] 
                                  ? `${imageDimensions[photo.id].width} × ${imageDimensions[photo.id].height}`
                                  : 'Loading...'
                                }
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Orientation:</span>
                              <div className="text-gray-600">
                                {imageDimensions[photo.id] 
                                  ? (imageDimensions[photo.id].orientation === 'landscape' ? 'Horizontal' : 
                                     imageDimensions[photo.id].orientation === 'portrait' ? 'Portrait' : 'Square')
                                  : 'Loading...'
                                }
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Aspect ratio:</span>
                              <div className="text-gray-600">
                                {imageDimensions[photo.id] 
                                  ? imageDimensions[photo.id].aspectRatio
                                  : 'Loading...'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Video Details</h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Type:</span>
                          <div className="text-gray-600">Video</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Preview Area */}
              <div className="flex-1 p-6 flex items-center justify-center bg-gray-100 relative">
                {/* Navigation Arrows */}
                {(() => {
                  const currentMedia = mediaType === 'image' ? photos : videos;
                  const currentIndex = currentMedia.findIndex(item => item.id === previewMedia.id);
                  const hasPrevious = currentIndex > 0;
                  const hasNext = currentIndex < currentMedia.length - 1;
                  
                  return (
                    <>
                      {/* Previous Arrow */}
                      {hasPrevious && (
                        <button
                          onClick={handlePreviousImage}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all z-10"
                          title="Previous (←)"
                        >
                          <ChevronLeft className="w-6 h-6 text-gray-700" />
                        </button>
                      )}
                      
                      {/* Next Arrow */}
                      {hasNext && (
                        <button
                          onClick={handleNextImage}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all z-10"
                          title="Next (→)"
                        >
                          <ChevronRight className="w-6 h-6 text-gray-700" />
                        </button>
                      )}
                    </>
                  );
                })()}
                
                <div className="max-w-full max-h-full">
                  {mediaType === 'image' ? (
                    <img
                      src={photos.find(p => p.id === previewMedia.id)?.url}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      style={{ maxHeight: 'calc(95vh - 200px)' }}
                    />
                  ) : (
                    <video
                      src={videos.find(v => v.id === previewMedia.id)?.image_url}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      controls
                      autoPlay
                      style={{ maxHeight: 'calc(95vh - 200px)' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Preview Footer */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {mediaType === 'image' ? 'Image' : 'Video'} Preview
                </div>
                <button
                  onClick={handlePreviewHide}
                  className="px-4 py-2 bg-[#3CCED7] text-white rounded-lg hover:bg-[#2AB5BD]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
