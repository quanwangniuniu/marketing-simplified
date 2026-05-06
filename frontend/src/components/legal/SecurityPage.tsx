import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { securityToc } from '@/components/legal/securityToc';
import SecurityFeatureMatrix from '@/components/legal/SecurityFeatureMatrix';

function TocNav({ className }: Readonly<{ className?: string }>) {
  return (
    <nav aria-label="Table of contents" className={className}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Table of contents</p>
      <ul className="space-y-1">
        {securityToc.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block rounded-lg py-3 pl-0 pr-2 text-lg leading-snug text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SecuritySection({
  id,
  title,
  children,
  footer,
}: Readonly<{ id: string; title: string; children: ReactNode; footer?: ReactNode }>) {
  return (
    <section id={id} className="scroll-mt-32">
      <h2 className="text-4xl font-bold tracking-normal text-slate-900">{title}</h2>
      <div className="mt-5 max-w-[72ch] space-y-5 text-lg leading-8 text-gray-600">{children}</div>
      {footer}
    </section>
  );
}

const faqItems: { question: string; answer: ReactNode }[] = [
  {
    question: 'Do you publish SOC 2 or ISO certificates on this page?',
    answer:
      'We only publish externally verifiable claims. For formal assurance packages, subprocessors, or DPA terms, contact your account administrator or our team during evaluation.',
  },
  {
    question: 'Who is responsible for ad platform compliance?',
    answer:
      'Customers remain responsible for ad claims, targeting, assets, data collection, and each platform’s rules. Marketing Simplified helps teams organize work; it does not replace advertiser obligations.',
  },
  {
    question: 'How should we handle employee offboarding?',
    answer:
      'Remove users from your organization, revoke connected integrations they owned, and review organization admin roles so access stays limited to active operators.',
  },
  {
    question: 'Where is the full legal policy?',
    answer: (
      <>
        See the{' '}
        <Link href="/docs/policy" className="font-medium text-brand-teal underline-offset-2">
          Platform use and data policy
        </Link>{' '}
        for data categories, retention framing, sharing, and related topics.
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <>
      <a
        href="#security-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-28 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="mb-10 border-b border-gray-200 pb-10 lg:hidden">
          <div className="mb-4 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
            Security
          </div>
          <h1 className="text-4xl font-bold tracking-normal text-slate-900">Security overview</h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: May 4, 2026</p>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white px-4 py-4 lg:hidden">
          <TocNav />
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:gap-0">
          <aside className="hidden shrink-0 border-gray-200 lg:block lg:w-[280px] lg:border-r lg:pr-6">
            <div className="lg:sticky lg:top-24 lg:pb-10 lg:pl-1 lg:pt-2">
              <TocNav />
            </div>
          </aside>

          <main id="security-main" className="min-w-0 flex-1 lg:pl-10" tabIndex={-1}>
            <header className="mb-10 hidden pb-10 lg:block">
              <h1 className="text-4xl font-bold tracking-normal text-slate-900">Security overview</h1>
              <p className="mt-4 text-sm text-gray-500">Last updated: May 4, 2026</p>
              <p className="mt-6 max-w-[72ch] text-lg leading-8 text-gray-600">
                This page summarizes how Marketing Simplified approaches security for workspace and campaign data. It is
                meant for evaluation and operational clarity and does not replace your review of the{' '}
                <Link href="/docs/policy#security" className="font-medium text-brand-teal underline-offset-2">
                  full policy detail
                </Link>
                .
              </p>
            </header>

            <p className="mb-10 max-w-[72ch] text-lg leading-8 text-gray-600 lg:hidden">
              This page summarizes how Marketing Simplified approaches security for workspace and campaign data. For
              legal framing, see the{' '}
              <Link href="/docs/policy#security" className="font-medium text-brand-teal underline-offset-2">
                full policy detail
              </Link>
              .
            </p>

            <div className="space-y-12 lg:space-y-14">
              <SecuritySection id="overview" title="Security at a glance" footer={<SecurityFeatureMatrix />}>
                <p>
                  Marketing Simplified brings campaign planning, assets, spreadsheets, connected platforms, and
                  collaboration into one workspace. Security is a shared responsibility between our service practices and
                  your organization&apos;s controls.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="font-semibold text-gray-800">Encryption in transit</strong> — HTTPS for browser
                    and API traffic; stored data protected with safeguards appropriate to our environment.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Access control</strong> — Organization-scoped
                    access, role-based permissions, and least privilege for admins and operators.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Connected accounts</strong> — Integrations should be
                    authorized only by people permitted to manage those ad or collaboration accounts.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Operational resilience</strong> — Monitoring,
                    logging, and backup practices support reliability and recovery workflows.
                  </li>
                </ul>
                <p className="text-base leading-7 text-gray-600">
                  Related:{' '}
                  <Link href="/cookie-policy" className="font-medium text-brand-teal underline-offset-2">
                    Cookie Policy
                  </Link>
                  {' · '}
                  <Link href="/docs" className="font-medium text-brand-teal underline-offset-2">
                    Documentation
                  </Link>
                  {' · '}
                  <Link href="/docs/policy" className="font-medium text-brand-teal underline-offset-2">
                    Platform use and data policy
                  </Link>
                  .
                </p>
              </SecuritySection>

              <SecuritySection id="data-handling" title="Data handling">
                <p>
                  The product may process account profile information, organization and workspace details, campaign
                  records, task data, meeting context, uploaded assets, spreadsheet content, connected-platform metadata,
                  and support communications—consistent with the categories described in our policy guide.
                </p>
                <p>
                  When users connect third-party advertising or collaboration services, the product may receive data
                  needed to provide previews, reporting, analysis, workflow automation, or account-status context. Only
                  connect sources your organization is authorized to use.
                </p>
              </SecuritySection>

              <SecuritySection id="identity-access" title="Identity and access">
                <p>
                  Access should follow least privilege: grant the minimum permissions needed for campaign work, limit
                  organization administrator roles to trusted operators, and remove access when people leave a project or
                  employer.
                </p>
                <p>
                  Subscription and account-level administration should remain limited to authorized organization admins.
                  For shared campaign operations, use approvals, decision records, and task ownership so important
                  changes stay traceable.
                </p>
              </SecuritySection>

              <SecuritySection id="connected-accounts" title="Connected accounts and tokens">
                <p>
                  Connectors typically rely on industry-standard authorization flows (for example OAuth-style grants).
                  Tokens and refresh behavior are managed as part of the application stack; users should disconnect
                  integrations and rotate credentials when teams or responsibilities change.
                </p>
                <p>
                  Legal and contractual detail about processors, sharing, and responsibilities appears in the{' '}
                  <Link href="/docs/policy" className="font-medium text-brand-teal underline-offset-2">
                    Platform use and data policy
                  </Link>
                  .
                </p>
              </SecuritySection>

              <SecuritySection id="infrastructure-encryption" title="Infrastructure and encryption">
                <p>
                  We use transport encryption for data moving between clients and our services. At-rest protections
                  follow the practices of our hosting and data-store providers and are reviewed as part of our security
                  program.
                </p>
                <p>
                  We do not publish detailed internal topology on this marketing page. Enterprise buyers may request
                  deeper materials through the appropriate evaluation channel.
                </p>
              </SecuritySection>

              <SecuritySection id="logging-backups" title="Logging, monitoring, and availability">
                <p>
                  Operational logging supports reliability, diagnostics, and security monitoring. We aim to avoid
                  collecting more personal data than necessary to operate and improve the service.
                </p>
                <p>
                  Backup and recovery practices help protect availability for workspace information. Backup access
                  should remain restricted and audited so campaign records and assets can be restored without broadening
                  who can see them unnecessarily.
                </p>
              </SecuritySection>

              <SecuritySection id="customer-controls" title="What your organization controls">
                <p>Your team should maintain:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Periodic reviews of user membership and roles inside the workspace.</li>
                  <li>Reviews of connected ad-platform and collaboration permissions.</li>
                  <li>Offboarding steps that remove product access and revoke integrations where applicable.</li>
                  <li>Processes for export or deletion requests routed through administrators or support.</li>
                </ul>
              </SecuritySection>

              <section id="faq" className="scroll-mt-32">
                <h2 className="text-4xl font-bold tracking-normal text-slate-900">Security FAQ</h2>
                <div className="mt-5 max-w-[72ch] border-y border-gray-200">
                  {faqItems.map(({ question, answer }) => (
                    <details key={question} className="group border-b border-gray-200 last:border-b-0">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-medium text-gray-900 transition hover:text-brand-teal [&::-webkit-details-marker]:hidden">
                        <span>{question}</span>
                        <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-700 transition-transform duration-200 group-open:rotate-180 group-hover:text-brand-teal" />
                      </summary>
                      <div className="pb-5 pr-10 text-sm leading-7 text-gray-600">{answer}</div>
                    </details>
                  ))}
                </div>
              </section>

              <SecuritySection id="contact" title="Contact and next steps">
                <p>
                  For questions during evaluation, route requests through your account administrator or the support path
                  described in your agreement or onboarding materials.
                </p>
                <p>
                  Ready to explore the product? Open the{' '}
                  <Link href="/docs" className="font-medium text-brand-teal underline-offset-2">
                    documentation hub
                  </Link>{' '}
                  or start from the{' '}
                  <Link href="/login" className="font-medium text-brand-teal underline-offset-2">
                    sign-in
                  </Link>{' '}
                  page when your organization is prepared.
                </p>
              </SecuritySection>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
