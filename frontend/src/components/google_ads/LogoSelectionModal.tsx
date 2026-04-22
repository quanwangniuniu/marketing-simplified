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
import PhotoCard from './PhotoCard';
import toast from 'react-hot-toast';

interface LogoSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (selectedItems: any[]) => void;
  selectedMediaIds?: number[];
  maxSelection?: number;
}

const LogoSelectionModal: React.FC<LogoSelectionModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  selectedMediaIds = [],
  maxSelection = 5
}) => {
  const [photos, setPhotos] = useState<GoogleAdsPhotoData[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set(selectedMediaIds));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempIdCounter, setTempIdCounter] = useState(0);
  const [hoveredMedia, setHoveredMedia] = useState<{ id: number; section?: string } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ id: number } | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ [key: number]: { width: number; height: number; aspectRatio: string; orientation: string } }>({});
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const tabs = [
    { id: 'account', label: 'Asset Library', icon: FolderInput },
    { id: 'upload', label: 'Upload', icon: Upload }
  ];
  const [activeTab, setActiveTab] = useState('account');

  // Load photos when modal opens
  useEffect(() => {
    console.log('=== useEffect for loadPhotos ===');
    console.log('isOpen:', isOpen, 'activeTab:', activeTab);
    if (isOpen && activeTab === 'account') {
      console.log('Calling loadPhotos...');
      loadPhotos();
    }
  }, [isOpen, activeTab]);

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
    if (!isOpen || activeTab !== 'upload') {
      setIsDragOver(false);
    }
  }, [isOpen, activeTab]);

  const loadPhotos = async () => {
    try {
      console.log('=== loadPhotos called ===');
      console.log('Current photos count before load:', photos.length);
      const response = await getGoogleAdsPhotos();
      console.log('Photos loaded from API:', response.length);
      setPhotos(response);
      console.log('Photos set to state, new count:', response.length);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const handleUploadClick = () => {
    if (isUploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    console.log('=== handleFileUpload ===');
    console.log('Files to upload:', files.length);
    console.log('Current tempIdCounter:', tempIdCounter);
    console.log('Current photos count:', photos.length);

    setIsUploading(true);
    try {
      for (const file of files) {
        const tempId = tempIdCounter - 1;
        console.log('Generated tempId:', tempId);
        setTempIdCounter(tempId);
        
        const tempPhoto = {
          id: tempId,
          url: URL.createObjectURL(file),
          caption: file.name,
          created_at: new Date().toISOString()
        };

        console.log('Adding tempPhoto to photos:', tempPhoto);
        setPhotos(prevPhotos => {
          const newPhotos = [tempPhoto, ...prevPhotos];
          console.log('New photos array length:', newPhotos.length);
          return newPhotos;
        });
        setSelectedMedia(prev => new Set([...prev, tempId]));

        try {
          uploadGoogleAdsPhoto(file, file.name).then(response => {
            if (response.success && response.photo) {
              setPhotos(prevPhotos => prevPhotos.map(p => 
                p.id === tempId ? { ...response.photo!, uploaded: true } : p
              ));
              setSelectedMedia(prev => {
                const newSet = new Set(prev);
                newSet.delete(tempId);
                newSet.add(response.photo!.id);
                return newSet;
              });
            }
          }).catch(error => {
            console.error('Failed to upload photo:', error);
            toast.error(`Failed to upload ${file.name}`);
          });
        } catch (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await processFiles(Array.from(files));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
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

    await processFiles(files);
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
        const photo = photos.find(p => p.id === mediaId);
        if (photo) {
          loadImageDimensions(photo);
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
    const photo = photos.find(p => p.id === mediaId);
    if (photo) {
      loadImageDimensions(photo);
    }
  };

  const handlePreviousImage = () => {
    if (!previewMedia) return;
    
    const currentIndex = photos.findIndex(item => item.id === previewMedia.id);
    if (currentIndex > 0) {
      const previousItem = photos[currentIndex - 1];
      setPreviewMedia({ id: previousItem.id });
      loadImageDimensions(previousItem);
    }
  };

  const handleNextImage = () => {
    if (!previewMedia) return;
    
    const currentIndex = photos.findIndex(item => item.id === previewMedia.id);
    if (currentIndex < photos.length - 1) {
      const nextItem = photos[currentIndex + 1];
      setPreviewMedia({ id: nextItem.id });
      loadImageDimensions(nextItem);
    }
  };

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

  // validate logo selection requirements
  const validateLogoSelection = () => {
    console.log('=== validateLogoSelection ===');
    console.log('selectedMedia:', selectedMedia);
    console.log('imageDimensions:', imageDimensions);
    
    const selectedPhotos = photos.filter(p => selectedMedia.has(p.id));
    console.log('selectedPhotos:', selectedPhotos);
    
    // check total limit
    if (selectedPhotos.length > maxSelection) {
      console.log('Exceeds max selection limit:', selectedPhotos.length, '>', maxSelection);
      return false;
    }
    
    // For logos, we only need to check the count limit
    const result = selectedPhotos.length > 0;
    console.log('Final validation result:', result);
    return result;
  };

  const handleContinue = () => {
    const selectedItems = photos.filter(p => selectedMedia.has(p.id));
    onContinue(selectedItems);
  };

  // Update disableContinue based on selection
  useEffect(() => {
    console.log('=== useEffect for disableContinue ===');
    const isValid = validateLogoSelection();
    console.log('Validation result:', isValid);
    console.log('Setting disableContinue to:', !isValid);
    setDisableContinue(!isValid);
  }, [selectedMedia, photos, maxSelection, imageDimensions]);

  const [disableContinue, setDisableContinue] = useState(true);

  // Keyboard navigation for preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewMedia) return;
      
      if (e.key === 'ArrowLeft') {
        handlePreviousImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
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
            Select Logos
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
                
                <div className="grid grid-cols-6 gap-4">
                  {photos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        section="account"
                        isSelected={selectedMedia.has(photo.id)}
                        isHovered={hoveredMedia?.id === photo.id && hoveredMedia?.section === 'account'}
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
                  <h3 className="text-lg font-medium">Upload Logos</h3>
                  <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="text-[#3CCED7] px-4 py-2 rounded-lg hover:bg-[#3CCED7]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {isUploading ? 'Uploading...' : 'Upload Logos'}
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

                <div className="grid grid-cols-6 gap-4">
                  {photos
                    .filter(photo => photo.id < 0 || photo.uploaded) // Show temporary uploads and uploaded photos
                    .map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        section="upload"
                        isSelected={selectedMedia.has(photo.id)}
                        isHovered={hoveredMedia?.id === photo.id && hoveredMedia?.section === 'upload'}
                        onSelect={handleMediaSelect}
                        onMouseEnter={handleMediaMouseEnter}
                        onMouseLeave={handleMediaMouseLeave}
                        onPreviewShow={handlePreviewShow}
                      />
                    ))}
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
                At most {maxSelection} logos allowed
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
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
                      const currentItem = photos.find(item => item.id === previewMedia.id);
                      return currentItem ? (
                        <span className="break-words max-w-md">
                          {currentItem.url.split('/').pop() || `logo-${currentItem.id}`}
                        </span>
                      ) : (
                        'Logo Preview'
                      );
                    })()}
                  </h3>
                  {(() => {
                    const currentIndex = photos.findIndex(item => item.id === previewMedia.id);
                    return (
                      <span className="text-sm text-gray-500">
                        {currentIndex + 1} of {photos.length}
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
              {/* Image Details Sidebar */}
              <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto">
                {(() => {
                  const photo = photos.find(p => p.id === previewMedia.id);
                  return photo ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Logo Details</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Type:</span>
                            <div className="text-gray-600">Logo</div>
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
                })()}
              </div>

              {/* Main Image Display */}
              <div className="flex-1 flex items-center justify-center p-6 relative">
                {(() => {
                  const photo = photos.find(p => p.id === previewMedia.id);
                  return photo ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || `Logo ${photo.id}`}
                      className="max-w-full max-h-full object-contain"
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                  ) : (
                    <div className="text-gray-500">Logo not found</div>
                  );
                })()}

                {/* Navigation Arrows */}
                {(() => {
                  const currentIndex = photos.findIndex(item => item.id === previewMedia.id);
                  const hasPrevious = currentIndex > 0;
                  const hasNext = currentIndex < photos.length - 1;
                  
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogoSelectionModal;
