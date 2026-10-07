import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { LegalLinks } from '@/components/legal/legal-links';
import { Logo } from '@/components/logo';
import { LocaleSwitch, ThemeToggle } from '@/components/shell/prefs';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export const publicSection = 'mx-auto w-full max-w-[820px] px-4 sm:px-8';

/** Header and footer shared by the public content pages (job board guides, articles). */
export async function PublicShell({ locale, children }: { locale: string; children: React.ReactNode }) {
  const tl = await getTranslations({ locale, namespace: 'landing' });
  return (
    <div className="flex min-h-dvh flex-col">
      <header className={cn(publicSection, 'flex items-center justify-between gap-4 py-5')}>
        <Link href="/" aria-label="heyreply">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <Suspense>
            <LocaleSwitch />
          </Suspense>
          <ThemeToggle />
          <Link href="/register" className={cn(buttonVariants({ size: 'sm' }), 'ml-1')}>
            <span className="sm:hidden">{tl('ctaShort')}</span>
            <span className="hidden sm:inline">{tl('cta')}</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className={cn(publicSection, 'flex flex-col gap-3 border-t border-border py-6')}>
        <LegalLinks sameTab />
      </footer>
    </div>
  );
}
