'use client';
import { BarChart3, LayoutDashboard, ListChecks, Plus, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useUI } from './ui-context';

export function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { openQuickAdd } = useUI();
  const items = [
    { href: '/dashboard', label: t('overview'), icon: LayoutDashboard },
    { href: '/applications', label: t('applications'), icon: ListChecks },
    { href: '/analytics/sources', match: '/analytics', label: t('analytics'), icon: BarChart3 },
    { href: '/settings', label: t('settings'), icon: Settings },
  ];
  return (
    <>
      <button
        onClick={() => openQuickAdd()}
        aria-label={t('newApplicationLong')}
        className="fixed right-4 bottom-[84px] z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-[0_12px_32px_-8px_var(--primary)] active:scale-95 md:hidden"
      >
        <Plus className="size-6" />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[68px] items-stretch border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {items.map((i) => {
          const active = pathname.startsWith(i.match ?? i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-primary' : 'text-muted')}
            >
              <i.icon className="size-5" />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
