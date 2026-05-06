import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import TermsPage from '@/components/legal/TermsPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Marketing Simplified',
  description:
    'Terms of Service for Marketing Simplified, including service use, account responsibilities, billing, liability, and related legal references.',
};

export default function TermsRoute() {
  return (
    <PublicPageShell>
      <TermsPage />
    </PublicPageShell>
  );
}
