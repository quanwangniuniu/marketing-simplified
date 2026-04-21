import type { CreativeType } from '@/types/adVariation';

export interface CreativeFieldSpec {
  key: string;
  label: string;
  multiline?: boolean;
}

export const CREATIVE_FIELDS: Record<CreativeType, CreativeFieldSpec[]> = {
  image: [
    { key: 'headline', label: 'Headline' },
    { key: 'primaryText', label: 'Primary Text', multiline: true },
  ],
  video: [
    { key: 'headline', label: 'Headline' },
    { key: 'primaryText', label: 'Primary Text', multiline: true },
  ],
  carousel: [
    { key: 'cardHeadline', label: 'Card Headline' },
    { key: 'cardDescription', label: 'Card Description', multiline: true },
  ],
  collection: [
    { key: 'headline', label: 'Headline' },
    { key: 'primaryText', label: 'Primary Text', multiline: true },
    { key: 'collectionTitle', label: 'Collection Title' },
  ],
  email: [
    { key: 'subject', label: 'Subject' },
    { key: 'preheader', label: 'Preheader' },
    { key: 'body', label: 'Body', multiline: true },
  ],
};
