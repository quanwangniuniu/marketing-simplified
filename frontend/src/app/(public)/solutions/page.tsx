import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import { SolutionsPageContent } from '@/components/home/PublicSeoPages';

export const metadata: Metadata = {
  title: 'Solutions | Marketing Simplified',
  description: 'See how Marketing Simplified supports media buyers, creative operations, performance marketers, agencies, and marketing leaders.',
};

export default function SolutionsPage() {
  return (
    <PublicPageShell>
      <SolutionsPageContent />
    </PublicPageShell>
  );
}
