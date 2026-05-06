import BlogCard from '@/components/blog/BlogCard';
import type { BlogExploreMoreItem } from '@/components/blog/blogExploreMoreContent';

type BlogExploreMoreProps = {
  items: readonly BlogExploreMoreItem[];
};

export default function BlogExploreMore({ items }: Readonly<BlogExploreMoreProps>) {
  return (
    <section aria-labelledby="blog-explore-more-heading">
      <h2 id="blog-explore-more-heading" className="pb-3 text-2xl font-bold tracking-tight text-gray-900">
        Explore more content
      </h2>
      <ul className="mt-8 grid list-none gap-6 p-0 m-0 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.href}>
            <BlogCard
              image={item.image}
              type={item.type}
              title={item.title}
              excerpt={item.excerpt}
              author={item.author}
              time={item.time}
              href={item.href}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
