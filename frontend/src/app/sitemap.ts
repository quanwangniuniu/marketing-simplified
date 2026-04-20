import type { MetadataRoute } from 'next';

const getSiteUrl = () => {
	const raw = process.env.NEXT_PUBLIC_SITE_URL;
	if (!raw) {
		throw new Error('Missing NEXT_PUBLIC_SITE_URL for sitemap generation');
	}
	return raw.replace(/\/+$/, '');
};

export default function sitemap(): MetadataRoute.Sitemap {
	const siteUrl = getSiteUrl();

	// put paths in array
	const paths = [
		'/tasks',
		'/spreadsheet',
		'/decisions',
		'/agent',
		'/notion',
		'/meetings',
	];

	return paths.map((path) => ({
		url: `${siteUrl}${path}`,
		changeFrequency: 'weekly',
		priority: 0.7,
		lastModified: new Date(),
	}));
}