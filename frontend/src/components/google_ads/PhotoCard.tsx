'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Search } from 'lucide-react';
import { GoogleAdsPhotoData } from '@/lib/api/googleAdsMediaApi';

interface PhotoCardProps {
  photo: GoogleAdsPhotoData;
  section: 'account' | 'recommended' | 'upload';
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (photoId: number) => void;
  onMouseEnter: (photoId: number, section?: string) => void;
  onMouseLeave: () => void;
  onPreviewShow: (photoId: number) => void;
}

interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: string;
  orientation: 'landscape' | 'portrait' | 'square';
}

export default function PhotoCard({
  photo,
  section,
  isSelected,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onPreviewShow
}: PhotoCardProps) {
  console.log(`PhotoCard ${photo.id} rendered - isSelected:`, isSelected);
  
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(true);

  // Load image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = (width / height).toFixed(2);
      
      let orientation: 'landscape' | 'portrait' | 'square';
      if (width > height) {
        orientation = 'landscape';
      } else if (height > width) {
        orientation = 'portrait';
      } else {
        orientation = 'square';
      }
      
      setImageDimensions({
        width,
        height,
        aspectRatio: `${aspectRatio}:1`,
        orientation
      });
      setIsLoadingDimensions(false);
    };
    img.onerror = () => {
      setIsLoadingDimensions(false);
    };
    img.src = photo.url;
  }, [photo.url]);
  const handleMagnifyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onPreviewShow(photo.id);
  };

  return (
    <div
      className="flex flex-col cursor-pointer"
      onClick={() => {
        console.log('PhotoCard clicked, photo.id:', photo.id);
        onSelect(photo.id);
      }}
      onMouseEnter={() => onMouseEnter(photo.id, section)}
      onMouseLeave={onMouseLeave}
    >
      <div className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
        isSelected
          ? 'border-[#3CCED7] ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}>
        <img
          src={photo.url}
          alt={photo.caption || `Photo ${photo.id}`}
          className="w-full h-full object-cover"
        />

        {/* Magnify icon on hover */}
        {isHovered && (
          <div 
            className="absolute bottom-2 left-2 bg-gray-50 rounded-md p-1 shadow-md hover:bg-gray-100 opacity-60 hover:opacity-90 transition-opacity z-10 cursor-pointer"
            onClick={handleMagnifyClick}
          >
            <Search className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Selection checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-white rounded-full p-0.5">
            <CheckCircle className="w-5 h-5 text-[#3CCED7] fill-white" />
          </div>
        )}
      </div>
      <div className="mt-2 text-center">
        <p
          className="text-xs text-gray-900 truncate w-24"
          title={photo.url.split('/').pop() || `image-${photo.id}`}
        >
          {photo.url.split('/').pop() || `image-${photo.id}`}
        </p>
        
        {/* Image dimensions and aspect ratio */}
        {isLoadingDimensions ? (
          <div className="mt-1">
            <div className="text-xs text-gray-400">Loading...</div>
          </div>
        ) : imageDimensions ? (
          <div className="mt-1">
            <div className="text-xs text-gray-600">
              {imageDimensions.orientation === 'landscape' ? 'Horizontal' : 
               imageDimensions.orientation === 'portrait' ? 'Portrait' : 'Square'} ({imageDimensions.aspectRatio})
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <div className="text-xs text-gray-400">Unknown size</div>
          </div>
        )}
      </div>
    </div>
  );
}
