import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { LegalLinks } from '@/components/legal/legal-links';
import { Logo } from '@/components/logo';
import { LocaleSwitch, ThemeToggle } from '@/components/shell/prefs';
import { Link } from '@/i18n/navigation';

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('legal');
  return (
    <div className="mx-auto flex min-h-dvh max-w-[760px] flex-col px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="heyreply">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <Suspense>
            <LocaleSwitch />
          </Suspense>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 py-10">{children}</main>
      <footer className="flex flex-col gap-3 border-t border-border pt-6">
        <LegalLinks sameTab />
        <p className="text-xs text-subtle">{t('notAffiliated')}</p>
      </footer>
    </div>
  );
}
