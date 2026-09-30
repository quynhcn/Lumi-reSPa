import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/staff', '/account', '/sign-in', '/signup', '/review/'] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
