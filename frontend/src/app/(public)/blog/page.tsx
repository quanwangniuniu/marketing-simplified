import type { Metadata } from 'next';
import PublicPageShell from '@/components/home/PublicPageShell';
import { blogExploreMoreItems } from '@/components/blog/blogExploreMoreContent';
import BlogPageListing from '@/components/blog/BlogPageListing';
import { blogFeaturedSlidesFromExamples, blogPostExamples } from '@/components/blog/blogPostExamples';

export const metadata: Metadata = {
  title: 'Blog | Marketing Simplified',
  description: 'Updates, workflows, and ideas from the Marketing Simplified team.',
};

export default function BlogPage() {
  const posts = blogPostExamples;

  return (
    <PublicPageShell>
      <BlogPageListing
        featuredSlides={blogFeaturedSlidesFromExamples(posts)}
        posts={posts}
        exploreItems={blogExploreMoreItems}
      />
    </PublicPageShell>
  );
}
