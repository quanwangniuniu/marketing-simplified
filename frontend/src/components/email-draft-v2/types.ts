export type Platform = 'mailchimp' | 'klaviyo';

export const PLATFORM_LABEL: Record<Platform, string> = {
  mailchimp: 'Mailchimp',
  klaviyo: 'Klaviyo',
};

export type KlaviyoStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'sent'
  | 'archived';

export interface EmailDraftRow {
  id: number;
  title: string;
  subject?: string;
  fromName?: string;
  status?: string | null;
  statusLabel?: string;
  updatedAt?: string;
  createdAt?: string;
}
