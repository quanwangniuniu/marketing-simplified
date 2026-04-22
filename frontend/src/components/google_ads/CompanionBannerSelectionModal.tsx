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

interface CompanionBannerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (selectedItems: GoogleAdsPhotoData[]) => void;
  selectedMediaIds?: number[];
}

export default function CompanionBannerSelectionModal({
  isOpen,
  onClose,
  onContinue,
  selectedMediaIds = []
}: CompanionBannerSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'account'>('upload');
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set(selectedMediaIds));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempIdCounter, setTempIdCounter] = useState(0);
  const [hoveredMedia, setHoveredMedia] = useState<{ id: number; section?: string } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ id: number } | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [photos, setPhotos] = useState<GoogleAdsPhotoData[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize selectedMedia from props
  useEffect(() => {
    if (selectedMediaIds.length > 0) {
      setSelectedMedia(new Set(selectedMediaIds));
    }
  }, [selectedMediaIds]);

  // Load photos from API
  const loadPhotos = async () => {
    try {
      setLoading(true);
      const photos = await getGoogleAdsPhotos();
      setPhotos(photos);
    } catch (error) {
      console.error('Failed to load photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPhotos();
    }
  }, [isOpen]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0]; // Only allow one file
    console.log('CompanionBanner: Starting upload for file:', file.name, file.size);
    
    // Validate file size (max 150KB for 300x60 banner)
    if (file.size > 150 * 1024) {
      toast.error('File size must be less than 150KB');
      return;
    }

    // Validate dimensions (should be 300x60)
    const img = new Image();
    img.onload = async () => {
      console.log('CompanionBanner: Image loaded, dimensions:', img.width, 'x', img.height);
      if (img.width !== 300 || img.height !== 60) {
        toast.error('Image size must be exactly 300x60 pixels');
        return;
      }

      setIsUploading(true);
      try {
        console.log('CompanionBanner: Uploading file...');
        const response = await uploadGoogleAdsPhoto(file);
        console.log('CompanionBanner: Upload response:', response);
        if (response.photo) {
          const uploadedPhoto = { ...response.photo!, uploaded: true };
          console.log('CompanionBanner: Adding photo to state:', uploadedPhoto);
          setPhotos(prevPhotos => {
            const newPhotos = [...prevPhotos, uploadedPhoto];
            console.log('CompanionBanner: New photos array:', newPhotos);
            return newPhotos;
          });
          setSelectedMedia(prev => {
            const newSelected = new Set([...prev, response.photo!.id]);
            console.log('CompanionBanner: New selected media:', newSelected);
            return newSelected;
          });
          toast.success('Image uploaded successfully');
        }
      } catch (error) {
        console.error('CompanionBanner: Upload failed:', error);
        toast.error('Upload failed, please try again');
      } finally {
        setIsUploading(false);
      }
    };
    img.onerror = () => {
      console.error('CompanionBanner: Image load error');
      toast.error('Invalid image file');
    };
    img.src = URL.createObjectURL(file);
  };

  const handleMediaSelect = (photoId: number) => {
    const newSelected = new Set(selectedMedia);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      // Only allow one selection for companion banner
      newSelected.clear();
      newSelected.add(photoId);
    }
    setSelectedMedia(newSelected);
  };

  const handleContinue = () => {
    const selectedPhotos = photos.filter(photo => selectedMedia.has(photo.id));
    onContinue(selectedPhotos);
  };

  const handlePreviewShow = (photoId: number) => {
    const photoIndex = photos.findIndex(p => p.id === photoId);
    if (photoIndex !== -1) {
      setCurrentPreviewIndex(photoIndex);
      setPreviewMedia({ id: photoId });
    }
  };

  const handlePreviewHide = () => {
    setPreviewMedia(null);
  };

  const handlePrevImage = () => {
    if (currentPreviewIndex > 0) {
      setCurrentPreviewIndex(currentPreviewIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (currentPreviewIndex < photos.length - 1) {
      setCurrentPreviewIndex(currentPreviewIndex + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevImage();
    if (e.key === 'ArrowRight') handleNextImage();
    if (e.key === 'Escape') handlePreviewHide();
  };

  const selectedPhotos = photos.filter(photo => selectedMedia.has(photo.id));
  const disableContinue = selectedPhotos.length === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Select Companion Banner</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'upload'
                ? 'text-[#3CCED7] border-b-2 border-[#3CCED7]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'account'
                ? 'text-[#3CCED7] border-b-2 border-[#3CCED7]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Asset Library
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'upload' && (
                <div className="space-y-6">
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileImage className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-[#3CCED7] bg-[#3CCED7]/10 hover:bg-[#3CCED7]/15 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Select Image File
                          </>
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        className="hidden"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Supports JPG, PNG format. Must be exactly 300x60 pixels, file size under 150KB
                    </p>
                  </div>

                  {/* Uploaded Photos Grid */}
                  {photos.filter(photo => photo.id < 0 || photo.uploaded).length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Uploaded Images</h3>
                      <div className="grid grid-cols-6 gap-4">
                        {photos.filter(photo => photo.id < 0 || photo.uploaded).map(photo => (
                          <PhotoCard
                            key={photo.id}
                            photo={photo}
                            section="upload"
                            isSelected={selectedMedia.has(photo.id)}
                            isHovered={hoveredMedia?.id === photo.id}
                            onSelect={handleMediaSelect}
                            onMouseEnter={(id) => setHoveredMedia({ id, section: 'upload' })}
                            onMouseLeave={() => setHoveredMedia(null)}
                            onPreviewShow={handlePreviewShow}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'account' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Asset Library</h3>
                  {loading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#3CCED7]" />
                      <p className="mt-2 text-sm text-gray-500">Loading photos...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-4">
                      {photos.map(photo => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          section="account"
                          isSelected={selectedMedia.has(photo.id)}
                          isHovered={hoveredMedia?.id === photo.id}
                          onSelect={handleMediaSelect}
                          onMouseEnter={(id) => setHoveredMedia({ id, section: 'account' })}
                          onMouseLeave={() => setHoveredMedia(null)}
                          onPreviewShow={handlePreviewShow}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Selected {selectedPhotos.length}/1 images
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={disableContinue}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
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

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {photos[currentPreviewIndex]?.caption || `Image ${currentPreviewIndex + 1}`}
              </h3>
              <button
                onClick={handlePreviewHide}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 relative">
              <img
                src={photos[currentPreviewIndex]?.url}
                alt={photos[currentPreviewIndex]?.caption || `Image ${currentPreviewIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onKeyDown={handleKeyDown}
                tabIndex={0}
              />
              
              {/* Navigation arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    disabled={currentPreviewIndex === 0}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-6 w-6 text-gray-700" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    disabled={currentPreviewIndex === photos.length - 1}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-6 w-6 text-gray-700" />
                  </button>
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-500">
              {currentPreviewIndex + 1} / {photos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}