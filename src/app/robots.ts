import type { MetadataRoute } from 'next';
import { siteUrl } from '@/shared/siteUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing behind authentication, and no API surface, should be indexed.
        disallow: ['/api/', '/dashboard', '/history', '/login', '/register', '/forgot-password'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
