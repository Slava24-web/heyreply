import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicShell, publicSection } from '@/components/landing/public-shell';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { BOARD_SLUGS } from '@/lib/boards';
import { localePath, pageMetadata, siteOrigin } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { platformSourceName } from '@heyreply/shared';

type Params = Promise<{ locale: string }>;
type Section = { id: string; h: string; p?: string[]; list?: string[]; p2?: string[] };

const PATH = '/guides/application-conversion';
const h2 = 'font-display text-[clamp(22px,2.6vw,30px)] leading-[1.15] font-medium tracking-[-0.02em]';

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guideConversion' });
  return pageMetadata({ locale, path: PATH, title: t('metaTitle'), description: t('metaDescription') });
}

export default async function ConversionGuide({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guideConversion' });
  const tl = await getTranslations({ locale, namespace: 'landing' });
  const sections = t.raw('sections') as Section[];
  const origin = siteOrigin().origin;
  const url = `${origin}${localePath(locale, PATH)}`;

  const jsonLd = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('home'), item: `${origin}${localePath(locale, '/')}` },
        { '@type': 'ListItem', position: 2, name: t('h1'), item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: t('h1'),
      description: t('metaDescription'),
      inLanguage: locale,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'heyreply', url: origin },
      publisher: { '@type': 'Organization', name: 'heyreply', url: origin },
    },
  ]).replace(/</g, '\\u003c');

  return (
    <PublicShell locale={locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <article className={cn(publicSection, 'flex flex-col gap-10 py-8 lg:py-14')}>
        <header>
          <nav aria-label={t('crumbLabel')} className="mb-4 text-sm text-muted">
            <Link href="/" className="hover:text-text">{t('home')}</Link> <span aria-hidden>/</span> <span>{t('navLabel')}</span>
          </nav>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-primary uppercase">{t('kicker')}</p>
          <h1 className="mt-2 font-display text-[clamp(30px,4.4vw,48px)] leading-[1.06] font-medium tracking-[-0.03em]">{t('h1')}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">{t('lead')}</p>
        </header>

        <nav aria-label={t('toc')} className="rounded-card border border-border bg-surface/60 p-5">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">{t('toc')}</p>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] marker:text-subtle">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-primary hover:underline">{s.h}</a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className={h2}>{s.h}</h2>
            <div className="mt-4 flex flex-col gap-4 text-[16px] leading-relaxed text-muted">
              {s.p?.map((x) => <p key={x}>{x}</p>)}
              {s.list ? (
                <ul className="flex list-disc flex-col gap-2.5 pl-5 marker:text-subtle">
                  {s.list.map((x) => <li key={x}>{x}</li>)}
                </ul>
              ) : null}
              {s.p2?.map((x) => <p key={x}>{x}</p>)}
            </div>
          </section>
        ))}

        <section className="hero-gradient flex flex-col items-start gap-4 rounded-panel border border-border p-7 md:p-9">
          <h2 className={h2}>{t('ctaTitle')}</h2>
          <p className="text-[15px] text-muted">{t('ctaText')}</p>
          <Link href="/register" className={buttonVariants({ size: 'lg' })}>
            {t('cta')} <ArrowRight />
          </Link>
        </section>

        <section>
          <h2 className={h2}>{t('relatedTitle')}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {BOARD_SLUGS.map((s) => (
              <li key={s}>
                <Link href={`/boards/${s}`} className="inline-block rounded-full border border-border-strong bg-surface-3 px-3 py-1 text-[13px] hover:border-primary">
                  {tl('boardLink', { name: platformSourceName(s, locale) })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PublicShell>
  );
}
