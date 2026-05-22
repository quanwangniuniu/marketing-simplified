import type { BlogCardType } from '@/components/blog/BlogCard';
import { BLOG_CARD_TYPES } from '@/components/blog/BlogCard';
import { blogPublicImageAt } from '@/components/blog/blogPublicImages';

export type BlogPostExample = {
  image: string;
  type: BlogCardType;
  title: string;
  excerpt: string;
  author: string;
  time: string;
  href: string;
};

/** Six posts per `BlogCard` category — examples grounded in this repo’s modules and docs. */
export const blogPostExamples: BlogPostExample[] = [
  // Project management
  {
    image: blogPublicImageAt(0),
    type: 'Project management',
    title: 'Tasks, campaigns, and one place for ownership',
    excerpt:
      'How the task app pairs with campaign so creative, media, and ops can see the same Jira-style work without losing context in email.',
    author: 'Marketing Simplified',
    time: 'May 2, 2026',
    href: '/docs/product#core-workflows',
  },
  {
    image: blogPublicImageAt(1),
    type: 'Project management',
    title: 'Decisions that stick after the meeting ends',
    excerpt:
      'Using the decision domain to capture outcomes, then wiring follow-ups into tasks so retrospectives in the retrospective app are not a separate memory.',
    author: 'Marketing Simplified',
    time: 'Apr 30, 2026',
    href: '/docs#decisions-follow-up',
  },
  {
    image: blogPublicImageAt(2),
    type: 'Project management',
    title: 'Spreadsheet sign-off before numbers hit the dashboard',
    excerpt:
      'A lightweight gate: spreadsheet approvals feed metric_upload and dashboard views so finance and growth agree on the same CSV lineage.',
    author: 'Marketing Simplified',
    time: 'Apr 26, 2026',
    href: '/docs#spreadsheet-analysis',
  },
  {
    image: blogPublicImageAt(3),
    type: 'Project management',
    title: 'Meetings with artifacts, not orphaned notes',
    excerpt:
      'Linking meetings and google_calendar_integration events to tasks and decisions so Zoom and Calendar invites stop being the system of record.',
    author: 'Marketing Simplified',
    time: 'Apr 21, 2026',
    href: '/docs/product#modules',
  },
  {
    image: blogPublicImageAt(4),
    type: 'Project management',
    title: 'Teams and access_control: default deny, explicit share',
    excerpt:
      'Why we lean on access_control plus teams membership when agencies onboard contractors—mirroring least-privilege guidance in the policy docs on access controls.',
    author: 'Marketing Simplified',
    time: 'Apr 18, 2026',
    href: '/docs/policy#access-controls',
  },
  {
    image: blogPublicImageAt(5),
    type: 'Project management',
    title: 'Client communication without a second CRM',
    excerpt:
      'Keeping threads in client_communication tied to campaigns and tasks so Mailchimp and Klaviyo sends are explained next to the work that produced them.',
    author: 'Marketing Simplified',
    time: 'Apr 14, 2026',
    href: '/docs/product#integrations',
  },

  // CRM and sales
  {
    image: blogPublicImageAt(6),
    type: 'CRM and sales',
    title: 'When Klaviyo and Mailchimp lists disagree',
    excerpt:
      'Reconciling audiences using the dedicated Klaviyo and Mailchimp backends—then documenting the source of truth in the campaign record.',
    author: 'Marketing Simplified',
    time: 'May 1, 2026',
    href: '/docs/product#integrations',
  },
  {
    image: blogPublicImageAt(7),
    type: 'CRM and sales',
    title: 'Budget approval before Google Ads spend ramps',
    excerpt:
      'Walking account teams through budget_approval checkpoints tied to Google Ads flight dates so finance sees commits before pixels fire.',
    author: 'Marketing Simplified',
    time: 'Apr 29, 2026',
    href: '/docs#campaign-setup',
  },
  {
    image: blogPublicImageAt(8),
    type: 'CRM and sales',
    title: 'Stripe Meta renewals: what procurement actually asks',
    excerpt:
      'Mapping Stripe Meta subscription states to the pricing FAQ so sales engineers answer limits, not buzzwords.',
    author: 'Marketing Simplified',
    time: 'Apr 25, 2026',
    href: '/docs/pricing#pricing-faq',
  },
  {
    image: blogPublicImageAt(9),
    type: 'CRM and sales',
    title: 'Plan comparison without spreadsheet tennis',
    excerpt:
      'Using the pricing plans doc alongside in-product user preferences so buyers compare seats, integrations, and API-heavy modules in one pass.',
    author: 'Marketing Simplified',
    time: 'Apr 22, 2026',
    href: '/docs/pricing#plans',
  },
  {
    image: blogPublicImageAt(10),
    type: 'CRM and sales',
    title: 'Handoff from launch to optimization reviews',
    excerpt:
      'How campaign milestones roll into optimization and report slices—so CSMs inherit a narrative, not a folder of exports.',
    author: 'Marketing Simplified',
    time: 'Apr 17, 2026',
    href: '/docs/product#core-workflows',
  },
  {
    image: blogPublicImageAt(11),
    type: 'CRM and sales',
    title: 'Meta Ads and TikTok pilots: scoping integrations early',
    excerpt:
      'Positioning Meta Ads, Facebook Meta, and TikTok connectors during presales, including token rotation expectations from the security section of policy.',
    author: 'Marketing Simplified',
    time: 'Apr 11, 2026',
    href: '/docs/policy#security',
  },

  // Product development life cycle
  {
    image: blogPublicImageAt(12),
    type: 'Product development life cycle',
    title: 'Next.js App Router pages stay thin; features live in components',
    excerpt:
      'Why public routes like (public)/blog compose BlogMain and BlogCard instead of hiding UI logic in page.tsx—matching our frontend architecture rules.',
    author: 'Marketing Simplified',
    time: 'Apr 28, 2026',
    href: '/docs/product#what-it-is',
  },
  {
    image: blogPublicImageAt(13),
    type: 'Product development life cycle',
    title: 'Django DRF, Channels, and Celery as the default stack',
    excerpt:
      'How the monorepo keeps HTTP in REST views, realtime in chat via Channels, and long jobs (metric_upload, reports) on Celery workers.',
    author: 'Marketing Simplified',
    time: 'Apr 24, 2026',
    href: '/docs/product#modules',
  },
  {
    image: blogPublicImageAt(14),
    type: 'Product development life cycle',
    title: 'From hypothesis to ad variations in one experiment record',
    excerpt:
      'Linking experiment hypotheses to creative variation assets so creative iterations stay traceable when optimization picks winners.',
    author: 'Marketing Simplified',
    time: 'Apr 20, 2026',
    href: '/docs#campaign-setup',
  },
  {
    image: blogPublicImageAt(15),
    type: 'Product development life cycle',
    title: 'Notion-style editing without leaving the app',
    excerpt:
      'Shipping Notion-style editor surfaces next to briefs and policies so long-form content uses one editor, not a pile of Google Docs links.',
    author: 'Marketing Simplified',
    time: 'Apr 16, 2026',
    href: '/docs/product#integrations',
  },
  {
    image: blogPublicImageAt(16),
    type: 'Product development life cycle',
    title: 'Storybook for marketing chrome, Playwright for flows',
    excerpt:
      'How we treat NotFoundPage Storybook stories and other UI states as contracts—especially for public SEO pages that ship without a login shell.',
    author: 'Marketing Simplified',
    time: 'Apr 12, 2026',
    href: '/docs/product#next-steps',
  },
  {
    image: blogPublicImageAt(17),
    type: 'Product development life cycle',
    title: 'Docker Compose dev parity for entrypoint-dev scripts',
    excerpt:
      'Keeping docker-compose.dev.yml, backend entrypoint-dev, and frontend Dockerfile.dev aligned so new engineers boot the same stack on day one.',
    author: 'Marketing Simplified',
    time: 'Apr 8, 2026',
    href: '/docs',
  },

  // Service management
  {
    image: blogPublicImageAt(18),
    type: 'Service management',
    title: 'Alerting when Ads APIs throttle or fail',
    excerpt:
      'Operational playbooks on top of alerting for Google Ads and Meta Ads jobs—paging on quota spikes, not on every benign retry.',
    author: 'Marketing Simplified',
    time: 'Apr 27, 2026',
    href: '/docs/policy#security',
  },
  {
    image: blogPublicImageAt(19),
    type: 'Service management',
    title: 'Slack threads that become tasks, not lost context',
    excerpt:
      'Using Slack integration webhooks and deep links back to tasks so #campaign-requests stops being an unofficial ticket system.',
    author: 'Marketing Simplified',
    time: 'Apr 23, 2026',
    href: '/docs/product#integrations',
  },
  {
    image: blogPublicImageAt(20),
    type: 'Service management',
    title: 'Zoom and Google Calendar: recorded decisions land in one place',
    excerpt:
      'Pairing Zoom integration with Google Calendar so meeting notes attach to the same decision IDs finance already trusts.',
    author: 'Marketing Simplified',
    time: 'Apr 19, 2026',
    href: '/docs#decisions-follow-up',
  },
  {
    image: blogPublicImageAt(21),
    type: 'Service management',
    title: 'Policy questions routed with the policy doc as the canonical FAQ',
    excerpt:
      'How support uses policy anchors—data collection, processors, retention—to answer tickets without inventing ad-hoc legal language.',
    author: 'Marketing Simplified',
    time: 'Apr 15, 2026',
    href: '/docs/policy#platform-responsibilities',
  },
  {
    image: blogPublicImageAt(22),
    type: 'Service management',
    title: 'Miro boards and the asset library in one review loop',
    excerpt:
      'Bridging Miro exports into asset approvals so creative QA does not fork across whiteboards and DAM tabs.',
    author: 'Marketing Simplified',
    time: 'Apr 10, 2026',
    href: '/docs/product#modules',
  },
  {
    image: blogPublicImageAt(23),
    type: 'Service management',
    title: 'Facebook integrations: naming two stacks without confusing CS',
    excerpt:
      'Clarifying when teams need the Facebook integration app versus Facebook Meta during onboarding so credential scopes match the ads surface in use.',
    author: 'Marketing Simplified',
    time: 'Apr 6, 2026',
    href: '/docs#campaign-setup',
  },

  // AI Agents
  {
    image: blogPublicImageAt(24),
    type: 'AI Agents',
    title: 'Agent endpoints: prompts, guardrails, and human checkpoints',
    excerpt:
      'How the agent URLs sit next to automation workflows so generated briefs or summaries always pass a human task owner.',
    author: 'Marketing Simplified',
    time: 'Apr 26, 2026',
    href: '/docs#ai-agent-workflows',
  },
  {
    image: blogPublicImageAt(25),
    type: 'AI Agents',
    title: 'Gemini and connected accounts: what the product actually touches',
    excerpt:
      'Grounding marketing copy in the data-we-collect section of policy while referencing the Google Gemini integration iconography used on the public site.',
    author: 'Marketing Simplified',
    time: 'Apr 22, 2026',
    href: '/docs/policy#data-we-collect',
  },
  {
    image: blogPublicImageAt(26),
    type: 'AI Agents',
    title: 'Chat + Channels: threading without leaking private context',
    excerpt:
      'Patterns from chat and Django Channels for scoped rooms—especially when agents summarize threads that include client-only mentions.',
    author: 'Marketing Simplified',
    time: 'Apr 18, 2026',
    href: '/docs/policy#platform-responsibilities',
  },
  {
    image: blogPublicImageAt(27),
    type: 'AI Agents',
    title: 'Optimization suggestions validated against spreadsheets',
    excerpt:
      'Requiring optimization outputs to cite rows from spreadsheet exports before auto-applying changes—cheap insurance against confident wrong numbers.',
    author: 'Marketing Simplified',
    time: 'Apr 13, 2026',
    href: '/docs#spreadsheet-analysis',
  },
  {
    image: blogPublicImageAt(28),
    type: 'AI Agents',
    title: 'Automation workflows: when to keep humans in the loop',
    excerpt:
      'Designing automation workflow steps that pause for budget approval or legal review instead of chaining silent API writes.',
    author: 'Marketing Simplified',
    time: 'Apr 9, 2026',
    href: '/docs#ai-agent-workflows',
  },
  {
    image: blogPublicImageAt(29),
    type: 'AI Agents',
    title: 'From campaign signals to narrative drafts',
    excerpt:
      'Using agent summaries across campaign, report, and dashboard widgets so leadership reads a story, not fifteen exports.',
    author: 'Marketing Simplified',
    time: 'Apr 4, 2026',
    href: '/docs/product#core-workflows',
  },

  // Productivity
  {
    image: blogPublicImageAt(30),
    type: 'Productivity',
    title: 'Dashboard + report slices for Monday leadership reviews',
    excerpt:
      'A standing agenda built on dashboard and report endpoints—same charts execs see in-product, fewer screenshot decks.',
    author: 'Marketing Simplified',
    time: 'Apr 25, 2026',
    href: '/docs/product#modules',
  },
  {
    image: blogPublicImageAt(31),
    type: 'Productivity',
    title: 'Deep-linking spreadsheet analysis from public docs',
    excerpt:
      'Bookmarking the spreadsheet analysis section of the docs for analysts who live in CSVs but still need the canonical explanation for finance partners.',
    author: 'Marketing Simplified',
    time: 'Apr 20, 2026',
    href: '/docs#spreadsheet-analysis',
  },
  {
    image: blogPublicImageAt(32),
    type: 'Productivity',
    title: 'Google Docs briefs that become tracked work',
    excerpt:
      'Using Google Docs integration to ingest creative briefs into tasks so edits in Docs do not orphan action items.',
    author: 'Marketing Simplified',
    time: 'Apr 16, 2026',
    href: '/docs/product#integrations',
  },
  {
    image: blogPublicImageAt(33),
    type: 'Productivity',
    title: 'Metric uploads: CSV hygiene before charts populate',
    excerpt:
      'Checklists on top of metric upload for column names, date grain, and currency columns—preventing silent dashboard mismatches.',
    author: 'Marketing Simplified',
    time: 'Apr 11, 2026',
    href: '/docs#spreadsheet-analysis',
  },
  {
    image: blogPublicImageAt(34),
    type: 'Productivity',
    title: 'SEO pages and sitemaps: ship content without the app shell',
    excerpt:
      'How PublicSeoPages, blog routes, and the SEO sitemap/robots notes keep marketing pages fast while logged-in work stays in the main layout.',
    author: 'Marketing Simplified',
    time: 'Apr 7, 2026',
    href: '/docs/product#next-steps',
  },
  {
    image: blogPublicImageAt(35),
    type: 'Productivity',
    title: 'Fewer tabs: assets, campaigns, and decisions in one workspace',
    excerpt:
      'Practical defaults that route people through assets, campaigns, and decisions instead of five SaaS tools with overlapping notifications.',
    author: 'Marketing Simplified',
    time: 'Apr 3, 2026',
    href: '/docs/product#core-workflows',
  },
];

/** One representative post per category for the hero carousel (avoids dozens of tabs). */
export function blogFeaturedSlidesFromExamples(
  posts: readonly BlogPostExample[],
): { category: string; title: string; description: string; image: string; href: string }[] {
  const byType = new Map<BlogCardType, BlogPostExample>();
  for (const p of posts) {
    if (!byType.has(p.type)) byType.set(p.type, p);
  }
  return BLOG_CARD_TYPES.map((t) => {
    const post = byType.get(t);
    if (!post) throw new Error(`Missing blog example for type: ${t}`);
    return {
      category: post.type,
      title: post.title,
      description: post.excerpt,
      image: post.image,
      href: post.href,
    };
  });
}
