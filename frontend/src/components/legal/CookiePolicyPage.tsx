import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookiePolicyToc } from '@/components/legal/cookiePolicyToc';

function TocNav({ className }: Readonly<{ className?: string }>) {
  return (
    <nav aria-label="Table of contents" className={className}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Table of contents</p>
      <ul className="space-y-1">
        {cookiePolicyToc.map((item) => (
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
      <div className="mt-5 max-w-[72ch] space-y-5 text-lg leading-8 text-gray-600">{children}</div>
    </section>
  );
}

export default function CookiePolicyPage() {
  return (
    <>
      <a
        href="#cookie-policy-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-28 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="mb-10 border-b border-gray-200 pb-10 lg:hidden">
          <div className="mb-4 inline-flex rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-normal text-slate-900">Cookie Policy</h1>
          <p className="mt-4 text-sm text-gray-500">Last updated: May 4, 2026</p>
        </div>

        <div className="mb-8 lg:hidden">
          <details className="group rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>Table of contents</span>
                <span className="text-gray-400 transition group-open:rotate-180" aria-hidden="true">
                  ▾
                </span>
              </span>
            </summary>
            <div className="border-t border-gray-100 px-2 py-2">
              <TocNav />
            </div>
          </details>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:gap-0">
          <aside className="hidden shrink-0 border-gray-200 lg:block lg:w-[280px] lg:border-r lg:pr-6">
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-10 lg:pl-1 lg:pt-2">
              <TocNav />
            </div>
          </aside>

          <main
            id="cookie-policy-main"
            className="min-w-0 flex-1 lg:pl-10"
            tabIndex={-1}
          >
            <header className="mb-10 hidden pb-10 lg:block">
              <h1 className="text-4xl font-bold tracking-normal text-slate-900">Cookie Policy</h1>
              <p className="mt-4 text-sm text-gray-500">Last updated: May 4, 2026</p>
              <p className="mt-6 max-w-[72ch] text-lg leading-8 text-gray-600">
                This notice describes how Marketing Simplified uses cookies and similar technologies when you visit our
                marketing site and related public pages. It is provided for transparency and does not replace
                professional legal advice.
              </p>
            </header>

            <p className="mb-10 max-w-[72ch] text-lg leading-8 text-gray-600 lg:hidden">
              This notice describes how Marketing Simplified uses cookies and similar technologies when you visit our
              marketing site and related public pages. It is provided for transparency and does not replace professional
              legal advice.
            </p>

            <div className="space-y-12 lg:space-y-14">
              <Section id="introduction" title="1. Introduction">
                <p>
                  We use cookies and similar storage technologies (together, &quot;cookies&quot;) to operate the site,
                  remember preferences, measure basic usage, and improve reliability. By continuing to use our public
                  pages where cookies are deployed, you acknowledge this notice. Where required by law, we will request
                  consent before using non-essential cookies.
                </p>
              </Section>

              <Section id="what-are-cookies" title="2. What are cookies?">
                <p>
                  Cookies are small text files placed on your device by a website. They can be read by the same site on
                  a later visit. Similar technologies include local storage and session storage, which may be used for
                  comparable purposes (for example keeping you signed in or preserving UI state).
                </p>
              </Section>

              <Section id="types-of-cookies" title="3. Types of cookies we use">
                <p>We group cookies into the following categories:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="font-semibold text-gray-800">Strictly necessary</strong> — required for core
                    functionality such as security, load balancing, or remembering cookie preferences.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Functional</strong> — remember choices you make
                    (for example language or layout) to provide a more consistent experience.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Analytics</strong> — help us understand aggregate
                    traffic and errors so we can improve performance and content. Where used, we aim to minimize
                    personal data in analytics signals.
                  </li>
                </ul>
              </Section>

              <Section id="how-we-use-cookies" title="4. How we use cookies">
                <p>
                  We use cookies to keep sessions secure where you log in, to store lightweight UI preferences, and to
                  support diagnostics. Product features that sync with your workspace may rely on authentication cookies
                  managed by our application stack; those are separate from marketing-site analytics and are governed by
                  your account relationship and our platform policy documentation.
                </p>
                <p>
                  For more on how we handle product and workspace data, see our{' '}
                  <Link href="/docs/policy" className="font-medium text-brand-teal underline-offset-2">
                    Platform use and data policy
                  </Link>
                  .
                </p>
              </Section>

              <Section id="third-party" title="5. Third-party cookies">
                <p>
                  Some pages may load content or scripts from third parties (for example embedded media, analytics, or
                  authentication providers). Those providers may set their own cookies subject to their policies. We
                  encourage you to review their documentation if you interact with embedded experiences.
                </p>
              </Section>

              <Section id="your-choices" title="6. Your choices and controls">
                <p>
                  Most browsers let you refuse or delete cookies through settings. Blocking strictly necessary cookies may
                  prevent parts of the site from working. You can also use private browsing modes to limit persistent
                  storage for a session.
                </p>
              </Section>

              <Section id="changes" title="7. Changes to this notice">
                <p>
                  We may update this Cookie Policy from time to time. The &quot;Last updated&quot; date at the top of
                  this page reflects the latest revision. Material changes will be communicated through reasonable
                  channels where appropriate.
                </p>
              </Section>

              <Section id="related" title="8. Related policies">
                <p>
                  For a broader view of data categories, retention, and responsibilities when using Marketing
                  Simplified, see the{' '}
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
