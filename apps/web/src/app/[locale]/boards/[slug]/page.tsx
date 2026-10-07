import { ArrowRight, Check } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { platformSourceName } from '@heyreply/shared';
import { ExtensionInstall } from '@/components/extension-install';
import { PublicShell, publicSection } from '@/components/landing/public-shell';
import { Screenshot } from '@/components/screenshot';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BOARD_SLUGS, isBoardSlug, type BoardSlug } from '@/lib/boards';
import { getExtensionStores } from '@/lib/extension-stores';
import { localePath, pageMetadata, siteOrigin } from '@/lib/seo';
import { cn } from '@/lib/utils';

type Params = Promise<{ locale: string; slug: string }>;

const section = publicSection;
const h2 = 'font-display text-[clamp(22px,2.6vw,30px)] leading-[1.15] font-medium tracking-[-0.02em]';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => BOARD_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isBoardSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: `boards.${slug}` });
  return pageMetadata({ locale, path: `/boards/${slug}`, title: t('metaTitle'), description: t('metaDescription') });
}

export default async function BoardPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isBoardSlug(slug)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'boards' });
  const tl = await getTranslations({ locale, namespace: 'landing' });
  const b = await getTranslations({ locale, namespace: `boards.${slug}` });
  const stores = getExtensionStores();
  const origin = siteOrigin().origin;
  const list = (key: string) => b.raw(key) as string[];
  const others = BOARD_SLUGS.filter((s) => s !== slug);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('home'), item: `${origin}${localePath(locale, '/')}` },
      { '@type': 'ListItem', position: 2, name: b('name'), item: `${origin}${localePath(locale, `/boards/${slug}`)}` },
    ],
  }).replace(/</g, '\\u003c');

  return (
    <PublicShell locale={locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <article className={cn(section, 'flex flex-col gap-10 py-8 lg:py-14')}>
          <header>
            <nav aria-label={t('crumbLabel')} className="mb-4 text-sm text-muted">
              <Link href="/" className="hover:text-text">{t('home')}</Link> <span aria-hidden>/</span> <span>{b('name')}</span>
            </nav>
            <h1 className="font-display text-[clamp(30px,4.4vw,48px)] leading-[1.06] font-medium tracking-[-0.03em]">{b('h1')}</h1>
            <p className="mt-5 text-[17px] leading-relaxed text-muted">{b('intro')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonVariants({ size: 'lg' })}>
                {tl('ctaPrimary')} <ArrowRight />
              </Link>
              <ExtensionInstall stores={stores} />
            </div>
          </header>

          <Screenshot name="applications" locale={locale} alt={tl('screenApplicationsAlt')} />

          <section>
            <h2 className={h2}>{t('capturedTitle')}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {list('captured').map((c) => (
                <li key={c} className="flex gap-3 text-[15px] leading-relaxed">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className={h2}>{t('statusTitle')}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{b('status')}</p>
          </section>

          <section>
            <h2 className={h2}>{t('stepsTitle')}</h2>
            <ol className="mt-4 flex flex-col gap-3 text-[15px] leading-relaxed [counter-reset:step]">
              {list('steps').map((s) => (
                <li key={s} className="flex gap-3 [counter-increment:step] before:grid before:size-6 before:shrink-0 before:place-items-center before:rounded-full before:bg-surface-2 before:text-xs before:font-semibold before:content-[counter(step)]">
                  <span className="min-w-0 pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className={h2}>{t('tipsTitle')}</h2>
            <ul className="mt-4 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-relaxed text-muted marker:text-subtle">
              {list('tips').map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          <section className="hero-gradient flex flex-col items-start gap-4 rounded-panel border border-border p-7 md:p-9">
            <h2 className={h2}>{t('ctaTitle')}</h2>
            <p className="text-[15px] text-muted">{t('ctaText')}</p>
            <Link href="/register" className={buttonVariants({ size: 'lg' })}>
              {t('cta')} <ArrowRight />
            </Link>
          </section>

          <section>
            <h2 className={h2}>{t('otherTitle')}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((s: BoardSlug) => (
                <li key={s}>
                  <Link href={`/boards/${s}`} className="inline-block rounded-full border border-border-strong bg-surface-3 px-3 py-1 text-[13px] hover:border-primary">
                    {platformSourceName(s, locale)}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-subtle">{t('supported')}</p>
          </section>
        </article>
    </PublicShell>
  );
}
