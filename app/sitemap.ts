import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/booking`, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
