'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { GoogleAd, GoogleAdsAPI } from '@/lib/api/googleAdsApi';
import Toolbar from './Toolbar';
import ShareModal from './ShareModal';
import PreviewModal from './PreviewModal';
import PlacementCard from './PlacementCard';
import MobileCardFrame from './MobileCardFrame';
import Toast from './Toast';
import { encodeSharePayload, decodeSharePayload, resolveShareBaseUrl, SharePayload } from './share-utils';

interface AdPreviewShellProps {
  ad: GoogleAd;
}

type SurfaceType = 'ALL' | 'DISPLAY' | 'GMAIL' | 'YOUTUBE';
type DeviceType = 'MOBILE' | 'DESKTOP';

interface Variant {
  id: string;
  locked?: boolean;
  kind: 'LANDSCAPE' | 'SQUARE';
  variantKey?: string;
  surface?: 'DISPLAY' | 'GMAIL' | 'YOUTUBE';
}

export default function AdPreviewShell({ ad }: AdPreviewShellProps) {
  const [surface, setSurface] = useState<SurfaceType>('ALL');
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

    if (data.surface) setSurface(data.surface);
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
    currentSurface: SurfaceType,
    currentDevice: DeviceType,
    days: number,
    previewToken?: string | null,
    previewExpiresAt?: string | null
  ) => {
    const token = previewToken ?? currentPreviewToken;
    if (!token) return '';

    const expMs = Date.now() + days * 24 * 60 * 60 * 1000;
    const sharePayload: SharePayload = {
      surface: currentSurface,
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
      const link = generateShareLink(surface, device, shareDays, preview.token, preview.expiration_date_time ?? null);
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

  const displayAdInfo = ad.responsive_display_ad;
  
  const variants: Variant[] = useMemo(() => {
    if (!displayAdInfo) {
      return [
        { id: 'v1', locked: true, kind: 'LANDSCAPE' },
        { id: 'v2', locked: true, kind: 'SQUARE' },
      ];
    }

    const hasImages = (displayAdInfo.marketing_images?.length ?? 0) > 0;
    const hasSquareImages = (displayAdInfo.square_marketing_images?.length ?? 0) > 0;
    const hasHeadlines = (displayAdInfo.headlines?.length ?? 0) > 0;
    const hasDescriptions = (displayAdInfo.descriptions?.length ?? 0) > 0;
    const logoImage = displayAdInfo.logo_images?.[0];
    const squareLogo = displayAdInfo.square_logo_images?.[0];

    const allVariants = [
      { key: 'mobile.landscape.image-headline-logo-desc-arrow', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // A
      { key: 'mobile.portrait.hero-logo-title-desc-buttons', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // B
      { key: 'mobile.landscape.logo-headline-arrow', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // C
      { key: 'mobile.landscape.overlay-headline-desc-business-arrow', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // D
      { key: 'mobile.portrait.dark-hero-title-desc-biz-buttons', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // E
      { key: 'mobile.landscape.image-headline-logo-desc-arrow', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // F (same as A)
      { key: 'mobile.sheet.logo-biz-title-desc-innerimage-ctabar', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // G
      // { key: 'mobile.landscape.centered-whitecard', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // H (temporarily disabled)
      { key: 'mobile.landscape.title-desc-biz-textcta', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // I
      { key: 'mobile.landscape.image-plus-whitecard-below', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // J
      { key: 'mobile.portrait.dark-hero-biz-title-desc-innerimage-pillcta', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // K
      { key: 'mobile.landscape.logo-longheadline-biz-textcta', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // L
      { key: 'mobile.landscape.image-logo-title-desc-biz-textcta', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // M
      { key: 'mobile.inline.thumb-longheadline-adbiz-button', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // N
      { key: 'mobile.inline.thumb-title-desc-adbiz-button', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // O
      { key: 'mobile.inline.thumb-title-adbiz-button', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // P
      { key: 'mobile.inline.header-title-thumbgrid-desc-adbiz-button', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // Q
      { key: 'mobile.inline.header-title-thumb-desc-adbiz-button', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // R
      { key: 'mobile.inline.whitecard-logo-title-desc-biz-cta', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // S
      { key: 'mobile.sheet.logo-title-biz-desc-buttons', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // T
      { key: 'mobile.inline.inlinebox-title-desc-fab-footer', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // U
      { key: 'mobile.inline.darkcard-title-desc-fab-footer', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // V
      { key: 'mobile.landscape.video-title-logo-desc-button', kind: 'LANDSCAPE' as const, surface: 'DISPLAY' as const }, // W
      { key: 'mobile.sheet.dark-logo-title-desc-videothumb-buttons', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // X
      { key: 'mobile.sheet.light-logoTitle-desc-video-cta', kind: 'SQUARE' as const, surface: 'DISPLAY' as const }, // Y
      { key: 'gmail.promotions.row-sponsored-biz-headline-desc', kind: 'SQUARE' as const, surface: 'GMAIL' as const }, // G1
      { key: 'gmail.promotions.row-sponsored-biz-desc-headline', kind: 'SQUARE' as const, surface: 'GMAIL' as const }, // G2
      { key: 'gmail.promotions.row-sponsored-biz-headline-image', kind: 'SQUARE' as const, surface: 'GMAIL' as const }, // G3
      { key: 'youtube.feed.left-thumb-right-text', kind: 'SQUARE' as const, surface: 'YOUTUBE' as const }, // Y1
      { key: 'youtube.home.ad-card', kind: 'SQUARE' as const, surface: 'YOUTUBE' as const }, // Y2
    ];

    return allVariants.map((variant, index) => {
      const isLandscape = variant.kind === 'LANDSCAPE';
      const isGmailVariant = variant.surface === 'GMAIL';
      const isYouTubeVariant = variant.surface === 'YOUTUBE';
      const needsImages = isLandscape ? hasImages : hasSquareImages;
      const hasLogo = (logoImage || squareLogo) !== undefined;
      
      // Gmail variants need logo and text assets (G3 also needs image)
      if (isGmailVariant) {
        const isG3Variant = variant.key === 'gmail.promotions.row-sponsored-biz-headline-image';
        const hasImage = hasImages || hasSquareImages;
        const locked = !(hasLogo && hasHeadlines && (isG3Variant ? hasImage : hasDescriptions));
        return {
          id: `v${index + 1}`,
          locked,
          kind: variant.kind,
          variantKey: variant.key,
          surface: variant.surface,
        };
      }
      
      // YouTube variants need logo, headline, and image
      if (isYouTubeVariant) {
        const isY2Variant = variant.key === 'youtube.home.ad-card';
        const hasImage = hasImages || hasSquareImages;
        // Y2 needs headline, description, and image (no logo)
        // Y1 needs logo, headline, and image
        const locked = isY2Variant 
          ? !(hasHeadlines && hasDescriptions && hasImage)
          : !(hasLogo && hasHeadlines && hasImage);
        return {
          id: `v${index + 1}`,
          locked,
          kind: variant.kind,
          variantKey: variant.key,
          surface: variant.surface,
        };
      }
      
      // Display variants need images and text assets
      const locked = !(needsImages && hasHeadlines && hasDescriptions);
      
      return {
        id: `v${index + 1}`,
        locked,
        kind: variant.kind,
        variantKey: variant.key,
        surface: variant.surface,
      };
    });
  }, [displayAdInfo]);

  const filteredVariants = useMemo(() => {
    if (surface === 'ALL') {
      return variants;
    }
    return variants.filter(v => v.surface === surface);
  }, [variants, surface]);

  const title = displayAdInfo?.long_headline?.text || displayAdInfo?.headlines?.[0]?.text || 'Headline';
  const description = displayAdInfo?.descriptions?.[0]?.text || 'Description';
  const cta = displayAdInfo?.call_to_action_text || 'Learn more';
  const business = displayAdInfo?.business_name || 'Ad';

  const cardWidth = 320;
  const gap = 16;
  const scrollAmount = cardWidth + gap;

  const updateCurrentIndex = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollLeft = container.scrollLeft;
    const index = Math.round(scrollLeft / scrollAmount);
    setCurrentIndex(Math.max(0, Math.min(index, filteredVariants.length - 1)));
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
  }, [filteredVariants.length]);

  const handleCopy = async () => {
    const linkToCopy = currentShareLink || generateShareLink(surface, device, shareDays);
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
      const updatedLink = generateShareLink(surface, device, days);
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

      <Toolbar
        surface={surface}
        onSurfaceChange={setSurface}
        onShare={handleShare}
        onPreviewAds={() => setShowCanvas(true)}
        showCanvas={showCanvas}
        disabled={viewOnly}
        banner={banner}
      />

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
            {filteredVariants.map((v) => (
              <div key={v.id} className="flex-shrink-0">
                <MobileCardFrame variantKey={v.variantKey}>
                  <PlacementCard
                    locked={v.locked}
                    kind={v.kind}
                    title={title}
                    description={description}
                    cta={cta}
                    business={business}
                    ad={ad}
                    variantKey={v.variantKey}
                  />
                </MobileCardFrame>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 pb-4">
            {filteredVariants.map((_, index) => (
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
          surface={surface}
          device={device}
          onSurfaceChange={(newSurface) => {
            setSurface(newSurface);
            if (shareOpen) {
              const updatedLink = generateShareLink(newSurface, device, shareDays);
              setCurrentShareLink(updatedLink);
            }
          }}
          onDeviceChange={(newDevice) => {
            setDevice(newDevice);
            if (shareOpen) {
              const updatedLink = generateShareLink(surface, newDevice, shareDays);
              setCurrentShareLink(updatedLink);
            }
          }}
          variants={filteredVariants}
          ad={ad}
          onClose={() => setShowCanvas(false)}
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
