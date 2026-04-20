import type { MetadataRoute } from 'next';

const getSiteUrl = () => {
	const raw = process.env.NEXT_PUBLIC_SITE_URL;
	if (!raw) {
		throw new Error('Missing NEXT_PUBLIC_SITE_URL for robots generation');
	}
	return raw.replace(/\/+$/, '');
};

export default function robots(): MetadataRoute.Robots {
	const siteUrl = getSiteUrl();

	return {
		rules: {
			userAgent: '*',
			allow: '/',
		},
		sitemap: `${siteUrl}/sitemap.xml`,
	};
}