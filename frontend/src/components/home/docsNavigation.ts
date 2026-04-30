export type TocItem = {
  id: string;
  label: string;
};

export type DocsNavItem = {
  label: string;
  href: string;
};

export const docsNavGroups: { title: string; items: DocsNavItem[] }[] = [
  {
    title: 'Start',
    items: [
      { label: 'Overview', href: '/docs' },
      { label: 'Product', href: '/docs/product' },
      { label: 'Pricing', href: '/docs/pricing' },
      { label: 'Policy', href: '/docs/policy' },
    ],
  },
  {
    title: 'Workflows',
    items: [
      { label: 'Campaign setup', href: '/docs#campaign-setup' },
      { label: 'AI Agent workflows', href: '/docs#ai-agent-workflows' },
      { label: 'Spreadsheet analysis', href: '/docs#spreadsheet-analysis' },
      { label: 'Decisions and follow-up', href: '/docs#decisions-follow-up' },
      { label: 'Policy response', href: '/docs#policy-response' },
    ],
  },
  {
    title: 'Evaluation',
    items: [
      { label: 'Plan comparison', href: '/docs/pricing#plans' },
      { label: 'Pricing FAQ', href: '/docs/pricing#pricing-faq' },
      { label: 'Data use', href: '/docs/policy#data-we-collect' },
      { label: 'Platform responsibilities', href: '/docs/policy#platform-responsibilities' },
    ],
  },
];

export const docsTocByPath: Record<string, TocItem[]> = {
  '/docs': [
    { id: 'getting-started', label: 'Getting started' },
    { id: 'campaign-setup', label: 'Campaign setup' },
    { id: 'ai-agent-workflows', label: 'AI Agent workflows' },
    { id: 'spreadsheet-analysis', label: 'Spreadsheet analysis' },
    { id: 'decisions-follow-up', label: 'Decisions and follow-up' },
    { id: 'policy-response', label: 'Policy response' },
  ],
  '/docs/product': [
    { id: 'what-it-is', label: 'What it is' },
    { id: 'core-workflows', label: 'Core workflows' },
    { id: 'modules', label: 'Modules' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'next-steps', label: 'Next steps' },
  ],
  '/docs/pricing': [
    { id: 'plans', label: 'Plans' },
    { id: 'subscription-limits', label: 'Subscription limits' },
    { id: 'how-to-choose', label: 'How to choose' },
    { id: 'purchase-paths', label: 'Purchase paths' },
    { id: 'pricing-faq', label: 'Pricing FAQ' },
  ],
  '/docs/policy': [
    { id: 'introduction', label: 'Introduction' },
    { id: 'data-we-collect', label: 'Data we collect' },
    { id: 'how-we-use-data', label: 'How we use data' },
    { id: 'sharing-and-processors', label: 'Sharing and processors' },
    { id: 'retention-and-deletion', label: 'Retention and deletion' },
    { id: 'platform-responsibilities', label: 'Platform responsibilities' },
    { id: 'platform-checklist', label: 'Platform checklist' },
    { id: 'security', label: 'Security' },
    { id: 'access-controls', label: 'Access controls' },
    { id: 'contact', label: 'Contact' },
  ],
};
