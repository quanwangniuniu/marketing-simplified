import type { ReactNode } from 'react';
import Link from 'next/link';
import { termsToc } from '@/components/legal/termsToc';

function TocNav({ className }: Readonly<{ className?: string }>) {
  return (
    <nav aria-label="Table of contents" className={className}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Table of contents</p>
      <ul className="space-y-1">
        {termsToc.map((item) => (
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

function Section({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section id={id} className="scroll-mt-32">
      <h2 className="text-4xl font-bold tracking-normal text-slate-900">{title}</h2>
      <div className="mt-5 max-w-[90ch] space-y-5 text-lg leading-8 text-gray-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <a
        href="#terms-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-28 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="mb-10 border-b border-gray-200 pb-10 lg:hidden">
          <div className="mb-4 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-normal text-slate-900">Terms of Service</h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: May 4, 2026</p>
          <p className="text-sm text-gray-500">Effective date: May 4, 2026</p>
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

          <main id="terms-main" className="min-w-0 flex-1 lg:pl-10" tabIndex={-1}>
            <header className="mb-10 hidden pb-10 lg:block">
              <h1 className="text-4xl font-bold tracking-normal text-slate-900">Terms of Service</h1>
              <p className="mt-4 text-sm text-gray-500">Last updated: May 4, 2026</p>
              <p className="text-sm text-gray-500">Effective date: May 4, 2026</p>
              <p className="mt-6 max-w-[72ch] text-lg leading-8 text-gray-600">
                These Terms govern access to and use of Marketing Simplified by customers, administrators, and authorized
                users. If there is any conflict between a translated version and the English version, the English version
                controls.
              </p>
              
            </header>

            <p className="mb-10 max-w-[72ch] text-lg leading-8 text-gray-600 lg:hidden">
              These Terms govern access to and use of Marketing Simplified by customers, administrators, and authorized
              users.
            </p>

            <div className="space-y-12 lg:space-y-14">
              <Section id="overview" title="1. Overview">
                <p>
                  This agreement is between your organization and Marketing Simplified for use of the service. By creating
                  an account, placing an order, or using the service, your organization agrees to these Terms.
                </p>
                <p>
                  If you use the service on behalf of a company, you represent that you have authority to bind that
                  company.
                </p>
              </Section>

              <Section id="service" title="2. The service">
                <p>
                  During the subscription term, your organization may access and use the service for internal business
                  operations in accordance with product documentation and these Terms.
                </p>
                <p>
                  You may not misuse the service, attempt unauthorized access, interfere with service integrity, or use the
                  service in ways that violate applicable law.
                </p>
              </Section>

              <Section id="accounts" title="3. Accounts and security">
                <p>
                  Your organization is responsible for account management, role assignment, and safeguarding login
                  credentials. Access should follow least privilege and be reviewed regularly.
                </p>
                <p>
                  You must promptly notify us of suspected unauthorized access, compromised credentials, or other security
                  incidents affecting your workspace.
                </p>
              </Section>

              <Section id="customer-content" title="4. Customer content">
                <p>
                  Your organization retains ownership of customer content submitted to the service, including campaign
                  assets, planning records, and workspace data.
                </p>
                <p>
                  You grant us a limited license to host, process, and transmit customer content only as needed to provide,
                  secure, and improve the service in line with applicable agreements and policies.
                </p>
              </Section>

              <Section id="billing" title="5. Billing and renewals">
                <p>
                  Fees, billing cycles, and renewal terms are defined in your order form or subscription plan. Unless
                  otherwise specified, renewals occur automatically at the end of each term.
                </p>
                <p>
                  Your organization is responsible for applicable taxes, except taxes based on our net income.
                </p>
              </Section>

              <Section id="third-party" title="6. Third-party services">
                <p>
                  The service may interoperate with third-party platforms. Your use of third-party services is governed by
                  those providers&apos; terms and policies.
                </p>
                <p>
                  Your organization is responsible for ensuring you are authorized to connect and use those external
                  accounts and data sources.
                </p>
              </Section>

              <Section id="availability" title="7. Availability and support">
                <p>
                  We aim to maintain reliable service operations, but uninterrupted availability is not guaranteed.
                  Maintenance windows, third-party outages, or force majeure events may affect service access.
                </p>
                <p>
                  Support channels and response expectations follow your selected plan or written agreement.
                </p>
              </Section>

              <Section id="intellectual-property" title="8. Intellectual property">
                <p>
                  We retain all rights, title, and interest in the service, including software, documentation, and related
                  intellectual property.
                </p>
                <p>
                  Except as expressly permitted, your organization may not copy, modify, reverse engineer, or create
                  derivative works from the service.
                </p>
              </Section>

              <Section id="warranties-disclaimer" title="9. Warranties and disclaimers">
                <p>
                  The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis except as expressly
                  stated in a signed agreement.
                </p>
                <p>
                  To the maximum extent permitted by law, we disclaim implied warranties, including merchantability,
                  fitness for a particular purpose, and non-infringement.
                </p>
              </Section>

              <Section id="liability" title="10. Limitation of liability">
                <p>
                  To the maximum extent permitted by law, neither party is liable for indirect, incidental, special,
                  consequential, or punitive damages, or for loss of profits, revenue, or goodwill.
                </p>
                <p>
                  Each party&apos;s aggregate liability under these Terms is limited to amounts paid or payable under the
                  applicable subscription term, unless otherwise required by law or agreed in writing.
                </p>
              </Section>

              <Section id="termination" title="11. Term and termination">
                <p>
                  These Terms remain effective during your subscription term. Either party may terminate for material breach
                  if the breach is not cured within a reasonable notice period.
                </p>
                <p>
                  After termination or expiration, access to the service may end and data handling follows your agreement
                  and applicable policy obligations.
                </p>
              </Section>

              <Section id="governing-law" title="12. Governing law">
                <p>
                  Governing law and venue are determined by your master agreement, order form, or the default legal entity
                  terms applicable to your subscription.
                </p>
                <p>
                  If no separate governing law clause exists, disputes are handled under applicable commercial law
                  principles in the jurisdiction defined at contracting.
                </p>
              </Section>

              <Section id="changes" title="13. Changes to these terms">
                <p>
                  We may update these Terms from time to time. Material changes will be reflected by updating the date at
                  the top of this page and, where appropriate, by additional notice.
                </p>
                <p>
                  Continued use of the service after an updated effective date constitutes acceptance of the revised Terms.
                </p>
              </Section>

              <Section id="contact" title="14. Contact">
                <p>
                  For legal or contract questions, contact your account representative or use the support path defined in
                  your subscription materials.
                </p>
                <p>
                  For related legal references, see our{' '}
                  <Link href="/docs/policy" className="font-medium text-brand-teal underline-offset-2">
                    Policy guide
                  </Link>{' '}
                  and{' '}
                  <Link href="/cookie-policy" className="font-medium text-brand-teal underline-offset-2">
                    Cookie Policy
                  </Link>
                  .
                </p>
              </Section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
