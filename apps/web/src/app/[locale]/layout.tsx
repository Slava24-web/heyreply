import type { Metadata, Viewport } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { siteOrigin } from '@/lib/seo';
import { Providers } from '@/components/providers';
import '../globals.css';

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-onest', display: 'swap' });
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded', weight: ['400', '500', '600'], display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    // Base for every relative URL in the metadata (canonical, hreflang, Open Graph images)
    metadataBase: siteOrigin(),
    applicationName: 'heyreply',
    title: { default: t('title'), template: '%s · heyreply' },
    description: t('description'),
    // Site ownership for the webmaster tools; the tags appear only when the values are set in the environment
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      yandex: process.env.YANDEX_VERIFICATION || undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#131015' },
  ],
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Per-request CSP nonce from proxy.ts — next-themes injects an inline script that must carry it
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang={locale} suppressHydrationWarning className={`${onest.variable} ${unbounded.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers nonce={nonce}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
