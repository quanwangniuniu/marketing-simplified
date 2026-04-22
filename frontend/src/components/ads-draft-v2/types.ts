export type Platform = 'facebook_meta' | 'tiktok' | 'google_ads';

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook_meta: 'Facebook Meta',
  tiktok: 'TikTok',
  google_ads: 'Google Ads',
};

export type FacebookStatus = 'ACTIVE' | 'IN_PROCESS' | 'WITH_ISSUES' | 'DELETED';

export type GoogleAdsStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'PAUSED';

export type AdStatus = FacebookStatus | GoogleAdsStatus;

export type ActionBarVariant = 'primary' | 'ghost' | 'danger';
