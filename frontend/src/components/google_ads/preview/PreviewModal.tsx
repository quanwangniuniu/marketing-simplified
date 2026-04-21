'use client';

import React from 'react';
import { Layers, Monitor, MailOpen, Youtube } from 'lucide-react';
import { GoogleAd } from '@/lib/api/googleAdsApi';
import MobileCardFrame from './MobileCardFrame';
import DesktopCardFrame from './DesktopCardFrame';
import PlacementCard from './PlacementCard';

const isValidUrl = (value?: string | null) => typeof value === 'string' && /^(https?:|data:|blob:)/i.test(value);

const pickUrl = (source: Record<string, any> | undefined | null, keys: string[]): string | undefined => {
  if (!source) return undefined;
  for (const key of keys) {
    const val = source[key];
    if (isValidUrl(val)) return val;
  }
  return undefined;
};

const getVideoPreviewUrl = (asset?: any): string | null => {
  if (!asset) return null;
  if (asset.video_id) return `https://www.youtube.com/embed/${asset.video_id}`;
  if (isValidUrl(asset.url)) return asset.url;
  if (typeof asset.asset === 'string') {
    if (isValidUrl(asset.asset)) return asset.asset;
    const ytMatch = asset.asset.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
  }
  return null;
};

const extractYouTubeId = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,})/i);
  return match?.[1];
};

const getImageUrlFromAsset = (asset?: any): string | undefined => {
  if (!asset) return undefined;
  if (isValidUrl(asset.url)) return asset.url;
  if (isValidUrl(asset.asset)) return asset.asset;
  return undefined;
};

const parseDimensions = (meta?: Record<string, any> | null): { width: number; height: number } => {
  if (!meta) return { width: 0, height: 0 };
  const width = Number(
    meta.width ?? meta.frame_width ?? meta.pixel_width ?? meta.video_width ?? meta.render_width ?? meta.original_width ?? 0
  );
  const height = Number(
    meta.height ?? meta.frame_height ?? meta.pixel_height ?? meta.video_height ?? meta.render_height ?? meta.original_height ?? 0
  );
  return { width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0 };
};

type SurfaceType = 'ALL' | 'DISPLAY' | 'GMAIL' | 'YOUTUBE';
type DeviceType = 'MOBILE' | 'DESKTOP';

interface Variant {
  id: string;
  locked?: boolean;
  kind: 'LANDSCAPE' | 'SQUARE';
  variantKey?: string;
  surface?: 'DISPLAY' | 'GMAIL' | 'YOUTUBE';
}

interface PreviewModalProps {
  surface: SurfaceType;
  device: DeviceType;
  onSurfaceChange: (surface: SurfaceType) => void;
  onDeviceChange: (device: DeviceType) => void;
  variants: Variant[];
  ad: GoogleAd;
  onClose: () => void;
  isShared?: boolean;
  hideSurfaceSelector?: boolean;
}

