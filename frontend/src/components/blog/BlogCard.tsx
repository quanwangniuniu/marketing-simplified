import Image from 'next/image';
import Link from 'next/link';
import { isBlogImageSvg } from '@/components/blog/blogPublicImages';
import { cn } from '@/lib/utils';

export const BLOG_CARD_TYPES = [
  'Project management',
  'CRM and sales',
  'Product development life cycle',
  'Service management',
  'AI Agents',
  'Productivity',
] as const;

export type BlogCardType = (typeof BLOG_CARD_TYPES)[number];

export type BlogCardProps = {
  image: string;
  type: BlogCardType;
  title: string;
  excerpt: string;
  author: string;
  time: string;
  href: string;
  className?: string;
  coverClassName?: string;
};

export default function BlogCard({
  image,
  type,
  title,
  excerpt,
  author,
  time,
  href,
  className,
  coverClassName,
}: Readonly<BlogCardProps>) {
  const imageIsSvg = isBlogImageSvg(image);

  return (
    <Link
      href={href}
      className={cn(
        'group block h-full rounded-lg py-0 px-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2',
        className,
      )}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-lg   transition hover:border-brand-teal/30 hover:shadow-md">
        <div className={cn('relative aspect-[16/10] w-full shrink-0 bg-white', coverClassName)}>
          <Image
            src={image}
            alt=""
            fill
            unoptimized={imageIsSvg}
            className={cn(
              'transition duration-300 group-hover:scale-[1.02]',
              imageIsSvg ? 'object-contain object-center p-4' : 'object-cover',
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>

        <div className="m-0 flex flex-1 flex-col gap-3 px-[15px] py-[25px]">
          <span className="inline-flex w-fit max-w-full rounded-full border border-brand-teal/25 bg-brand-teal/10 px-2.5 py-1 text-xs font-semibold leading-tight text-brand-teal">
            {type}
          </span>
          <h2 className="text-xl font-bold leading-snug text-gray-900 transition-colors line-clamp-2">
            {title}
          </h2>
          <p className="flex-1 text-base leading-6 text-gray-600 line-clamp-3">{excerpt}</p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-gray-100 pt-4">
            <span className="text-sm font-medium text-gray-700">{author}</span>
            <time className="text-sm tabular-nums text-gray-500">{time}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}
