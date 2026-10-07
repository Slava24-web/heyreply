import type { MetadataRoute } from 'next';
import { LEGAL_VERSION } from '@heyreply/shared';
import { routing } from '@/i18n/routing';
import { INDEXABLE_PATHS, localePath, siteOrigin } from '@/lib/seo';

const LEGAL = new Set<string>(['/privacy', '/terms', '/consent']);

/**
 * Every indexable page in every language, each entry listing all language versions including itself, plus x-default.
 * The same pairs are declared in the pages' <head>; the two must agree or search engines drop the pair.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin().origin;
  const abs = (locale: string, path: string) => `${origin}${localePath(locale, path)}`;
  return INDEXABLE_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: abs(locale, path),
      // Only the legal documents have a known edition date; for the rest an invented date would mislead crawlers
      ...(LEGAL.has(path) ? { lastModified: new Date(`${LEGAL_VERSION}T00:00:00Z`) } : {}),
      alternates: {
        languages: {
          ...Object.fromEntries(routing.locales.map((l) => [l, abs(l, path)])),
          'x-default': abs(routing.defaultLocale, path),
        },
      },
    })),
  );
}
