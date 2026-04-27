import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import { DocsPricingPageContent } from '@/components/home/PublicSeoPages';

export const metadata: Metadata = {
  title: 'Pricing Docs | Marketing Simplified',
  description: 'Compare Marketing Simplified plan tiers, usage drivers, rollout needs, and pricing questions.',
};

export default function DocsPricingPage() {
  return (
    <PublicPageShell>
      <DocsPricingPageContent />
    </PublicPageShell>
  );
}
