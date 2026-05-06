import type { BlogCardType } from '@/components/blog/BlogCard';
import { blogPublicImageAt } from '@/components/blog/blogPublicImages';

/** Fields align with `BlogCard` so the explore grid matches category sections. */
export type BlogExploreMoreItem = {
  image: string;
  type: BlogCardType;
  title: string;
  excerpt: string;
  author: string;
  time: string;
  href: string;
};

export const blogExploreMoreItems: BlogExploreMoreItem[] = [
  {
    image: blogPublicImageAt(0),
    type: 'Product development life cycle',
    title: 'Documentation hub',
    excerpt:
      'Start from the public docs home: campaign setup, AI agent workflows, spreadsheet analysis, and decisions follow-up—the same sections wired in docsNavigation.',
    author: 'Marketing Simplified',
    time: 'May 4, 2026',
    href: '/docs',
  },
  {
    image: blogPublicImageAt(1),
    type: 'Product development life cycle',
    title: 'Product & modules',
    excerpt:
      'What Marketing Simplified is, core workflows, domain modules (tasks, campaigns, decisions, spreadsheets), and integrations such as Google Ads, Meta, Slack, and Zoom.',
    author: 'Marketing Simplified',
    time: 'May 4, 2026',
    href: '/docs/product',
  },
  {
    image: blogPublicImageAt(2),
    type: 'CRM and sales',
    title: 'Pricing & plans',
    excerpt:
      'Compare plans, subscription limits, purchase paths, and the pricing FAQ—the content that backs the docs pricing route in this Next.js app.',
    author: 'Marketing Simplified',
    time: 'May 4, 2026',
    href: '/docs/pricing',
  },
  {
    image: blogPublicImageAt(3),
    type: 'Service management',
    title: 'Policy & trust',
    excerpt:
      'Data collection, processors, retention, platform responsibilities, and access controls—the long-form policy guide served at /docs/policy.',
    author: 'Marketing Simplified',
    time: 'May 4, 2026',
    href: '/docs/policy',
  },
  {
    image: blogPublicImageAt(4),
    type: 'Project management',
    title: 'Solutions',
    excerpt:
      'Industry-focused positioning for how teams run media workflows end-to-end—the public /solutions route alongside the main marketing story.',
    author: 'Marketing Simplified',
    time: 'May 4, 2026',
    href: '/solutions',
  },
  {
    image: blogPublicImageAt(5),
    type: 'Productivity',
    title: 'Sign in to the workspace',
    excerpt:
      'Same entry as the public header and footer trial links—open /login, then continue to in-app routes such as /tasks, campaigns, and spreadsheets once authenticated.',
    author: 'Marketing Simplified',
    time: 'May 4, 2026',
    href: '/login',
  },
];
