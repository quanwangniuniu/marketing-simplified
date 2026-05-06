import type { ReactNode } from 'react';
import Link from 'next/link';
import { privacyToc } from '@/components/legal/privacyToc';

function TocNav({ className }: Readonly<{ className?: string }>) {
  return (
    <nav aria-label="Table of contents" className={className}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Table of contents</p>
      <ul className="space-y-1">
        {privacyToc.map((item) => (
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

export default function PrivacyPage() {
  return (
    <>
      <a
        href="#privacy-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-28 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="mb-10 border-b border-gray-200 pb-10 lg:hidden">
          <div className="mb-4 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-normal text-slate-900">Privacy Policy</h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: May 5, 2026</p>
          <p className="text-sm text-gray-500">Effective date: May 5, 2026</p>
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

          <main id="privacy-main" className="min-w-0 flex-1 lg:pl-10" tabIndex={-1}>
            <header className="mb-10 hidden pb-10 lg:block">
              <h1 className="text-4xl font-bold tracking-normal text-slate-900">Privacy Policy</h1>
              <p className="mt-4 text-sm text-gray-500">Last updated: May 5, 2026</p>
              <p className="text-sm text-gray-500">Effective date: May 5, 2026</p>
              <p className="mt-6 max-w-[72ch] text-lg leading-8 text-gray-600">
                This policy explains how Marketing Simplified processes personal data on our public site and in the
                product. It is intended to help customers understand data categories, responsibilities, and available
                privacy choices.
              </p>
            </header>

            <p className="mb-10 max-w-[72ch] text-lg leading-8 text-gray-600 lg:hidden">
              This policy explains how Marketing Simplified processes personal data on our public site and in the product.
            </p>

            <div className="space-y-12 lg:space-y-14">
              <Section id="overview" title="1. Overview">
                <p>
                  Marketing Simplified provides campaign planning, collaboration, analysis, and decision workflows. We
                  process data needed to operate these services and to support account administration, product reliability,
                  and customer support.
                </p>
                <p>
                  This policy applies to public web pages, trial and subscription flows, and product usage. Additional
                  contractual terms may apply under a signed order form or master agreement.
                </p>
              </Section>

              <Section id="data-we-collect" title="2. Data we collect">
                <p>Depending on your use, we may collect:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Account and profile data such as name, email, role, and organization details.</li>
                  <li>Workspace and campaign data such as tasks, decisions, comments, and uploaded files.</li>
                  <li>Connected-platform metadata required for integrations and workflow context.</li>
                  <li>Technical and usage data such as logs, device details, and service diagnostics.</li>
                  <li>Support and communication records from requests made by administrators or users.</li>
                </ul>
              </Section>

              <Section id="how-we-use-data" title="3. How we use data">
                <p>We use data to:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Provide and maintain product features and user access.</li>
                  <li>Run campaign operations workflows requested by your organization.</li>
                  <li>Detect abuse, improve security, and troubleshoot platform issues.</li>
                  <li>Provide support, onboarding, billing operations, and service communications.</li>
                  <li>Improve product quality and reliability through aggregate analysis.</li>
                </ul>
              </Section>

              <Section id="legal-bases" title="4. Legal bases and permissions">
                <p>
                  Where required by law, we rely on appropriate legal bases such as contract performance, legitimate
                  interests, legal obligations, and consent where applicable.
                </p>
                <p>
                  Customers are responsible for ensuring they have the rights and permissions to submit data to the
                  service, including data from connected ad and collaboration platforms.
                </p>
              </Section>

              <Section id="sharing" title="5. Sharing and processors">
                <p>
                  We may share data with trusted service providers that support hosting, infrastructure, analytics,
                  customer communication, and operational workflows. Providers are expected to process data under
                  contractual and security controls.
                </p>
                <p>
                  We may also disclose information where required by law, legal process, or to protect rights, security,
                  and platform integrity.
                </p>
              </Section>

              <Section id="retention" title="6. Retention and deletion">
                <p>
                  We retain personal data for as long as needed to provide the service, comply with legal obligations,
                  resolve disputes, and maintain security and audit records.
                </p>
                <p>
                  Organizations may request export or deletion through administrator workflows or support channels.
                  Certain records may be retained when required for legal, operational, or security reasons.
                </p>
              </Section>

              <Section id="security" title="7. Security controls">
                <p>
                  We use safeguards designed to protect personal data, including access controls, transport protections,
                  and monitoring practices appropriate to the service context.
                </p>
                <p>
                  Security is a shared responsibility: customers should enforce role-based access, review permissions, and
                  complete timely offboarding for users and connected accounts.
                </p>
              </Section>

              <Section id="international-transfers" title="8. International transfers">
                <p>
                  Data may be processed in countries where we or our providers operate. When required, we use appropriate
                  transfer mechanisms and contractual safeguards for cross-border data handling.
                </p>
              </Section>

              <Section id="your-rights" title="9. Your privacy rights">
                <p>
                  Depending on your location, you may have rights to request access, correction, deletion, portability, or
                  restriction of personal data processing, and to object to certain processing activities.
                </p>
                <p>
                  Requests should be submitted through your organization administrator or support channel so we can verify
                  authorization and respond in line with applicable law.
                </p>
              </Section>

              <Section id="children" title="10. Children and minors">
                <p>
                  Marketing Simplified is intended for business use and is not designed for children under the age required
                  by applicable law. If you believe a child has submitted personal data, contact us so we can review and
                  address the request.
                </p>
              </Section>

              <Section id="changes" title="11. Changes to this policy">
                <p>
                  We may update this Privacy Policy from time to time. Material changes are reflected by revising the
                  effective date and, where appropriate, providing additional notice through product or account channels.
                </p>
              </Section>

              <Section id="contact" title="12. Contact">
                <p>
                  For privacy requests or questions, contact your organization administrator or use the support method in
                  your subscription materials.
                </p>
                <p>
                  For related legal references, see our{' '}
                  <Link href="/terms" className="font-medium text-brand-teal underline-offset-2">
                    Terms of Service
                  </Link>
                  ,{' '}
                  <Link href="/cookie-policy" className="font-medium text-brand-teal underline-offset-2">
                    Cookie Policy
                  </Link>
                  , and{' '}
                  <Link href="/docs/policy" className="font-medium text-brand-teal underline-offset-2">
                    Platform use and data policy
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
