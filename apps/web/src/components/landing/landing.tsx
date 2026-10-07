import { ArrowRight, BarChart3, Check, Download, KeyRound, Lightbulb, Plug, ShieldCheck, Table2 } from 'lucide-react';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { IMPORT_PLATFORMS, PLATFORM_INFO, platformSourceName, type PlatformGroup } from '@heyreply/shared';
import { ExtensionInstall } from '@/components/extension-install';
import { Logo } from '@/components/logo';
import { Screenshot } from '@/components/screenshot';
import { LegalLinks } from '@/components/legal/legal-links';
import { LocaleSwitch, ThemeToggle } from '@/components/shell/prefs';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { BOARD_SLUGS } from '@/lib/boards';
import { getExtensionStores } from '@/lib/extension-stores';
import { siteOrigin } from '@/lib/seo';
import { cn } from '@/lib/utils';

type Item = { t: string; d: string };
type Faq = { q: string; a: string };

const FEATURE_ICONS = [Download, Table2, BarChart3, Lightbulb, ShieldCheck, KeyRound];

const section = 'mx-auto w-full max-w-[1120px] px-4 sm:px-8';
const h2 = 'font-display text-[clamp(26px,3.2vw,38px)] leading-[1.1] font-medium tracking-[-0.02em]';

export async function Landing({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'landing' });
  const tInt = await getTranslations({ locale, namespace: 'integrations' });
  const tBoards = await getTranslations({ locale, namespace: 'boards' });
  const tAuth = await getTranslations({ locale, namespace: 'auth' });
  const steps = t.raw('steps') as Item[];
  const features = t.raw('features') as Item[];
  const faq = t.raw('faq') as Faq[];
  const origin = siteOrigin().origin;
  const stores = getExtensionStores();

  // Machine-readable summary for search engines; `<` is escaped so the text can never close the script tag
  const jsonLd = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'heyreply',
      url: `${origin}/${locale}`,
      description: t('text'),
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Chrome, Firefox',
      inLanguage: locale,
      offers: { '@type': 'Offer', price: '0', priceCurrency: locale === 'ru' ? 'RUB' : 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]).replace(/</g, '\\u003c');

  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className={cn(section, 'flex items-center justify-between gap-4 py-5')}>
        <Link href="/" aria-label="heyreply">
          <Logo />
        </Link>
        <nav aria-label={t('navLabel')} className="hidden items-center gap-6 text-sm text-muted md:flex">
          <a href="#features" className="hover:text-text">{t('navFeatures')}</a>
          <a href="#boards" className="hover:text-text">{t('navBoards')}</a>
          <a href="#faq" className="hover:text-text">{t('navFaq')}</a>
        </nav>
        <div className="flex items-center gap-1">
          <Suspense>
            <LocaleSwitch />
          </Suspense>
          <ThemeToggle />
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'ml-1 hidden sm:inline-flex')}>
            {t('login')}
          </Link>
          <Link href="/register" className={buttonVariants({ size: 'sm' })}>
            <span className="sm:hidden">{t('ctaShort')}</span>
            <span className="hidden sm:inline">{t('cta')}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className={cn(section, 'grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20')}>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[13px] font-medium text-primary">
              <Check className="size-3.5" aria-hidden /> {t('kicker')}
            </p>
            <h1 className="mt-5 font-display text-[clamp(36px,5.2vw,64px)] leading-[1.03] font-medium tracking-[-0.03em]">{t('title')}</h1>
            <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-muted">{t('text')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonVariants({ size: 'lg' })}>
                {t('ctaPrimary')} <ArrowRight />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                {t('ctaSecondary')}
              </Link>
            </div>
            <ExtensionInstall stores={stores} className="mt-3" />
            <p className="mt-4 text-sm text-subtle">{t('note')}</p>
          </div>
          <Screenshot name="dashboard" locale={locale} alt={t('screenDashboardAlt')} priority />
        </section>

        <section className={cn(section, 'py-12 lg:py-16')}>
          <h2 className={h2}>{t('stepsTitle')}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="card-glass surface-t rounded-card border p-6">
                <span className="grid size-9 place-items-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">{i + 1}</span>
                <h3 className="mt-4 text-[17px] font-semibold">{s.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className={cn(section, 'scroll-mt-6 py-12 lg:py-16')}>
          <h2 className={h2}>{t('featuresTitle')}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? Plug;
              return (
                <li key={f.t} className="rounded-card border border-border bg-surface/60 p-6">
                  <span className="grid size-10 place-items-center rounded-[12px] bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold">{f.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.d}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={cn(section, 'py-12 lg:py-16')}>
          <h2 className={h2}>{t('screensTitle')}</h2>
          <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-muted">{t('screensText')}</p>
          <div className="mt-8">
            <Screenshot name="applications" locale={locale} alt={t('screenApplicationsAlt')} />
          </div>
        </section>

        <section id="boards" className={cn(section, 'scroll-mt-6 py-12 lg:py-16')}>
          <h2 className={h2}>{t('boardsTitle')}</h2>
          <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-muted">{t('boardsText')}</p>
          <div className="mt-8 flex flex-col gap-5">
            {(['ru', 'intl', 'ats'] as PlatformGroup[]).map((g) => (
              <div key={g} className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-6">
                <h3 className="w-40 shrink-0 pt-1 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted uppercase">{tInt(`group_${g}`)}</h3>
                <ul className="flex flex-wrap gap-2">
                  {IMPORT_PLATFORMS.filter((p) => PLATFORM_INFO[p].group === g).map((p) => (
                    <li key={p} className="rounded-full border border-border-strong bg-surface-3 px-3 py-1 text-[13px]">
                      {platformSourceName(p, locale)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-[720px] text-sm text-subtle">{tInt('atsHint')}</p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {BOARD_SLUGS.map((s) => (
              <li key={s}>
                <Link href={`/boards/${s}`} className="text-primary hover:underline">
                  {tBoards(`${s}.h1`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className={cn(section, 'scroll-mt-6 py-12 lg:py-16')}>
          <h2 className={h2}>{t('faqTitle')}</h2>
          <div className="mt-8 flex max-w-[820px] flex-col gap-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-card border border-border bg-surface/60 px-5 py-4 open:bg-surface">
                <summary className="cursor-pointer list-none text-[16px] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {f.q}
                    <span aria-hidden className="text-xl leading-none text-subtle transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={cn(section, 'py-12 lg:py-20')}>
          <div className="hero-gradient flex flex-col items-start gap-5 rounded-panel border border-border p-8 md:p-12">
            <h2 className={h2}>{t('bottomTitle')}</h2>
            <p className="max-w-[520px] text-[17px] text-muted">{t('bottomText')}</p>
            <Link href="/register" className={buttonVariants({ size: 'lg' })}>
              {t('ctaPrimary')} <ArrowRight />
            </Link>
            <ExtensionInstall stores={stores} />
          </div>
        </section>
      </main>

      <footer className={cn(section, 'flex flex-col gap-3 border-t border-border py-6')}>
        <LegalLinks sameTab />
        <p className="text-xs text-subtle">{tAuth('heroText')}</p>
      </footer>
    </div>
  );
}
