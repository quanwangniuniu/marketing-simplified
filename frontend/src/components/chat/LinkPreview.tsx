'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { fetchLinkPreview, extractUrls, isPreviewableUrl } from '@/lib/api/linkPreviewApi';
import type { LinkPreview as LinkPreviewType } from '@/types/chat';

interface LinkPreviewProps {
  content: string;
  className?: string;
}

interface SingleLinkPreviewProps {
  url: string;
  className?: string;
}

/**
 * Single link preview card
 */
function SingleLinkPreview({ url, className = '' }: SingleLinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPreview = async () => {
      // Validate URL first
      if (!url || typeof url !== 'string') {
        setLoading(false);
        return;
      }

      try {
        if (!isPreviewableUrl(url)) {
          setLoading(false);
          return;
        }

        const data = await fetchLinkPreview(url);
        if (mounted) {
          setPreview(data);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Error loading link preview:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      mounted = false;
    };
  }, [url]);

  // Don't render anything while loading or on error
  if (loading || error || !preview) {
    return null;
  }

  // Don't render if no meaningful content
  if (!preview.title && !preview.description && !preview.image) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors bg-white ${className}`}
    >
      {preview.image && (
        <div className="relative w-full h-32 overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.image}
            alt={preview.title || 'Link preview'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3">
        {/* Site name */}
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <Globe className="w-3 h-3" />
          <span className="truncate">{preview.site_name || (() => { try { return new URL(url).hostname; } catch { return url; } })()}</span>
        </div>
        
        {/* Title */}
        {preview.title && (
          <h4 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
            {preview.title}
          </h4>
        )}
        
        {/* Description */}
        {preview.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {preview.description}
          </p>
        )}
        
        {/* Link indicator */}
        <div className="flex items-center gap-1 text-xs text-[#3CCED7] mt-2">
          <ExternalLink className="w-3 h-3" />
          <span className="truncate">{url}</span>
        </div>
      </div>
    </a>
  );
}

/**
 * Component to display link previews extracted from message content
 */
export default function LinkPreview({ content, className = '' }: LinkPreviewProps) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const extractedUrls = extractUrls(content);
    // Only preview first 3 URLs to avoid too many requests
    setUrls(extractedUrls.slice(0, 3));
  }, [content]);

  if (urls.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 mt-2 ${className}`}>
      {urls.map((url, index) => (
        <SingleLinkPreview key={`${url}-${index}`} url={url} />
      ))}
    </div>
  );
}

