'use client';

import React from 'react';
import { CheckCircle, SquarePlay, Eye } from 'lucide-react';
import { GoogleAdsVideoData } from '@/lib/api/googleAdsMediaApi';

interface VideoCardProps {
  video: GoogleAdsVideoData;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (videoId: number) => void;
  onMouseEnter: (videoId: number, section?: string) => void;
  onMouseLeave: () => void;
  onPreviewShow: (videoId: number) => void;
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
  const handleEyeIconClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onPreviewShow(video.id);
  };

  const handleEyeIconLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onPreviewHide();
  };

  return (
    <div
      className="flex flex-col cursor-pointer"
      onClick={() => onSelect(video.id)}
      onMouseEnter={() => onMouseEnter(video.id)}
      onMouseLeave={onMouseLeave}
    >
      <div className={`relative w-40 h-32 rounded-lg overflow-hidden border-2 transition-all ${
        isSelected
          ? 'border-[#3CCED7] ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}>
        {/* YouTube thumbnail */}
        <img
          src={video.image_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
          alt={video.title || `Video ${video.id}`}
          className="w-full h-full object-cover"
        />

        {/* Eye icon on hover */}
        {isHovered && (
          <div 
            className="absolute bottom-2 left-2 bg-gray-50 rounded-md p-1 shadow-md hover:bg-gray-100 opacity-60 hover:opacity-90 transition-opacity z-10"
            onClick={handleEyeIconClick}
          >
            <Eye className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <SquarePlay className="w-10 h-10 text-white opacity-80" />
        </div>

        {/* Selection checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-white rounded-full p-0.5">
            <CheckCircle className="w-5 h-5 text-[#3CCED7] fill-white" />
          </div>
        )}
      </div>
      <div className="mt-2 text-center">
        <p
          className="text-xs text-gray-900 truncate w-40"
          title={video.title || `video-${video.id}`}
        >
          {video.title || `video-${video.id}`}
        </p>
      </div>
    </div>
  );
}
