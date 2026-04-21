'use client';

import { useState } from 'react';
import FacebookFeedPreview from '@/components/facebook_meta/previews/FacebookFeedPreview';
import TiktokPreview from '@/components/tiktok/TiktokPreview';
import AdPreviewPanel from '@/components/google_ads/preview/AdPreviewPanel';
import type { GoogleAd } from '@/lib/api/googleAdsApi';
import type { AdVariation } from '@/types/adVariation';

type PreviewMode = 'native' | 'facebook' | 'tiktok' | 'google';

const MODES: { value: PreviewMode; label: string }[] = [
  { value: 'native', label: 'Native' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google' },
];

interface Props {
  variation: AdVariation;
}

export default function PreviewBlock({ variation }: Props) {
  const [mode, setMode] = useState<PreviewMode>('native');

  const copyByKey = variation.copyElements.reduce<Record<string, string>>((acc, elem) => {
    acc[elem.elementKey] = elem.value;
    return acc;
  }, {});

  const headlineText =
    copyByKey.headline || copyByKey.subject || copyByKey.cardHeadline || variation.name;
  const bodyText =
    copyByKey.primaryText ||
    copyByKey.body ||
    copyByKey.cardDescription ||
    copyByKey.preheader ||
    '';

  const payloadAsset = (variation.formatPayload as any)?.mediaAssets?.[0];
  const previewUrl =
    variation.formatPayload?.previewUrl ||
    payloadAsset?.thumbnailUrl ||
    variation.formatPayload?.imageUrl ||
    payloadAsset?.fileUrl ||
    variation.formatPayload?.videoUrl ||
    null;
  const previewType = payloadAsset?.fileType || '';
  const videoSrc =
    payloadAsset?.fileUrl ||
    variation.formatPayload?.videoUrl ||
    (previewType.startsWith('video') ? previewUrl : null);
  const videoPoster = payloadAsset?.thumbnailUrl || null;
  const logoUrl =
    (variation.formatPayload as any)?.logoAssets?.[0]?.thumbnailUrl ||
    (variation.formatPayload as any)?.logoAssets?.[0]?.fileUrl ||
    (variation.formatPayload as any)?.logoUrl ||
    null;

  const facebookMedia = previewUrl
    ? {
        id: 0,
        type: (previewType.startsWith('video') ? 'video' : 'photo') as 'video' | 'photo',
        url: previewUrl,
        thumbnail: previewUrl,
        caption: headlineText,
      }
    : null;

  const tiktokCreative = previewUrl
    ? {
        id: 0,
        type: (previewType.startsWith('video') ? 'video' : 'image') as 'video' | 'image',
        url: previewUrl,
        previewUrl,
        fileUrl: previewUrl,
        title: headlineText,
      }
    : null;

  const googlePreviewAd: GoogleAd = {
    name: variation.name,
    type: 'RESPONSIVE_DISPLAY_AD',
    final_urls: ['https://marketingsimplified.com'],
    responsive_display_ad: {
      headlines: [{ text: headlineText || variation.name }],
      long_headline: { text: headlineText || variation.name },
      descriptions: [{ text: bodyText || 'Add ad copy to preview.' }],
      business_name: 'Marketing Simplified',
      marketing_images: previewUrl ? [{ asset: previewUrl, url: previewUrl }] : [],
      square_marketing_images: previewUrl ? [{ asset: previewUrl, url: previewUrl }] : [],
      logo_images: logoUrl ? [{ asset: logoUrl, url: logoUrl }] : [],
      square_logo_images: logoUrl ? [{ asset: logoUrl, url: logoUrl }] : [],
      allow_flexible_color: true,
    },
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">Preview</h2>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                mode === m.value
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {mode === 'native' && (
          <>
            <div className="h-60 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
              {previewUrl ? (
                previewType.startsWith('video') && videoSrc ? (
                  <video
                    src={videoSrc}
                    poster={videoPoster || undefined}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wide text-gray-400">
                  Media preview
                </div>
              )}
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-800">{headlineText || 'Headline'}</p>
              <p className="text-[11px] text-gray-400">marketingsimplified.com</p>
            </div>
          </>
        )}

        {mode === 'facebook' && (
          <div className="flex items-center justify-center">
            {facebookMedia ? (
              <FacebookFeedPreview mediaToShow={facebookMedia} primaryText={bodyText} scale={75} />
            ) : (
              <div className="text-xs text-gray-400">Upload media to preview Facebook feed.</div>
            )}
          </div>
        )}

        {mode === 'tiktok' && (
          <div className="flex items-center justify-center">
            {tiktokCreative ? (
              <TiktokPreview
                creative={tiktokCreative}
                identity={
                  logoUrl
                    ? { avatarUrl: logoUrl, displayName: 'Marketing Simplified Ads', sponsored: true }
                    : undefined
                }
                text={bodyText}
                allowFullscreen={false}
                enablePlacementSwitch={false}
              />
            ) : (
              <div className="text-xs text-gray-400">Upload media to preview TikTok.</div>
            )}
          </div>
        )}

        {mode === 'google' && (
          <div className="max-h-[520px] overflow-y-auto">
            <AdPreviewPanel ad={googlePreviewAd} />
          </div>
        )}
      </div>
    </section>
  );
}
