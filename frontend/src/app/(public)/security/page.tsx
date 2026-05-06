import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import SecurityPage from '@/components/legal/SecurityPage';

export const metadata: Metadata = {
  title: 'Security | Marketing Simplified',
  description:
    'How Marketing Simplified approaches security for workspace and campaign data: access, encryption, integrations, and resilience. Links to full platform policy.',
};

export default function SecurityRoute() {
  return (
    <PublicPageShell>
      <SecurityPage />
    </PublicPageShell>
  );
}
