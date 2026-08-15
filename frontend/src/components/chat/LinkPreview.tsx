'use client';

import { ExternalLink, Globe } from 'lucide-react';
import type { MessageLinkPreview } from '@/types/chat';

interface LinkPreviewProps {
  preview: MessageLinkPreview;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Rich card for the first URL in a message (MED-279).
 *
 * The card is pure presentation: the backend resolves OpenGraph metadata off the
 * hot path behind an SSRF guard, caches it per URL, and hands it over on the
 * message payload. The client never fetches a user-supplied URL itself — doing so
 * once per viewer would bypass the shared cache and re-open the SSRF surface.
 */
export default function LinkPreview({ preview, className = '' }: LinkPreviewProps) {
  const { url, title, description, image_url: imageUrl } = preview;

  // Nothing worth drawing — render as a plain message.
  if (!title && !description && !imageUrl) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title ? `Link preview: ${title}` : 'Link preview'}
      className={`block rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors bg-white mt-2 ${className}`}
    >
      {imageUrl && (
        <div className="relative w-full h-32 overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title || 'Link preview'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // A dead or blocked image must not leave an empty grey band.
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <Globe className="w-3 h-3" />
          <span className="truncate">{hostnameOf(url)}</span>
        </div>

        {title && (
          <h4 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">{title}</h4>
        )}

        {description && <p className="text-xs text-gray-600 line-clamp-2">{description}</p>}

        <div className="flex items-center gap-1 text-xs text-[#3CCED7] mt-2">
          <ExternalLink className="w-3 h-3" />
          <span className="truncate">{url}</span>
        </div>
      </div>
    </a>
  );
}
