import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import PrivacyPage from '@/components/legal/PrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | Marketing Simplified',
  description:
    'Privacy Policy for Marketing Simplified, including data collection, use, sharing, retention, rights, and contact pathways.',
};

export default function PrivacyRoute() {
  return (
    <PublicPageShell>
      <PrivacyPage />
    </PublicPageShell>
  );
}
