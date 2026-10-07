import { getTranslations } from 'next-intl/server';
import { LegalLinks } from '@/components/legal/legal-links';
import { Logo } from '@/components/logo';
import { LocaleSwitch, ThemeToggle } from '@/components/shell/prefs';
import { Suspense } from 'react';

const FUNNEL = [
  { key: 'applied', value: 100, count: 148 },
  { key: 'screening', value: 41, count: 61 },
  { key: 'test', value: 27, count: 40 },
  { key: 'interview', value: 19, count: 28 },
  { key: 'offer', value: 6, count: 9 },
] as const;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="hero-gradient relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div className="max-w-[520px]">
          <p className="font-display text-[clamp(40px,4.4vw,64px)] leading-[1.02] font-medium tracking-[-0.03em] text-text">{t('auth.heroTitle')}</p>
          <p className="mt-6 max-w-[420px] text-[17px] leading-relaxed text-muted">{t('auth.heroText')}</p>
        </div>
        <div className="rounded-panel border border-white/40 bg-surface/70 p-6 backdrop-blur-md dark:border-white/5" aria-hidden>
          <p className="mb-4 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">{t('auth.heroFunnel')}</p>
          <div className="flex flex-col gap-2.5">
            {FUNNEL.map((s, i) => (
              <div key={s.key} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-[13px] text-muted">{t(`stage.${s.key}`)}</span>
                <div className="h-7 flex-1 overflow-hidden rounded-[8px] bg-surface-2">
                  <div
                    className="flex h-full items-center rounded-[8px] px-2.5 text-xs font-semibold text-white tabular"
                    style={{
                      width: `${Math.max(s.value, 9)}%`,
                      background: i === 4 ? 'var(--accent)' : `color-mix(in oklab, var(--primary) ${100 - i * 14}%, var(--secondary))`,
                      animation: `fade-up 500ms ${i * 90}ms both`,
                    }}
                  >
                    {s.count}
                  </div>
                </div>
                <span className="w-16 shrink-0 text-right font-display text-sm whitespace-nowrap tabular text-text">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="relative flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <div className="flex items-center gap-1">
            <Suspense>
              <LocaleSwitch />
            </Suspense>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-fade-up">{children}</div>
        </div>
        <LegalLinks className="justify-center" />
      </main>
    </div>
  );
}
