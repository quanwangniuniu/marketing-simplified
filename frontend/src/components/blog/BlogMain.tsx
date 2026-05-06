'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { isBlogImageSvg } from '@/components/blog/blogPublicImages';
import { cn } from '@/lib/utils';

export type BlogMainSlide = {
  category: string;
  title: string;
  description: string;
  image: string;
  href: string;
};

export type BlogMainProps = {
  slides: readonly BlogMainSlide[];
};

export default function BlogMain({ slides }: Readonly<BlogMainProps>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = slides[activeIndex];

  if (!slide || slides.length === 0) {
    return null;
  }

  const slideIsSvg = isBlogImageSvg(slide.image);

  return (
    <div className="relative m-0 w-full border-0">
      {/* Full-bleed band — wider than the centered content below */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-screen max-w-[100vw] -translate-x-1/2 bg-white"
        aria-hidden
      />

      {/* Same horizontal alignment as PublicPageShell / HeaderSection (`max-w-7xl` + `px-6`) */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col overflow-hidden px-6 lg:flex-row lg:items-stretch">
        <div className="order-2 flex w-full flex-col justify-center py-10 lg:order-1 lg:w-[40%] lg:max-w-[40%] lg:flex-none lg:py-14 lg:pr-10">
          <p className="m-0 mb-0 text-sm font-normal leading-normal text-gray-500">{slide.category}</p>
          <Link
            href={slide.href}
            className="group/title mb-5 block max-w-full rounded-sm focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
          >
            <h2 className="m-0 text-[36px] font-bold leading-[1.15] tracking-tight text-gray-900 transition decoration-2 underline-offset-4">
              {slide.title}
            </h2>
          </Link>
          <p className="m-0 mb-6 text-[16px] font-normal leading-relaxed text-gray-600">{slide.description}</p>
          <Link
            href={slide.href}
            className="mb-8 inline-flex w-fit items-center gap-1 text-[14px] font-bold text-gray-900 underline-offset-4"
          >
            Read more <span aria-hidden>→</span>
          </Link>

          <div className="flex flex-row flex-wrap gap-3" role="tablist" aria-label="Blog slides">
            {slides.map((s, index) => (
              <button
                key={`${s.href}-${index}`}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-controls={`blog-main-panel-${index}`}
                id={`blog-main-tab-${index}`}
                className={cn(
                  'h-5 w-5 shrink-0 rounded-full border-2 border-gray-900 p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2',
                  index === activeIndex ? 'bg-brand-teal' : 'bg-white',
                )}
                onClick={() => setActiveIndex(index)}
              >
                <span className="sr-only">Slide {index + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <Link
          href={slide.href}
          id={`blog-main-panel-${activeIndex}`}
          role="tabpanel"
          aria-labelledby={`blog-main-tab-${activeIndex}`}
          aria-label={`Read article: ${slide.title}`}
          className={cn(
            'group relative order-1 aspect-[16/9] w-full shrink-0 cursor-pointer bg-white lg:order-2 lg:aspect-[2.15/1] lg:w-[60%] lg:max-w-[60%] lg:flex-none',
            'block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2',
          )}
        >
          <Image
            src={slide.image}
            alt=""
            fill
            unoptimized={slideIsSvg}
            className={cn(
              'transition duration-300',
              slideIsSvg ? 'object-contain object-center bg-white p-6' : 'object-cover',
            )}
            sizes="(max-width: 1024px) 100vw, 60vw"
            priority={activeIndex === 0}
          />
        </Link>
      </div>
    </div>
  );
}
