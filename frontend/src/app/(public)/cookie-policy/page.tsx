import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import CookiePolicyPage from '@/components/legal/CookiePolicyPage';

export const metadata: Metadata = {
  title: 'Cookie Policy | Marketing Simplified',
  description:
    'How Marketing Simplified uses cookies and similar technologies on our public marketing site, and where to find related platform policy information.',
};

export default function CookiePolicyRoute() {
  return (
    <PublicPageShell>
      <CookiePolicyPage />
    </PublicPageShell>
  );
}
