'use client';

import { useState } from 'react';
import { ExternalLink, Globe, X } from 'lucide-react';
import { linkPreviewImageUrl } from '@/lib/api/chatApi';
import type { MessageLinkPreview } from '@/types/chat';

interface LinkPreviewProps {
  preview: MessageLinkPreview;
  className?: string;
  /** Dismiss this card. Omit to render without a close button. */
  onDismiss?: () => void;
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
 *
 * The thumbnail is loaded through our own backend rather than straight from the
 * remote host, so viewing a card does not hand a third party the viewer's IP.
 *
 * The close button dismisses the card for this viewer only; the message, the link,
 * and the shared cache are untouched.
 */
export default function LinkPreview({ preview, className = '', onDismiss }: LinkPreviewProps) {
  const { url, title, description, image_url: imageUrl } = preview;
  const [hovered, setHovered] = useState(false);

  // Nothing worth drawing — render as a plain message.
  if (!title && !description && !imageUrl) {
    return null;
  }

  return (
    <div
      className={`relative inline-block w-full mt-2 ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={title ? `Link preview: ${title}` : 'Link preview'}
        className="block rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors bg-white"
      >
        {imageUrl && (
          <div className="relative w-full h-32 overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={linkPreviewImageUrl(imageUrl)}
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

      {onDismiss && (
        <button
          type="button"
          data-testid="dismiss-link-preview"
          aria-label="Remove link preview"
          title="Remove link preview"
          onClick={(e) => {
            // The card is a link; dismissing must not follow it.
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          // Always rendered so keyboard users can reach it; only revealed on hover
          // or focus, and kept clickable throughout so the pointer never "loses" it.
          className={`absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full
            bg-gray-900/60 text-white shadow-sm transition-opacity hover:bg-gray-900/80
            focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]
            ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
