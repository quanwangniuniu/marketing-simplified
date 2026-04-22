'use client';

import React from 'react';
import { Loader2, CheckCircle, SquarePlay, Eye } from 'lucide-react';
import { VideoData } from '@/lib/api/facebookMetaVideoApi';

interface VideoCardProps {
  video: VideoData;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (videoId: number) => void;
  onMouseEnter: (videoId: number) => void;
  onMouseLeave: () => void;
  onPreviewShow: (videoId: number, position: { x: number; y: number }) => void;
  onPreviewHide: () => void;
}

export default function VideoCard({
  video,
  isSelected,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onPreviewShow,
  onPreviewHide
}: VideoCardProps) {
  const handleEyeIconHover = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const previewMaxHeight = 500;
    const viewportHeight = window.innerHeight;
    
    // Calculate if preview would go off screen at bottom
    let yPosition = rect.top;
    if (yPosition + previewMaxHeight > viewportHeight) {
      // Position it so it fits in viewport
      yPosition = Math.max(10, viewportHeight - previewMaxHeight - 10);
    }
    
    onPreviewShow(video.id, { x: rect.right + 8, y: yPosition });
  };

  const handleEyeIconLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onPreviewHide();
  };

  return (
    <div
      className="flex flex-col cursor-pointer"
      onClick={() => !video.isUploading && onSelect(video.id)}
      onMouseEnter={() => onMouseEnter(video.id)}
      onMouseLeave={onMouseLeave}
    >
      <div className={`relative w-40 h-32 rounded-lg overflow-hidden border-2 transition-all ${
        video.isUploading
          ? 'border-gray-200'
          : isSelected
            ? 'border-[#3CCED7] ring-2 ring-blue-200'
            : 'border-gray-200 hover:border-gray-300'
      }`}>
        <video
          src={video.url}
          className="w-full h-full object-cover"
        />

        {/* Loading overlay */}
        {video.isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Error overlay */}
        {video.uploadError && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white text-xs p-2">
              <p>Upload failed</p>
            </div>
          </div>
        )}

        {/* Eye icon on hover */}
        {isHovered && !video.isUploading && !video.uploadError && (
          <div 
            className="absolute bottom-2 left-2 bg-gray-50 rounded-md p-1 shadow-md hover:bg-gray-100 opacity-60 hover:opacity-90 transition-opacity z-10"
            onMouseEnter={handleEyeIconHover}
            onMouseLeave={handleEyeIconLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <Eye className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Play icon overlay - only show when not uploading/error */}
        {!video.isUploading && !video.uploadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <SquarePlay className="w-10 h-10 text-white opacity-80" />
          </div>
        )}

        {/* Selection checkmark */}
        {isSelected && !video.isUploading && (
          <div className="absolute top-2 right-2 bg-white rounded-full p-0.5">
            <CheckCircle className="w-5 h-5 text-[#3CCED7] fill-white" />
          </div>
        )}
      </div>
      <div className="mt-2 text-center">
        <p
          className="text-xs text-gray-900 truncate w-40"
          title={video.title || video.url.split('/').pop() || `video-${video.id}`}
        >
          {video.title || video.url.split('/').pop() || `video-${video.id}`}
        </p>
        {video.isUploading && (
          <p className="text-xs text-gray-500">
            Uploading...
          </p>
        )}
      </div>
    </div>
  );
}

