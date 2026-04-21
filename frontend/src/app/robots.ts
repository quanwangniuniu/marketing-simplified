import type { MetadataRoute } from 'next';

const getSiteUrl = () => {
	const raw = process.env.NEXT_PUBLIC_SITE_URL;
	if (!raw) {
		return null;
	}
	return raw.replace(/\/+$/, '');
};

export default function robots(): MetadataRoute.Robots {
	const siteUrl = getSiteUrl();
	const robotsConfig: MetadataRoute.Robots = {
		rules: {
			userAgent: '*',
			allow: '/',
		},
	};

	if (siteUrl) {
		robotsConfig.sitemap = `${siteUrl}/sitemap.xml`;
	}

	return robotsConfig;
}