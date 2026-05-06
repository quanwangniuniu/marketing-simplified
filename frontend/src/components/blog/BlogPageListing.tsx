'use client';

import BlogCard, { BLOG_CARD_TYPES, type BlogCardType } from '@/components/blog/BlogCard';
import BlogExploreMore from '@/components/blog/BlogExploreMore';
import BlogMain, { type BlogMainSlide } from '@/components/blog/BlogMain';
import type { BlogExploreMoreItem } from '@/components/blog/blogExploreMoreContent';
import type { BlogPostExample } from '@/components/blog/blogPostExamples';

function blogSectionDomId(type: BlogCardType): string {
  const slug = type
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');
  return `blog-section-${slug}`;
}

export type BlogPageListingProps = {
  featuredSlides: readonly BlogMainSlide[];
  posts: readonly BlogPostExample[];
  exploreItems: readonly BlogExploreMoreItem[];
};

export default function BlogPageListing({
  featuredSlides,
  posts,
  exploreItems,
}: Readonly<BlogPageListingProps>) {
  return (
    <>
      <section className="w-full" aria-label="Featured blog posts">
        <BlogMain slides={featuredSlides} />
      </section>

      <div className="mx-auto mt-12 max-w-7xl space-y-14 px-6 pb-16">
        {BLOG_CARD_TYPES.map((type) => {
          const sectionPosts = posts.filter((p) => p.type === type);
          if (sectionPosts.length === 0) return null;

          const sectionId = blogSectionDomId(type);
          return (
            <section key={type} aria-labelledby={sectionId}>
              <h2 id={sectionId} className="pb-3 text-2xl font-bold tracking-tight text-gray-900">
                {type}
              </h2>
              <ul className="mt-8 grid list-none gap-6 p-0 m-0 sm:grid-cols-2 lg:grid-cols-3">
                {sectionPosts.map((post) => (
                  <li key={`${post.type}-${post.title}`}>
                    <BlogCard
                      image={post.image}
                      type={post.type}
                      title={post.title}
                      excerpt={post.excerpt}
                      author={post.author}
                      time={post.time}
                      href={post.href}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {exploreItems.length > 0 ? <BlogExploreMore items={exploreItems} /> : null}
      </div>
    </>
  );
}
