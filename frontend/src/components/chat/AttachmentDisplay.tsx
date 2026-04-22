'use client';

import { useState } from 'react';
import { Download, ExternalLink, X, Play, FileText, Image as ImageIcon, Film } from 'lucide-react';
import type { MessageAttachment } from '@/types/chat';

interface AttachmentDisplayProps {
  attachments: MessageAttachment[];
  isOwnMessage?: boolean;
}

export default function AttachmentDisplay({ attachments, isOwnMessage = false }: AttachmentDisplayProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const handleDownload = async (attachment: MessageAttachment) => {
    try {
      const response = await fetch(attachment.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(attachment.file_url, '_blank');
    }
  };

  const renderAttachment = (attachment: MessageAttachment) => {
    switch (attachment.file_type) {
      case 'image':
        return (
          <div 
            key={attachment.id}
            className="relative group cursor-pointer"
            onClick={() => setLightboxImage(attachment.file_url)}
          >
            <img
              src={attachment.file_url}
              alt={attachment.original_filename}
              className="max-w-full max-h-64 rounded-lg object-cover shadow-sm"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        );

      case 'video':
        return (
          <div key={attachment.id} className="relative">
            <video
              src={attachment.file_url}
              controls
              className="max-w-full max-h-64 rounded-lg shadow-sm"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'document':
      default:
        return (
          <div
            key={attachment.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              isOwnMessage 
                ? 'bg-[#3CCED7] border-[#3CCED7]' 
                : 'bg-gray-100 border-gray-200'
            }`}
          >
            <div className={`p-2 rounded-lg ${
              isOwnMessage ? 'bg-[#3CCED7]' : 'bg-gray-200'
            }`}>
              <FileText className={`w-5 h-5 ${
                isOwnMessage ? 'text-white' : 'text-gray-600'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${
                isOwnMessage ? 'text-white' : 'text-gray-800'
              }`}>
                {attachment.original_filename}
              </p>
              <p className={`text-xs ${
                isOwnMessage ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {attachment.file_size_display}
              </p>
            </div>
            <button
              onClick={() => handleDownload(attachment)}
              className={`p-2 rounded-lg transition-colors ${
                isOwnMessage 
                  ? 'hover:bg-[#3CCED7] text-white' 
                  : 'hover:bg-gray-200 text-gray-600'
              }`}
              aria-label="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        );
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 mt-2">
        {attachments.map(renderAttachment)}
      </div>

      {/* Lightbox for images */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setLightboxImage(null)}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// Compact version for chat list preview
export function AttachmentPreview({ attachments }: { attachments?: MessageAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const firstAttachment = attachments[0];
  const count = attachments.length;

  const getIcon = () => {
    switch (firstAttachment.file_type) {
      case 'image':
        return <ImageIcon className="w-3 h-3" />;
      case 'video':
        return <Film className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <span className="inline-flex items-center gap-1 text-gray-500">
      {getIcon()}
      <span className="text-xs">
        {count === 1 
          ? firstAttachment.original_filename 
          : `${count} attachments`}
      </span>
    </span>
  );
}

