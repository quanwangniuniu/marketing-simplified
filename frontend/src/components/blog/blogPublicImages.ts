/**
 * Filenames in `frontend/public/blog/`. Only these are used for blog cards and the main carousel.
 * URLs are built with encodeURIComponent so spaces and parentheses in names are valid.
 */
export const BLOG_PUBLIC_IMAGE_FILES = [
  'At the office-cuate.svg',
  'Blog post-cuate.svg',
  'Book lover-cuate.svg',
  'Business deal-cuate.svg',
  'Business Plan-cuate.svg',
  'Chat bot-cuate.svg',
  'Conversation-cuate.svg',
  'Customer Survey-cuate.svg',
  'Data extraction-cuate.svg',
  'Documents-cuate.svg',
  'Exams-cuate.svg',
  'Finance-cuate.svg',
  'Hand coding-cuate.svg',
  'Investment data-cuate.svg',
  'Learning-cuate.svg',
  'Mathematics-cuate.svg',
  'Medicine-cuate.svg',
  'Mental health-cuate.svg',
  'Mobile Marketing-cuate.svg',
  'No data-cuate.svg',
  'Online learning-cuate.svg',
  'Processing-cuate.svg',
  'Questions-cuate.svg',
  'Research paper-cuate.svg',
  'Search engines-cuate.svg',
  'Server-cuate.svg',
  'Stress-cuate (1).svg',
  'Stress-cuate.svg',
  'Team-cuate.svg',
  'Telecommuting-cuate.svg',
  'Time management-cuate.svg',
] as const;

export function blogPublicImageAt(index: number): string {
  const files = BLOG_PUBLIC_IMAGE_FILES;
  const name = files[index % files.length] ?? files[0];
  return `/blog/${encodeURIComponent(name)}`;
}

export function isBlogImageSvg(src: string): boolean {
  return /\.svg(\?|#|$)/i.test(src);
}
