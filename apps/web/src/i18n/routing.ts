import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en'],
  defaultLocale: 'en',
  // hreflang is declared in each page's metadata and in the sitemap (with a real x-default); the header version pointed x-default at a redirect
  alternateLinks: false,
});
