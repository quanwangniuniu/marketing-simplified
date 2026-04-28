import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import { DocsProductPageContent } from '@/components/home/PublicSeoPages';

export const metadata: Metadata = {
  title: 'Product Docs | Marketing Simplified',
  description: 'Understand Marketing Simplified product modules, ad operations workflows, integrations, and next steps.',
};

export default function DocsProductPage() {
  return (
    <PublicPageShell>
      <DocsProductPageContent />
    </PublicPageShell>
  );
}
