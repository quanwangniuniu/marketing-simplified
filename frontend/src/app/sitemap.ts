import type { MetadataRoute } from 'next';

const getSiteUrl = () => {
	const raw = process.env.NEXT_PUBLIC_SITE_URL;
	if (!raw) {
		return null;
	}
	return raw.replace(/\/+$/, '');
};

export default function sitemap(): MetadataRoute.Sitemap {
	const siteUrl = getSiteUrl();
	if (!siteUrl) {
		return [];
	}

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