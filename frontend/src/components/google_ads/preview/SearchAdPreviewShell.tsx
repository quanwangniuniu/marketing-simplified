'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { GoogleAd, GoogleAdsAPI } from '@/lib/api/googleAdsApi';
import ShareModal from './ShareModal';
import PreviewModal from './PreviewModal';
import PlacementCard from './PlacementCard';
import MobileCardFrame from './MobileCardFrame';
import Toast from './Toast';
import { encodeSharePayload, decodeSharePayload, resolveShareBaseUrl, SharePayload } from './share-utils';

interface SearchAdPreviewShellProps {
  ad: GoogleAd;
}

type DeviceType = 'MOBILE' | 'DESKTOP';

interface Variant {
  id: string;
  locked?: boolean;
  kind: 'LANDSCAPE' | 'SQUARE';
  variantKey?: string;
}

export default function SearchAdPreviewShell({ ad }: SearchAdPreviewShellProps) {
  const [device, setDevice] = useState<DeviceType>('MOBILE');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDays, setShareDays] = useState<number>(14);
  const [toastOpen, setToastOpen] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentShareLink, setCurrentShareLink] = useState<string>('');
  const [currentPreviewToken, setCurrentPreviewToken] = useState<string | null>(null);
  const [previewExpiration, setPreviewExpiration] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const [viewOnly, setViewOnly] = useState(false);
  const [expired, setExpired] = useState(false);
  const [shareGenerationDate, setShareGenerationDate] = useState<Date | null>(null);
  const [shareExpirationDays, setShareExpirationDays] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (!token) return;

    const data = decodeSharePayload(token);
    if (!data) return;

    if (data.device) setDevice(data.device);
    setViewOnly(true);

    if (data.exp) {
      const now = Date.now();
      if (now > data.exp) {
        setExpired(true);
      } else {
        const daysRemaining = Math.ceil((data.exp - now) / (1000 * 60 * 60 * 24));
        setShareExpirationDays(daysRemaining);
        if (data.created) {
          setShareGenerationDate(new Date(data.created));
        }
      }
    }
  }, []);

  const generateShareLink = (
    currentDevice: DeviceType,
    days: number,
    previewToken?: string | null,
    previewExpiresAt?: string | null
  ) => {
    const token = previewToken ?? currentPreviewToken;
    if (!token) return '';
    const expMs = Date.now() + days * 24 * 60 * 60 * 1000;
    const sharePayload: SharePayload = {
      surface: 'DISPLAY',
      device: currentDevice,
      exp: expMs,
      created: Date.now(),
      ad_id: ad.id,
      previewToken: token,
    };

    const expirationSource = previewExpiresAt ?? previewExpiration;
    if (expirationSource) {
      const timestamp = new Date(expirationSource).getTime();
      if (!Number.isNaN(timestamp)) {
        sharePayload.previewExpiresAt = timestamp;
      }
    }

    const baseUrl = resolveShareBaseUrl();
    const url = new URL('/google_ads/preview/share', `${baseUrl}/`);
    const payload = encodeSharePayload(sharePayload);
    url.searchParams.set('share', payload);
    return url.toString();
  };

  const handleShare = async () => {
    if (!ad.id || shareLoading) return;

    try {
      setShareLoading(true);
      const preview = await GoogleAdsAPI.createPreview(ad.id, { device_type: device });
      setCurrentPreviewToken(preview.token);
      setPreviewExpiration(preview.expiration_date_time ?? null);
      const link = generateShareLink(device, shareDays, preview.token, preview.expiration_date_time ?? null);
    setCurrentShareLink(link);
    setShareOpen(true);
    } catch (error) {
      console.error('Failed to create share preview:', error);
    } finally {
      setShareLoading(false);
    }
  };

  const banner = viewOnly
    ? expired
      ? 'This shared link has expired. Refresh or generate a new one.'
      : shareExpirationDays !== null
        ? `View-only preview • This shareable link will expire in ${shareExpirationDays} day${shareExpirationDays !== 1 ? 's' : ''}`
        : 'View-only preview • Only you can edit the ad'
    : null;

  const searchAdInfo = ad.responsive_search_ad;
  
  const variants: Variant[] = useMemo(() => {
    if (!searchAdInfo) {
      return [
        { id: 'v1', locked: true, kind: 'LANDSCAPE' },
        { id: 'v2', locked: true, kind: 'SQUARE' },
      ];
    }

    const hasHeadlines = (searchAdInfo.headlines?.length ?? 0) > 0;
    const hasDescriptions = (searchAdInfo.descriptions?.length ?? 0) > 0;

    const allVariants = [
      { key: 'search.mobile.standard-3line', kind: 'LANDSCAPE' as const },
    ];

    return allVariants.map((variant, index) => {
      const locked = !(hasHeadlines && hasDescriptions);
      
      return {
        id: `v${index + 1}`,
        locked,
        kind: variant.kind,
        variantKey: variant.key,
      };
    });
  }, [searchAdInfo]);

  const headline1 = searchAdInfo?.headlines?.[0]?.text || 'First headline';
  const headline2 = searchAdInfo?.headlines?.[1]?.text || 'Second headline';
  const headline3 = searchAdInfo?.headlines?.[2]?.text || 'Third headline';
  const description = searchAdInfo?.descriptions?.[0]?.text || 'Description';
  const displayUrl = ad.display_url || 'example.com';
  const path1 = searchAdInfo?.path1 || '';
  const path2 = searchAdInfo?.path2 || '';

  const cardWidth = 320;
  const gap = 16;
  const scrollAmount = cardWidth + gap;

  const updateCurrentIndex = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollLeft = container.scrollLeft;
    const index = Math.round(scrollLeft / scrollAmount);
    setCurrentIndex(Math.max(0, Math.min(index, variants.length - 1)));
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const currentScroll = container.scrollLeft;
      const targetScroll = Math.max(0, currentScroll - scrollAmount);
      
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
      
      setTimeout(updateCurrentIndex, 300);
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const currentScroll = container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;
      const targetScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
      
      setTimeout(updateCurrentIndex, 300);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        updateCurrentIndex();
      }, 100);
    };

    container.addEventListener('scroll', handleScroll);
    updateCurrentIndex();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [variants.length]);

  const handleCopy = async () => {
    const linkToCopy = currentShareLink || generateShareLink(device, shareDays);
    if (!linkToCopy) return;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(linkToCopy);
        setToastOpen(true);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = linkToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setToastOpen(true);
      } catch (err) {
        console.error('Failed to copy:', err);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const handleDaysChange = (days: number) => {
    setShareDays(days);
    if (shareOpen) {
      const updatedLink = generateShareLink(device, days);
      setCurrentShareLink(updatedLink);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {viewOnly && shareGenerationDate && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
          Generation date: {shareGenerationDate.toLocaleDateString()}
        </div>
      )}

      <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
        {banner && (
          <div className="px-4 py-2 bg-[#3CCED7]/10 border-b border-[#3CCED7]/30 text-sm text-gray-700">
            {banner}
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <div></div>

          <div className="flex items-center gap-4">
            <button
              className={`text-sm font-medium cursor-pointer ${
                viewOnly
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-[#3CCED7] hover:text-[#1a9ba3]'
              }`}
              onClick={handleShare}
              disabled={viewOnly}
            >
              Share
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer ${
                showCanvas
                  ? 'bg-[#3CCED7]/15 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => setShowCanvas(true)}
              disabled={viewOnly}
            >
              Preview ads
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 cursor-pointer"
          aria-label="Scroll left"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex flex-col h-full">
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto overflow-y-hidden px-12 py-4"
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {variants.map((v) => (
              <div key={v.id} className="flex-shrink-0">
                <MobileCardFrame variantKey={v.variantKey}>
                  <PlacementCard
                    locked={v.locked}
                    kind={v.kind}
                    title={headline1}
                    description={description}
                    cta="Learn more"
                    business={displayUrl}
                    ad={ad}
                    variantKey={v.variantKey}
                  />
                </MobileCardFrame>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 pb-4">
            {variants.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (scrollContainerRef.current) {
                    const scrollAmount = (cardWidth + gap) * index;
                    scrollContainerRef.current.scrollTo({
                      left: scrollAmount,
                      behavior: 'smooth'
                    });
                    setTimeout(updateCurrentIndex, 300);
                  }
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-[#3CCED7] w-6'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 cursor-pointer"
          aria-label="Scroll right"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {showCanvas && (
        <PreviewModal
          surface="ALL"
          device={device}
          onSurfaceChange={() => {}}
          onDeviceChange={(newDevice) => {
            setDevice(newDevice);
            if (shareOpen) {
              const updatedLink = generateShareLink(newDevice, shareDays);
              setCurrentShareLink(updatedLink);
            }
          }}
          variants={variants}
          ad={ad}
          onClose={() => setShowCanvas(false)}
          hideSurfaceSelector={true}
        />
      )}

      {shareOpen && (
        <ShareModal
          link={currentShareLink}
          days={shareDays}
          onDaysChange={handleDaysChange}
          onClose={() => setShareOpen(false)}
          onCopy={handleCopy}
          viewOnlyNote={
            previewExpiration
              ? `Link expires on ${new Date(previewExpiration).toLocaleString()}`
              : undefined
          }
        />
      )}

      <Toast
        open={toastOpen}
        message="Link copied"
        onClose={() => setToastOpen(false)}
      />

      <div className="text-gray-500 text-xs text-center pb-3">
        Previews shown here are examples and don't include all possible formats.
      </div>
    </div>
  );
}

