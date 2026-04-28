import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Gauge,
  Layers3,
  LineChart,
  Megaphone,
  PlayCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { docsNavGroups, docsTocByPath, type TocItem } from '@/components/home/docsNavigation';
import DocsTableOfContents from '@/components/home/DocsTableOfContents';

type Action = {
  label: string;
  href: string;
};

type Feature = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const integrations = [
  { name: 'Google Ads', icon: '/icons/google-ads.svg' },
  { name: 'Meta Ads', icon: '/icons/meta.svg' },
  { name: 'TikTok', icon: '/icons/tiktok.svg' },
  { name: 'Slack', icon: '/icons/slack.svg' },
  { name: 'Zoom', icon: '/icons/zoom.svg' },
  { name: 'Google Sheets', icon: '/icons/google-sheets.svg' },
  { name: 'Google Gemini', icon: '/icons/google-gemini.svg' },
];

function PageHero({
  eyebrow,
  title,
  description,
  primary,
  secondary,
  showPreview = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primary: Action;
  secondary?: Action;
  showPreview?: boolean;
}) {
  return (
    <section className="px-6 py-20 lg:py-28">
      <div className={`max-w-7xl mx-auto grid gap-10 lg:items-center ${showPreview ? 'lg:grid-cols-[1.05fr_0.95fr]' : ''}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
            <Sparkles className="h-4 w-4" />
            {eyebrow}
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-normal text-slate-900 sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 lg:text-xl">{description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-14 rounded-full bg-brand-gradient px-8 text-base text-white hover:saturate-150 glow-brand">
              <Link href={primary.href}>
                {primary.label}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            {secondary ? (
              <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-2 border-brand-teal/40 bg-white px-8 text-base text-brand-teal hover:bg-brand-teal/5">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {showPreview ? (
          <div className="glass-card rounded-2xl border border-white/70 p-5 shadow-xl">
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-300" />
                  <span className="h-3 w-3 rounded-full bg-amber-300" />
                  <span className="h-3 w-3 rounded-full bg-brand-lime" />
                </div>
                <span className="text-xs font-medium text-gray-400">Marketing Simplified</span>
              </div>
              <div className="grid gap-4 p-5">
                <div className="rounded-xl bg-brand-teal/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient text-white">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">AI Agent workflow</p>
                      <p className="text-sm text-gray-500">Analyze, recommend, assign, and follow up.</p>
                    </div>
                  </div>
                </div>
                {[
                  ['Campaign data imported', 'Google Ads, Meta Ads, TikTok'],
                  ['Decision drafted', 'Budget shift and creative test plan'],
                  ['Tasks created', 'Owners, due dates, and approvals'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="max-w-[45%] truncate text-right text-xs text-brand-teal">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <div className="mb-4 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-bold text-slate-900 lg:text-5xl">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-gray-600">{body}</p>
    </div>
  );
}

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {features.map(({ title, body, icon: Icon }) => (
        <article key={title} className="glass-card rounded-2xl p-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>
        </article>
      ))}
    </div>
  );
}

function CtaBand({ title, body, primary, secondary }: { title: string; body: string; primary: Action; secondary?: Action }) {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl rounded-3xl border border-brand-teal/15 bg-brand-teal/5 p-10 text-center lg:p-16">
        <h2 className="text-3xl font-bold text-slate-900 lg:text-5xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-600">{body}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-14 rounded-full bg-brand-gradient px-8 text-base text-white hover:saturate-150 glow-brand">
            <Link href={primary.href}>
              {primary.label}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          {secondary ? (
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-2 border-brand-teal/40 bg-white px-8 text-base text-brand-teal hover:bg-brand-teal/5">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function IntegrationsStrip() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
      {integrations.map((integration) => (
        <div key={integration.name} className="glass-card flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl p-4 text-center">
          <Image src={integration.icon} alt={integration.name} width={30} height={30} />
          <span className="text-xs font-medium text-gray-600">{integration.name}</span>
        </div>
      ))}
    </div>
  );
}

function DocsArticleShell({
  activeHref,
  eyebrow,
  title,
  description,
  toc,
  children,
}: {
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  toc: TocItem[];
  children: React.ReactNode;
}) {
  return (
    <section className="lg:pl-[280px] lg:pr-[320px]">
      <aside className="hidden lg:block lg:fixed lg:left-0 lg:top-24 lg:bottom-0 lg:w-[280px] lg:border-r lg:border-gray-200 lg:bg-white/80 lg:px-5 lg:py-8">
        <Link href="/docs" className="mb-6 flex items-center gap-2 rounded-xl bg-brand-teal/10 px-3 py-2 font-semibold text-brand-teal">
          <BookOpen className="h-4 w-4" />
          Documentation
        </Link>
        <nav className="space-y-7" aria-label="Documentation navigation">
          {docsNavGroups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.title}</h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.href === activeHref;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? 'bg-brand-teal/10 font-semibold text-brand-teal'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 px-6 py-10 lg:px-10 lg:py-14">
        <article className="min-w-0 max-w-4xl">
          <div className="border-b border-gray-200 pb-10">
            <div className="mb-5 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
              {eyebrow}
            </div>
            <h1 className="text-4xl font-bold tracking-normal text-slate-900 lg:text-6xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          </div>
          <div className="space-y-14 py-10">{children}</div>
        </article>
        <DocsTableOfContents toc={toc} />
      </div>
    </section>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32">
      <h2 className="text-2xl font-bold text-slate-900 lg:text-3xl">{title}</h2>
      <div className="mt-5 space-y-5 text-base leading-8 text-gray-600">{children}</div>
    </section>
  );
}

function DocCardGrid({ items }: { items: { title: string; body: string; href?: string }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => {
        const content = (
          <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-teal/30 hover:shadow-md">
            <h3 className="font-bold text-gray-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
          </div>
        );

        return item.href ? (
          <Link key={item.title} href={item.href}>
            {content}
          </Link>
        ) : (
          <div key={item.title}>{content}</div>
        );
      })}
    </div>
  );
}

export function DocsProductPageContent() {
  const toc = docsTocByPath['/docs/product'];

  return (
    <DocsArticleShell
      activeHref="/docs/product"
      eyebrow="Product guide"
      title="Marketing Simplified product"
      description="Understand how Marketing Simplified connects campaign planning, creative operations, performance analysis, decisions, and execution follow-up."
      toc={toc}
    >
      <DocSection id="what-it-is" title="What it is">
        <p>
          Marketing Simplified is an AI-assisted operating workspace for media teams. It brings campaign context, analysis,
          decisions, tasks, meetings, and connected platform data into one shared place so teams can move from signal to action.
        </p>
      </DocSection>

      <DocSection id="core-workflows" title="Core workflows">
        <DocCardGrid
          items={[
            { title: 'Plan', body: 'Turn campaign briefs into timelines, owners, tasks, budgets, and launch readiness checks.' },
            { title: 'Execute', body: 'Coordinate creative reviews, approvals, meetings, and platform-specific handoffs.' },
            { title: 'Analyze', body: 'Import performance data and use AI workflows to identify what changed and what matters.' },
            { title: 'Optimize', body: 'Promote recommendations into decisions, follow-up tasks, and the next experiment.' },
          ]}
        />
      </DocSection>

      <DocSection id="modules" title="Modules">
        <DocCardGrid
          items={[
            { title: 'AI Agent workflows', body: 'Ask follow-up questions, summarize campaign data, recommend next actions, and create execution work.' },
            { title: 'Campaigns', body: 'Manage campaign status, objectives, platforms, templates, snapshots, check-ins, and activity.' },
            { title: 'Spreadsheets', body: 'Analyze campaign spreadsheets and keep performance signals tied to team decisions.' },
            { title: 'Decisions', body: 'Track options, risk, evidence, approvals, and execution outcomes for important campaign choices.' },
            { title: 'Meetings and calendar', body: 'Connect reviews, agendas, notes, deadlines, and action items back to campaign work.' },
            { title: 'Creative and ad previews', body: 'Prepare ad assets, variations, and platform-specific preview workflows before launch.' },
          ]}
        />
      </DocSection>

      <DocSection id="integrations" title="Integrations">
        <p>
          Marketing Simplified is designed around workflows that involve Google Ads, Meta Ads, TikTok, Slack, Zoom, Google
          Sheets, and Google Gemini. Connected accounts should be authorized by the customer and used only for permitted work.
        </p>
      </DocSection>

      <DocSection id="next-steps" title="Next steps">
        <DocCardGrid
          items={[
            { title: 'See solutions by role', body: 'Map the product to media buying, creative operations, agency reporting, leadership visibility, and policy response workflows.', href: '/solutions' },
            { title: 'Compare plans', body: 'Review how tiers map to team size, integrations, and rollout needs.', href: '/docs/pricing' },
            { title: 'Read platform policy guidance', body: 'Understand data use, connected-account responsibility, and platform-aligned expectations.', href: '/docs/policy' },
          ]}
        />
      </DocSection>
    </DocsArticleShell>
  );
}

export function DocsPricingPageContent() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      suffix: '/mo',
      fit: 'Small teams validating the workspace before wider rollout.',
      includes: ['Up to 5 team members', '2 previews per day', '5 tasks per day'],
      cta: 'Start free',
      href: '/login',
    },
    {
      name: 'Pro',
      price: '$29',
      suffix: '/mo',
      fit: 'Growing teams running recurring creative, preview, and task workflows.',
      includes: ['Everything in Free', 'Up to 10 team members', '10 previews per day', '20 tasks per day'],
      cta: 'Get Pro',
      href: '/login',
      badge: 'Recommended',
    },
    {
      name: 'Ultimate',
      price: '$99',
      suffix: '/mo',
      fit: 'Larger teams that need more capacity across campaign operations.',
      includes: ['Everything in Pro', 'Up to 20 team members', '50 previews per day', '50 tasks per day'],
      cta: 'Get Ultimate',
      href: '/login',
    },
  ];
  const purchasePaths = [
    { title: 'Start self-serve', body: 'Create or log in to an account, open Subscription, and choose a plan when your organization is ready.', href: '/login' },
    { title: 'Admin plan changes', body: 'Only Organization Admins can subscribe, upgrade, downgrade, or switch plans inside the app.', href: '/login' },
    { title: 'Prepare an enterprise review', body: 'Use the product, policy, and solutions docs to gather workflow, security, and rollout questions before contacting the team.', href: '/docs/policy' },
    { title: 'Compare by workflow', body: 'Match plan capacity to previews, tasks, campaign volume, creative approvals, and stakeholders who need visibility.', href: '/solutions' },
  ];
  const questions = [
    ['Is there public dollar pricing?', 'Yes. Free is $0/month, Pro is $29/month, and Ultimate is $99/month.'],
    ['Can we start with a trial?', 'Yes. Self-serve evaluation routes users toward account creation or login, then plan selection happens in Subscription.'],
    ['How do seats work?', 'Plan fit should be based on the team member limits shown for Free, Pro, and Ultimate, plus who needs campaign visibility.'],
    ['What affects usage?', 'Daily previews, daily tasks, connected integrations, campaign volume, reporting, and workflow automation influence the right package.'],
    ['Which integrations are included?', 'The public pages highlight Google Ads, Meta Ads, TikTok, Slack, Zoom, Google Sheets, and Google Gemini.'],
    ['Who can change plans?', 'Plan changes are handled in the app and limited to Organization Admins.'],
    ['How do I choose a plan?', 'Start with the smallest tier that supports active users, previews, and tasks, then move up when campaign operations need more capacity.'],
  ];

  return (
    <DocsArticleShell
      activeHref="/docs/pricing"
      eyebrow="Pricing guide"
      title="Pricing built for modern ad teams"
      description="Compare plan fit, monthly pricing, rollout complexity, support expectations, and workflow depth."
      toc={docsTocByPath['/docs/pricing']}
    >
      <DocSection id="plans" title="Plans">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`flex min-h-[27rem] flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                plan.badge
                  ? 'border-brand-teal/40 ring-1 ring-brand-teal/25 shadow-brand-teal/10'
                  : 'border-brand-teal/15 hover:border-brand-teal/30'
              }`}
            >
              <div className="mb-6 h-1.5 w-16 rounded-full bg-brand-gradient" />
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
                {plan.badge ? (
                  <span className="mt-1 whitespace-nowrap rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal">
                    {plan.badge}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-baseline text-slate-900">
                <span className="text-3xl font-semibold">{plan.price}</span>
                <span className="ml-1 text-base text-gray-500">{plan.suffix}</span>
              </div>
              <p className="mt-6 text-sm leading-6 text-gray-600">{plan.fit}</p>
              <p className="mt-6 text-sm font-medium text-gray-500">Includes:</p>
              <ul className="mt-4 space-y-3">
                {plan.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-gray-800">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal/10">
                      <Check className="h-3 w-3 text-brand-teal" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`mt-auto w-fit rounded-full px-5 ${
                  plan.badge
                    ? 'bg-brand-gradient text-white hover:saturate-150 glow-brand'
                    : 'border border-brand-teal/40 bg-white text-brand-teal shadow-none hover:bg-brand-teal/5'
                }`}
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </article>
          ))}
        </div>
      </DocSection>

      <DocSection id="subscription-limits" title="Subscription limits">
        <p>
          The in-app subscription page presents Free, Pro, and Ultimate plans. The visible capacity levers are team members,
          previews per day, and tasks per day, so teams should compare plans against the number of operators, reviewers, and
          daily campaign actions they expect to run.
        </p>
      </DocSection>

      <DocSection id="how-to-choose" title="How to choose">
        <p>
          Choose based on the number of campaigns under active management, the number of people coordinating work, daily preview
          volume, daily task creation, the integrations needed, and the importance of AI-assisted analysis.
        </p>
      </DocSection>

      <DocSection id="purchase-paths" title="Purchase paths">
        <DocCardGrid items={purchasePaths} />
      </DocSection>

      <DocSection id="pricing-faq" title="Pricing FAQ">
        <div className="border-y border-gray-200">
          {questions.map(([question, answer]) => (
            <details key={question} className="group border-b border-gray-200 last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-medium text-gray-900 transition hover:text-brand-teal [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-700 transition-transform duration-200 group-open:rotate-180 group-hover:text-brand-teal" />
              </summary>
              <p className="pb-5 pr-10 text-sm leading-7 text-gray-600">{answer}</p>
            </details>
          ))}
        </div>
      </DocSection>
    </DocsArticleShell>
  );
}

export function DocsPolicyPageContent() {
  const toc = docsTocByPath['/docs/policy'];

  return (
    <DocsArticleShell
      activeHref="/docs/policy"
      eyebrow="Policy"
      title="Platform use and data policy"
      description="A text-based policy guide for data handling, connected ad accounts, platform responsibilities, and safe campaign operations."
      toc={toc}
    >
      <DocSection id="introduction" title="Introduction">
        <p>
          This policy explains how Marketing Simplified approaches product data, connected advertising platforms, campaign
          assets, and user responsibilities. It is written for evaluation and operational clarity and does not replace legal advice.
        </p>
      </DocSection>

      <DocSection id="data-we-collect" title="Data we collect">
        <p>
          We may process account profile information, organization and workspace details, campaign records, task data,
          meeting context, uploaded assets, spreadsheet content, connected-platform metadata, and support communications.
        </p>
        <p>
          When a user connects a third-party advertising or collaboration service, the product may receive data needed to
          provide previews, reporting, analysis, workflow automation, or account-status context.
        </p>
      </DocSection>

      <DocSection id="how-we-use-data" title="How we use data">
        <p>
          Data is used to operate campaign workflows, analyze performance, create recommendations, support collaboration,
          generate tasks and decisions, provide customer support, maintain reliability, and improve the product experience.
        </p>
      </DocSection>

      <DocSection id="sharing-and-processors" title="Sharing and processors">
        <p>
          Marketing Simplified may rely on service providers for hosting, analytics, communication, AI-assisted workflows,
          and integrations. Data should only be shared where needed to provide the service, maintain security, or comply with
          applicable obligations.
        </p>
      </DocSection>

      <DocSection id="retention-and-deletion" title="Retention and deletion">
        <p>
          Customers should be able to request export or deletion of workspace data through account, admin, or support
          workflows. Some data may be retained where required for security, audit, dispute resolution, legal obligations, or
          backup integrity.
        </p>
      </DocSection>

      <DocSection id="platform-responsibilities" title="Platform responsibilities">
        <p>
          Users are responsible for connecting only ad accounts and business assets they are authorized to manage. Customers
          remain responsible for ad claims, targeting, assets, landing pages, data collection, regulated categories, and local law.
        </p>
        <p>
          Meta, Google Ads, TikTok, and other media platforms maintain their own rules around ad review, prohibited or
          restricted content, destination quality, account integrity, and data use. Marketing Simplified workflows should help
          teams organize review, but they do not guarantee approval or compliance.
        </p>
      </DocSection>

      <DocSection id="platform-checklist" title="Platform checklist">
        <DocCardGrid
          items={[
            { title: 'Meta workflows', body: 'Confirm business asset access, ad account permission, destination consistency, claims, creative rights, and review status before launch.' },
            { title: 'Google Ads workflows', body: 'Review prohibited content, restricted categories, editorial quality, destination requirements, tracking, and data-use disclosures.' },
            { title: 'TikTok workflows', body: 'Check market-specific creative rules, landing-page functionality, restricted categories, advertiser identity, and data collection expectations.' },
            { title: 'Escalation triggers', body: 'Route sensitive categories, policy changes, rejected ads, unusual data use, and regulated claims for human review before scaling.' },
          ]}
        />
      </DocSection>

      <DocSection id="security" title="Security">
        <p>
          The product should use reasonable safeguards, access controls, and least-privilege operational practices appropriate
          for campaign and workspace data. Customers should manage user access, connected-account permissions, and offboarding
          processes carefully.
        </p>
        <p>
          Disaster recovery planning helps protect availability for private workspace information by keeping recoverable backups,
          restoration procedures, and operational runbooks ready for outages or data-loss events. Backup access should remain
          restricted and audited so private campaign records, uploaded assets, meeting notes, and account context can be restored
          without broadening who can see them.
        </p>
      </DocSection>

      <DocSection id="access-controls" title="Access controls">
        <p>
          Teams should assign roles based on least privilege, keep organization admins limited to trusted operators, remove
          access when users leave a project, and periodically review connected ad-platform permissions. Subscription changes
          and account-level administration should remain limited to authorized organization admins.
        </p>
        <p>
          For shared campaign operations, use approvals, decision records, meeting notes, and task ownership to preserve an
          audit-friendly record of who reviewed important changes and what evidence supported them.
        </p>
      </DocSection>

      <DocSection id="contact" title="Contact">
        <p>
          Questions about data handling, connected accounts, platform policy, or deletion requests should be routed through
          the appropriate account administrator or customer support channel.
        </p>
      </DocSection>
    </DocsArticleShell>
  );
}

export function ProductPageContent() {
  const features: Feature[] = [
    { title: 'AI Agent workflows', body: 'Upload campaign context, ask follow-up questions, and turn analysis into decisions, tasks, and board-ready summaries.', icon: Bot },
    { title: 'Campaign planning', body: 'Coordinate launches, owners, budgets, timelines, check-ins, and templates from one shared campaign workspace.', icon: Megaphone },
    { title: 'Spreadsheet analysis', body: 'Bring performance spreadsheets into a structured workspace and surface spend shifts, anomalies, and next actions.', icon: BarChart3 },
    { title: 'Decision management', body: 'Convert performance signals into reviewed decisions with risk, options, supporting context, and execution tasks.', icon: Scale },
    { title: 'Meetings and calendar', body: 'Plan campaign reviews, connect meeting notes, track action items, and keep deadlines visible to the team.', icon: CalendarDays },
    { title: 'Creative and ad previews', body: 'Review media assets and ad variations across platform-specific workflows before launch.', icon: Layers3 },
  ];

  return (
    <>
      <PageHero
        eyebrow="Product overview"
        title="Marketing Simplified product"
        description="Marketing Simplified brings campaign planning, creative review, performance analysis, decisions, and follow-through into one AI-assisted workspace for media teams."
        primary={{ label: 'Start trial', href: '/login' }}
        secondary={{ label: 'View solutions', href: '/solutions' }}
      />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="What it does"
            title="One place to plan, launch, learn, and act"
            body="The platform is built around the daily loop of ad operations: collect the signal, decide what matters, assign the work, and keep the team aligned."
          />
          <div className="grid gap-5 md:grid-cols-4">
            {[
              ['Plan', 'Turn campaign briefs into tasks, owners, timelines, budgets, and approvals.'],
              ['Execute', 'Coordinate assets, channels, meetings, and launch work across the team.'],
              ['Analyze', 'Use AI-assisted spreadsheet and campaign analysis to spot what changed.'],
              ['Optimize', 'Promote recommendations into decisions, follow-ups, and next tests.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-brand-teal/15 bg-white p-6 shadow-sm">
                <div className="mb-4 h-1.5 w-16 rounded-full bg-brand-gradient" />
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Feature hub"
            title="Built for modern ad operations"
            body="Each module supports a specific workflow, and together they keep media, creative, and leadership teams working from the same context."
          />
          <FeatureGrid features={features} />
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Connected stack"
            title="Works with the platforms your team already uses"
            body="Marketing Simplified is designed around major ad, collaboration, meeting, and spreadsheet workflows."
          />
          <IntegrationsStrip />
        </div>
      </section>

      <CtaBand
        title="Explore the workflow from every angle"
        body="See how the product maps to specific roles, then compare plan options or learn the core workflows in docs."
        primary={{ label: 'See solutions', href: '/solutions' }}
        secondary={{ label: 'Read docs', href: '/docs' }}
      />
    </>
  );
}

function ValueComparison() {
  const points = [
    { feature: 'Context', oldWay: 'Scattered in Slack & Email', newWay: 'Pinned to the Campaign Record' },
    { feature: 'Decisions', oldWay: 'Buried in meeting notes', newWay: 'Structured, searchable logs' },
    { feature: 'Reporting', oldWay: 'Manual spreadsheet exports', newWay: 'AI-assisted signal detection' },
  ];

  return (
    <section className="bg-gradient-to-b from-white via-brand-teal/5 to-white px-6 py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.35fr] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-28">
          <div className="mb-5 inline-flex rounded-full border border-brand-teal/20 bg-white px-4 py-2 text-sm font-medium text-brand-teal shadow-sm">
            Operating model
          </div>
          <h2 className="text-4xl font-bold tracking-normal text-slate-900 lg:text-5xl">The Operating Upgrade</h2>
          <p className="mt-5 text-base leading-7 text-gray-600 lg:text-lg">
            Replace fragmented campaign operations with a durable system of record for context, decisions, and reporting signals.
          </p>
        </div>

        <div className="space-y-4">
          <div className="hidden grid-cols-[0.75fr_1fr_1fr] gap-4 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
            <span>Workflow</span>
            <span>Traditional Way</span>
            <span className="text-brand-teal">With Marketing Simplified</span>
          </div>

          {points.map((point) => (
            <article
              key={point.feature}
              className="rounded-2xl border border-brand-teal/15 bg-white p-4 shadow-sm transition hover:border-brand-teal/30 hover:shadow-md"
            >
              <div className="grid gap-4 md:grid-cols-[0.75fr_1fr_1fr] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal md:hidden">Workflow</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900 md:mt-0">{point.feature}</h3>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Traditional Way</p>
                  <p className="mt-1 text-sm leading-6 text-gray-500 md:mt-0">{point.oldWay}</p>
                </div>

                <div className="rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal md:hidden">
                    With Marketing Simplified
                  </p>
                  <div className="mt-1 flex items-start gap-3 md:mt-0">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm font-semibold leading-6 text-slate-900">{point.newWay}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}

          <div className="flex items-center gap-3 rounded-2xl border border-brand-teal/15 bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-sm">
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-brand-teal" />
            <span>Less coordination debt, more reusable operating memory for every campaign.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionsPageContent() {
  const roles: Feature[] = [
    { title: 'Media buyers', body: 'Track campaign performance, spot spend changes, and convert analysis into clear budget and testing decisions.', icon: Target },
    { title: 'Creative operations', body: 'Keep assets, versions, approvals, and channel requirements organized before launch.', icon: ClipboardCheck },
    { title: 'Performance marketers', body: 'Use spreadsheet analysis and AI summaries to understand what moved metrics and where to test next.', icon: LineChart },
    { title: 'Agency and account teams', body: 'Create a shared operating layer for client campaigns, meeting follow-ups, reports, and execution tasks.', icon: Users },
    { title: 'Marketing leadership', body: 'See risks, decisions, campaign status, and cross-team progress without chasing scattered updates.', icon: Gauge },
  ];
  const scenarios = [
    {
      title: 'Media buyer budget pacing',
      situation: 'Spend is moving faster than forecast across Google Ads, Meta Ads, and TikTok.',
      outcome: 'Buyers see pacing risk, capture the reason, and turn budget shifts into decisions and follow-up tasks.',
    },
    {
      title: 'Creative ops approval loops',
      situation: 'New assets need review before platform preview, client feedback, and launch handoff.',
      outcome: 'Creative teams keep versions, approvers, channel requirements, and deadlines visible in one workflow.',
    },
    {
      title: 'Agency client reporting',
      situation: 'Account teams need a weekly story from campaign data, decisions, meetings, and open work.',
      outcome: 'Client updates pull from the same operating record instead of scattered spreadsheets and chat threads.',
    },
    {
      title: 'Leadership risk visibility',
      situation: 'Leaders need to know which launches, spend shifts, policy issues, or approvals need attention.',
      outcome: 'Executives get a concise view of campaign status, unresolved decisions, and the next responsible owner.',
    },
    {
      title: 'Policy remediation workflow',
      situation: 'A platform policy update or rejected ad affects active campaigns and creative assets.',
      outcome: 'Teams track affected campaigns, mitigation steps, review owners, and launch-safe follow-through.',
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Solutions for media teams"
        description="Translate product capabilities into practical workflows for the people responsible for planning, launching, reviewing, and improving paid media."
        primary={{ label: 'Compare pricing', href: '/docs/pricing' }}
        secondary={{ label: 'Learn workflows', href: '/docs' }}
      />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="By role"
            title="Give every stakeholder a clear operating view"
            body="Marketing Simplified keeps role-specific work visible while preserving one shared record for campaigns, decisions, and follow-through."
          />
          <FeatureGrid features={roles} />
        </div>
      </section>

      <ValueComparison />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Use cases"
            title="Role-specific scenarios and outcomes"
            body="Each solution starts from a real operating problem and ends with a clearer decision, owner, or next action."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {scenarios.map((scenario) => (
              <article key={scenario.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <PlayCircle className="mb-5 h-8 w-8 text-brand-teal" />
                <h3 className="text-xl font-bold text-gray-900">{scenario.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{scenario.situation}</p>
                <p className="mt-4 rounded-xl bg-brand-teal/5 p-4 text-sm font-medium leading-6 text-gray-700">
                  Outcome: {scenario.outcome}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Platform context"
            title="Ad-channel workflows stay close to the work"
            body="Bring campaign context from major media channels into planning, approval, reporting, and decision workflows."
          />
          <IntegrationsStrip />
        </div>
      </section>

      <CtaBand
        title="Turn use cases into an adoption path"
        body="Start with the workflows that matter most, then grow into pricing and documentation as the team expands."
        primary={{ label: 'View pricing', href: '/docs/pricing' }}
        secondary={{ label: 'Open docs', href: '/docs' }}
      />
    </>
  );
}

export function PricingPageContent() {
  const plans = [
    {
      name: 'Starter',
      fit: 'Small teams validating a focused ad-ops workflow.',
      cta: 'Start trial',
      href: '/login',
      features: ['Campaign workspace basics', 'Task and meeting coordination', 'Core integrations', 'Self-serve onboarding'],
    },
    {
      name: 'Growth',
      fit: 'Teams running multiple channels and recurring reviews.',
      cta: 'Start trial',
      href: '/login',
      features: ['AI Agent workflows', 'Spreadsheet analysis', 'Decision tracking', 'Campaign templates'],
    },
    {
      name: 'Scale',
      fit: 'Agencies and operators coordinating larger campaign portfolios.',
      cta: 'Contact sales',
      href: '/docs',
      features: ['Advanced workflow design', 'Cross-team reporting', 'Review and approval controls', 'Priority onboarding'],
    },
    {
      name: 'Enterprise',
      fit: 'Organizations needing custom rollout, governance, and support.',
      cta: 'Contact sales',
      href: '/docs',
      features: ['Custom implementation plan', 'Security and policy review', 'Admin-oriented workflows', 'Dedicated success path'],
    },
  ];

  const questions = [
    ['Is there public dollar pricing?', 'Not yet. The pricing page uses named tiers and buyer guidance without publishing unapproved dollar amounts.'],
    ['Can we start with a trial?', 'Yes. The primary self-serve path sends users to account creation or login so they can begin evaluating the product.'],
    ['How do seats work?', 'Plan fit should be based on team size, number of active campaign operators, and how many stakeholders need visibility.'],
    ['What affects usage?', 'AI-assisted analysis, connected integrations, campaign volume, and reporting workflows can change the right package.'],
    ['Which integrations are included?', 'The public page highlights Google Ads, Meta Ads, TikTok, Slack, Zoom, Google Sheets, and Google Gemini as core workflow context.'],
    ['Can we connect ad platform accounts?', 'Connected accounts should be authorized by the customer and used only for permitted campaign management, reporting, preview, and analysis workflows.'],
    ['Do you support onboarding?', 'The Scale and Enterprise positioning includes guided onboarding for teams with more complex workflows.'],
    ['How do I choose a plan?', 'Start with the smallest plan that covers active workflows, then move up when you need more automation, reporting, governance, or rollout support.'],
  ];

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Pricing built for modern ad teams"
        description="Choose the package that matches your campaign volume, collaboration needs, integrations, and support expectations. No public dollar amounts are listed until final pricing is approved."
        primary={{ label: 'Start trial', href: '/login' }}
        secondary={{ label: 'Read docs', href: '/docs' }}
        showPreview={false}
      />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.name} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                <p className="mt-3 min-h-20 text-sm leading-6 text-gray-600">{plan.fit}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-teal" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-8 rounded-full bg-brand-gradient text-white hover:saturate-150">
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.35fr] lg:gap-20">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
              Q&A
            </div>
            <h2 className="text-4xl font-bold tracking-normal text-slate-900 lg:text-5xl">
              Product and pricing questions
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-gray-600">
              Quick answers for teams comparing plans, trial paths, integrations, usage, and rollout needs.
            </p>
          </div>

          <div className="border-y border-gray-200">
            {questions.map(([question, answer]) => (
              <details key={question} className="group border-b border-gray-200 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-lg font-medium text-gray-900 transition hover:text-brand-teal [&::-webkit-details-marker]:hidden">
                  <span>{question}</span>
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-700 transition-transform duration-200 group-open:rotate-180 group-hover:text-brand-teal" />
                </summary>
                <div className="pb-6 pr-12">
                  <p className="max-w-3xl text-base leading-7 text-gray-600">{answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Find the right package for your workflow"
        body="Start with a trial path, or use docs to map the product to your team before a deeper buying conversation."
        primary={{ label: 'Start trial', href: '/login' }}
        secondary={{ label: 'Explore product', href: '/docs/product' }}
      />
    </>
  );
}

export function DocsPageContent() {
  const toc = docsTocByPath['/docs'];

  return (
    <DocsArticleShell
      activeHref="/docs"
      eyebrow="Documentation"
      title="Learn Marketing Simplified"
      description="Use this documentation hub to understand campaign workflows, AI-assisted analysis, integrations, decisions, and policy response before entering the workspace."
      toc={toc}
    >
      <DocSection id="getting-started" title="Getting started">
        <p>
          Start with the product model: Marketing Simplified connects campaign planning, analysis, decisions, meetings,
          and execution tasks. The docs are organized by the workflows a media team typically runs each week.
        </p>
        <DocCardGrid
          items={[
            { title: 'Product guide', body: 'Learn the main modules and how they fit together.', href: '/docs/product' },
            { title: 'Pricing guide', body: 'Compare plan fit, usage drivers, and rollout paths.', href: '/docs/pricing' },
            { title: 'Policy guide', body: 'Review data use, connected-account rules, and platform responsibilities.', href: '/docs/policy' },
          ]}
        />
      </DocSection>

      <DocSection id="campaign-setup" title="Campaign setup">
        <p>
          Define the campaign objective, platforms, team owners, budget context, milestones, and review cadence. Campaign
          templates and tasks help keep launch work visible from brief to execution.
        </p>
      </DocSection>

      <DocSection id="ai-agent-workflows" title="AI Agent workflows">
        <p>
          AI Agent workflows help teams ask questions about campaign context, summarize findings, generate recommendations,
          and create follow-up tasks or decisions that the team can review.
        </p>
      </DocSection>

      <DocSection id="spreadsheet-analysis" title="Spreadsheet analysis">
        <p>
          Upload campaign spreadsheets to centralize performance data, identify unusual spend or performance movement, and
          turn analysis into recommendations connected to campaign work.
        </p>
      </DocSection>

      <DocSection id="decisions-follow-up" title="Decisions and follow-up">
        <p>
          Use decisions to capture options, evidence, risk, approvals, and follow-up tasks. This creates a durable record of
          why campaign changes were made and how teams acted on them.
        </p>
      </DocSection>

      <DocSection id="policy-response" title="Policy response">
        <p>
          Track policy updates, affected campaigns, immediate actions, mitigation owners, and review status. Policy response
          workflows help teams organize platform changes without replacing advertiser responsibility.
        </p>
      </DocSection>
    </DocsArticleShell>
  );
}

export function PolicyPageContent() {
  const policySections: Feature[] = [
    { title: 'Data we collect', body: 'Account profile details, workspace activity, campaign records, uploaded assets, spreadsheet data, connected-platform metadata, and support context needed to provide the service.', icon: FileText },
    { title: 'How data is used', body: 'To power campaign workflows, analysis, reporting, collaboration, account administration, product reliability, and customer support.', icon: Zap },
    { title: 'Storage and protection', body: 'Use access controls, least-privilege operational practices, and reasonable safeguards appropriate for campaign and workspace data.', icon: ShieldCheck },
    { title: 'Deletion and export', body: 'Customers should be able to request data export or deletion through account, admin, or support workflows, subject to legal and operational limits.', icon: ClipboardCheck },
    { title: 'Connected accounts', body: 'Users are responsible for connecting only accounts they are authorized to manage and for keeping platform credentials and permissions current.', icon: Users },
    { title: 'Campaign responsibility', body: 'Customers remain responsible for ad claims, targeting, assets, landing pages, legal requirements, and platform-specific rules.', icon: Megaphone },
  ];

  const platforms = [
    ['Meta', 'Ad review, Advertising Standards, account restrictions, business asset integrity, and destination consistency across Facebook and Instagram workflows.'],
    ['Google Ads', 'Prohibited content, prohibited practices, restricted content, editorial quality, technical quality, destination requirements, and data collection/use rules.'],
    ['TikTok', 'Ad creative and landing-page functionality, prohibited and restricted categories, data collection standards, advertiser account policy, and market-specific requirements.'],
    ['Other media platforms', 'Advertisers should review applicable channel terms, local law, brand safety rules, and data-use requirements before launching campaigns.'],
  ];

  return (
    <>
      <PageHero
        eyebrow="Policy"
        title="Platform use and data policy"
        description="This page explains how Marketing Simplified approaches data, connected ad accounts, campaign responsibility, and platform-policy awareness. It is product guidance, not legal advice."
        primary={{ label: 'Read docs', href: '/docs' }}
        secondary={{ label: 'View product', href: '/docs/product' }}
        showPreview={false}
      />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Trust basics"
            title="Clear expectations for public evaluation"
            body="Before trial or purchase, teams should understand what data is involved and what responsibilities remain with the advertiser."
          />
          <FeatureGrid features={policySections} />
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Platform alignment"
            title="Built around major advertising policy themes"
            body="Marketing Simplified workflows should help teams stay aware of platform requirements while the advertiser remains responsible for compliance."
          />
          <div className="grid gap-5 md:grid-cols-2">
            {platforms.map(([platform, body]) => (
              <article key={platform} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <ShieldCheck className="mb-5 h-8 w-8 text-brand-teal" />
                <h3 className="text-xl font-bold text-gray-900">{platform}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl rounded-3xl border border-brand-teal/15 bg-white p-8 shadow-sm lg:p-10">
          <h2 className="text-3xl font-bold text-gray-900">Prohibited uses and escalation</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              ['Do not misuse platform data', 'Do not import, expose, sell, or reuse third-party platform data outside permitted campaign management, reporting, or analysis purposes.'],
              ['Do not bypass ad review', 'Do not use the product to hide destinations, misrepresent offers, evade review, or manipulate platform enforcement systems.'],
              ['Do not upload unsafe assets', 'Do not manage creative that violates platform rules, local law, intellectual property rights, or privacy rights.'],
              ['Escalate uncertain cases', 'When a campaign touches sensitive categories, restricted targeting, minors, regulated products, or unusual data use, route it for policy review before launch.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-gray-50 p-5">
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Use policy review as part of campaign operations"
        body="Docs and pricing pages should route teams back here when they need to understand data, platform, and advertiser responsibilities."
        primary={{ label: 'Open docs', href: '/docs' }}
        secondary={{ label: 'Compare pricing', href: '/docs/pricing' }}
      />
    </>
  );
}
