import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import { DocsPageContent } from '@/components/home/PublicSeoPages';

export const metadata: Metadata = {
  title: 'Docs | Marketing Simplified',
  description: 'Learn Marketing Simplified workflows for campaigns, AI Agent analysis, platform integrations, decisions, meetings, and policy response.',
};

export default function DocsPage() {
  return (
    <PublicPageShell>
      <DocsPageContent />
    </PublicPageShell>
  );
}
