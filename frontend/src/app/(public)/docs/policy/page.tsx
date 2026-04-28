import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import { DocsPolicyPageContent } from '@/components/home/PublicSeoPages';

export const metadata: Metadata = {
  title: 'Policy Docs | Marketing Simplified',
  description: 'Review Marketing Simplified data use, privacy, connected account, platform responsibility, and security guidance.',
};

export default function DocsPolicyPage() {
  return (
    <PublicPageShell>
      <DocsPolicyPageContent />
    </PublicPageShell>
  );
}
