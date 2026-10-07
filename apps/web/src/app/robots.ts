import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/seo';

/**
 * The signed-in app and the API have nothing to index. Sign-in and password pages are deliberately NOT blocked here:
 * they carry `noindex`, and a crawler can only obey it on a page it is allowed to fetch.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin().origin;
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/*/dashboard', '/*/applications', '/*/analytics', '/*/dictionaries', '/*/settings'] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