export default function PreviewModal({
  surface,
  device,
  onSurfaceChange,
  onDeviceChange,
  variants,
  ad,
  onClose,
  isShared = false,
  hideSurfaceSelector = false,
}: PreviewModalProps) {
  const displayAdInfo = ad.responsive_display_ad;
  const searchAdInfo = ad.responsive_search_ad;
  const videoAdInfo = ad.video_responsive_ad;
  const legacyVideoAd: any = (ad as any).video_ad || null;

  const primaryVideoAsset = videoAdInfo?.videos?.[0] || legacyVideoAd?.video_asset;
  const companionVideoAsset = videoAdInfo?.companion_banners?.[0] || legacyVideoAd?.format_in_stream?.companion_banner;
  const videoMetadata = primaryVideoAsset ? (primaryVideoAsset as any).asset_metadata || legacyVideoAd?.video_asset_info || undefined : undefined;
  const posterMetadata = companionVideoAsset ? (companionVideoAsset as any).asset_metadata || undefined : undefined;
  const videoPreviewUrl = getVideoPreviewUrl(primaryVideoAsset);
  const metaPosterUrl = pickUrl(videoMetadata, ['poster_url','posterUrl','preview_image_url','previewImageUrl','thumbnail_url','thumbnailUrl','image_url','imageUrl','default_image_url','defaultImageUrl']);
  const companionPosterUrl = getImageUrlFromAsset(companionVideoAsset) || pickUrl(posterMetadata, ['poster_url','posterUrl','preview_image_url','previewImageUrl','thumbnail_url','thumbnailUrl','image_url','imageUrl','default_image_url','defaultImageUrl']);
  const youtubeVideoId =
    primaryVideoAsset?.video_id ||
    extractYouTubeId(primaryVideoAsset?.url) ||
    extractYouTubeId(typeof primaryVideoAsset?.asset === 'string' ? primaryVideoAsset.asset : undefined) ||
    extractYouTubeId(videoPreviewUrl ?? undefined);
  const fallbackPosterUrl = youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : undefined;
  const videoPosterUrl = companionPosterUrl || metaPosterUrl || fallbackPosterUrl;
  const isVideoPreview = !!(videoAdInfo || legacyVideoAd);
  const isSearchPreview = !!searchAdInfo && !isVideoPreview;

  const baseTitle = displayAdInfo?.long_headline?.text || displayAdInfo?.headlines?.[0]?.text || 'Headline';
  const baseDescription = displayAdInfo?.descriptions?.[0]?.text || 'Description';
  const baseCta = displayAdInfo?.call_to_action_text || 'Learn more';
  const baseBusiness = displayAdInfo?.business_name || 'Ad';

  const searchTitle = searchAdInfo?.headlines?.[0]?.text || 'Headline';
  const searchDescription = searchAdInfo?.descriptions?.[0]?.text || 'Description';

  const videoTitle = videoAdInfo?.long_headlines?.[0]?.text
    || videoAdInfo?.headlines?.[0]?.text
    || legacyVideoAd?.format_in_stream?.action_headline
    || baseTitle;
  const videoDescription = videoAdInfo?.descriptions?.[0]?.text
    || legacyVideoAd?.format_in_stream?.description
    || baseDescription;
  const videoCta = videoAdInfo?.call_to_actions?.[0]?.text
    || legacyVideoAd?.format_in_stream?.action_button_label
    || baseCta;
  const videoBusiness = displayAdInfo?.business_name
    || legacyVideoAd?.format_in_stream?.business_name
    || baseBusiness;

  const title = isVideoPreview ? videoTitle : isSearchPreview ? searchTitle : baseTitle;
  const description = isVideoPreview ? videoDescription : isSearchPreview ? searchDescription : baseDescription;
  const cta = isVideoPreview ? videoCta : baseCta;
  const business = isVideoPreview ? videoBusiness : baseBusiness;


  const SURFACES: { value: SurfaceType; label: string; icon: React.ReactNode }[] = [
    {
      value: 'ALL',
      label: 'All',
      icon: (
        <Layers className="w-5 h-5" />
      )
    },
    {
      value: 'DISPLAY',
      label: 'Display',
      icon: (
        <Monitor className="w-5 h-5" />
      )
    },
    {
      value: 'GMAIL',
      label: 'Gmail',
      icon: (
        <MailOpen className="w-5 h-5" />
      )
    },
    {
      value: 'YOUTUBE',
      label: 'YouTube',
      icon: (
        <Youtube className="w-5 h-5" />
      )
    }
  ];

  return (
    <div 
      className={isShared 
        ? 'relative w-full max-w-[95vw] min-h-[95vh] bg-white rounded-lg shadow-xl flex flex-col mx-auto overflow-hidden'
        : 'fixed inset-0 bg-gray-900/45 grid place-items-center z-50 overflow-auto'
      }
      role="dialog" 
      aria-modal="true" 
      aria-label="Preview ads"
      onClick={(e: React.MouseEvent) => {
        if (!isShared && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={isShared 
        ? 'w-full h-full flex flex-col overflow-auto'
        : 'w-[92vw] max-w-[1100px] h-[88vh] max-h-[88vh] bg-white rounded-lg shadow-xl flex flex-col my-4 overflow-hidden'
      }>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="font-semibold text-lg">Preview ads</div>
          <div className="flex items-center gap-4">
            <div className="inline-flex border border-gray-200 rounded-md overflow-hidden" role="group" aria-label="device">
              <button
                className={`p-2 border-none cursor-pointer ${
                  device === 'MOBILE'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 bg-white hover:bg-gray-50'
                }`}
                onClick={() => onDeviceChange('MOBILE')}
                title="Mobile"
                aria-pressed={device === 'MOBILE'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="fill-current">
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <rect x="10" y="18" width="4" height="1.5" fill="#fff" />
                </svg>
              </button>
              <button
                className={`p-2 border-none cursor-pointer ${
                  device === 'DESKTOP'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 bg-white hover:bg-gray-50'
                }`}
                onClick={() => onDeviceChange('DESKTOP')}
                title="Desktop"
                aria-pressed={device === 'DESKTOP'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="fill-current">
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <rect x="9" y="18" width="6" height="2" />
                </svg>
              </button>
            </div>
            {!isShared && (
              <button 
                className="bg-transparent border-none text-2xl text-gray-500 hover:text-gray-700 cursor-pointer"
                onClick={onClose} 
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {!(hideSurfaceSelector || isVideoPreview || isSearchPreview) && (
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="flex items-center justify-center gap-6">
              {SURFACES.map((s) => (
                <button
                  key={s.value}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    surface === s.value
                      ? 'text-[#3CCED7] border-b-2 border-[#3CCED7] pb-1'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                  onClick={() => onSurfaceChange(s.value)}
                >
                  <span className={surface === s.value ? 'text-[#3CCED7]' : 'text-gray-400'}>
                    {s.icon}
                  </span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div 
            className="grid gap-4 justify-items-center w-full"
            style={{
              gridTemplateColumns: device === 'MOBILE' 
                ? 'repeat(auto-fill, minmax(320px, 1fr))'
                : 'repeat(auto-fill, minmax(900px, 1fr))',
              maxWidth: '100%'
            }}
          >
            {variants
              .filter((v) => {
                // Filter out X variant in desktop view
                if (device === 'DESKTOP' && v.variantKey === 'mobile.sheet.dark-logo-title-desc-videothumb-buttons') {
                  return false;
                }
                return true;
              })
              .map((v) => (
              <div key={v.id} className="flex justify-center w-full">
                {device === 'MOBILE' ? (
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
                      videoUrl={isVideoPreview ? videoPreviewUrl ?? undefined : undefined}
                      imageUrl={isVideoPreview ? videoPosterUrl : undefined}
                    />
                  </MobileCardFrame>
                ) : (
                  <DesktopCardFrame variantKey={v.variantKey}>
                    <PlacementCard
                      locked={v.locked}
                      kind={v.kind}
                      title={title}
                      description={description}
                      cta={cta}
                      business={business}
                      ad={ad}
                      variantKey={v.variantKey}
                      videoUrl={isVideoPreview ? videoPreviewUrl ?? undefined : undefined}
                      imageUrl={isVideoPreview ? videoPosterUrl : undefined}
                    />
                  </DesktopCardFrame>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-200">
          <div className="text-gray-500 text-xs text-center">
            Previews shown here are examples and don't include all possible formats. You're responsible for the content of your ads. Please make sure that your provided assets don't violate any Google policies or applicable laws, either individually, or in combination.
          </div>
        </div>
      </div>
    </div>
  );
}
