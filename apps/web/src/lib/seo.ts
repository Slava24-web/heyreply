import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * Public origin of the site, e.g. https://heyreply.site (WEB_ORIGIN, the same variable the API uses).
 * Canonical links, hreflang, the sitemap and social previews need absolute URLs.
 */
export function siteOrigin(): URL {
  try {
    return new URL(process.env.WEB_ORIGIN || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

export type Locale = (typeof routing.locales)[number];

/** `/ru/privacy` for ('ru', '/privacy'); the start page of a locale is `/ru`. */
export const localePath = (locale: string, path: string) => `/${locale}${path === '/' ? '' : path}`;

/**
 * Self-canonical plus the full set of language alternates (every locale, the page itself included) and x-default.
 * x-default is the default locale's page: a real 200 page, not a redirect. Query strings never enter the canonical.
 */
export function alternatesFor(locale: string, path: string): NonNullable<Metadata['alternates']> {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localePath(l, path)])),
      'x-default': localePath(routing.defaultLocale, path),
    },
  };
}

const OG_LOCALE: Record<string, string> = { ru: 'ru_RU', en: 'en_US' };

/** Public pages that should be found by search (and listed in the sitemap), as locale-less paths. */
export const INDEXABLE_PATHS = ['/', '/boards/hh', '/boards/linkedin', '/boards/habr', '/boards/indeed', '/guides/application-conversion', '/register', '/privacy', '/terms', '/consent'] as const;

interface PageSeo {
  locale: string;
  path: string;
  title: string;
  description: string;
  /** Pages with nothing to offer a searcher (sign-in, password reset) stay out of the index but remain crawlable. */
  noindex?: boolean;
}

/** Everything a page needs for search and sharing: title, description, canonical, hreflang, robots, Open Graph, Twitter. */
export async function pageMetadata({ locale, path, title, description, noindex }: PageSeo): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  const url = localePath(locale, path);
  // Titles of other pages get the brand from the layout template; the start page names it itself
  const shareTitle = title.includes('heyreply') ? title : `${title} · heyreply`;
  const image = { url: `/og/${locale}.png`, width: 1200, height: 630, alt: t('title') };
  return {
    title,
    description,
    alternates: alternatesFor(locale, path),
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      siteName: 'heyreply',
      title: shareTitle,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [image.url] },
  };
}

type Params = Promise<{ locale: string }>;

/** Metadata of an account page (sign in, sign up, password reset); texts live in messages `meta.pages.<key>`. */
export async function authPageMetadata(params: Params, key: 'login' | 'register' | 'forgotPassword' | 'resetPassword', path: string, noindex: boolean) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: `meta.pages.${key}` });
  return pageMetadata({ locale, path, title: t('title'), description: t('description'), noindex });
}

/** Metadata of a legal document: its title comes from `legal.<doc>`, the summary from `meta.legal.<doc>`. */
export async function legalPageMetadata(params: Params, doc: 'privacy' | 'terms' | 'consent') {
  const { locale } = await params;
  const [tl, tm] = await Promise.all([getTranslations({ locale, namespace: 'legal' }), getTranslations({ locale, namespace: 'meta.legal' })]);
  return pageMetadata({ locale, path: `/${doc}`, title: tl(doc), description: tm(doc) });
}
