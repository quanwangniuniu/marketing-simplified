'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from '@/components/home/docsNavigation';

type DocsTableOfContentsProps = {
  toc: TocItem[];
};

export default function DocsTableOfContents({ toc }: DocsTableOfContentsProps) {
  const [activeId, setActiveId] = useState(toc[0]?.id ?? '');

  useEffect(() => {
    const sections = toc
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target.id) {
          setActiveId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [toc]);

  return (
    <aside className="hidden lg:block lg:fixed lg:right-8 lg:top-32 lg:w-64">
      <div className="border-l border-gray-200 pl-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">On this page</h2>
        <nav aria-label="Table of contents">
          <ul className="space-y-3">
            {toc.map((item) => {
              const isActive = item.id === activeId;
              return (
                <li key={item.id} className="relative">
                  <span
                    className={`absolute -left-[21px] top-0 h-full w-1 rounded-full transition ${
                      isActive ? 'bg-brand-teal' : 'bg-transparent'
                    }`}
                    aria-hidden="true"
                  />
                  <a
                    href={`#${item.id}`}
                    className={`block text-sm leading-6 transition ${
                      isActive ? 'font-semibold text-gray-950' : 'text-gray-500 hover:text-brand-teal'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
