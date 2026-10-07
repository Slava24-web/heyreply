'use client';
import { LogOut, Plus, Search, Settings, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/popover';
import { Link, useRouter } from '@/i18n/navigation';
import { api, clearLocalUserData } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { initials } from '@/lib/utils';
import { useMounted } from '@/lib/use-mounted';
import { LocaleSwitch, ThemeToggle } from './prefs';
import { useUIActions } from './ui-context';

export function Topbar() {
  const t = useTranslations('nav');
  const { openQuickAdd, setPaletteOpen } = useUIActions();
  const { data: rawMe } = useMe();
  const me = useMounted() ? rawMe : undefined;
  const router = useRouter();

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    clearLocalUserData();
    window.location.href = `/${document.documentElement.lang}/login`;
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-bg/75 px-4 backdrop-blur-xl md:px-8">
      <Link href="/dashboard" className="md:hidden" aria-label="heyreply">
        <Logo withText={false} />
      </Link>
      <button
        onClick={() => setPaletteOpen(true)}
        className="flex h-10 flex-1 items-center gap-2.5 rounded-field border border-border bg-surface/80 px-3 text-sm text-subtle transition-colors hover:border-border-strong md:max-w-[360px]"
      >
        <Search className="size-4" />
        <span className="truncate">{t('commandPlaceholder')}</span>
        <kbd className="ml-auto hidden rounded-[6px] border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted sm:inline">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <Suspense>
          <LocaleSwitch persist className="hidden sm:inline-flex" />
        </Suspense>
        <ThemeToggle persist className="hidden sm:grid" />
        <Button onClick={() => openQuickAdd()} className="ml-2 hidden md:inline-flex">
          <Plus /> {t('newApplication')}
          <kbd className="rounded-[5px] bg-white/20 px-1.5 text-[11px] font-medium">N</kbd>
        </Button>
        <Menu>
          <MenuTrigger
            className="ml-2 grid size-9 place-items-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary ring-2 ring-transparent transition hover:ring-primary/30"
            aria-label={t('profile')}
          >
            {me ? initials(me.name) : <User className="size-4" />}
          </MenuTrigger>
          <MenuContent>
            {me ? (
              <div className="px-2.5 pt-1.5 pb-2">
                <p className="text-sm font-medium">{me.name}</p>
                <p className="text-xs text-muted">{me.email}</p>
              </div>
            ) : null}
            <MenuSeparator />
            <MenuItem onSelect={() => router.push('/settings')}>
              <Settings /> {t('settings')}
            </MenuItem>
            <MenuItem onSelect={logout}>
              <LogOut /> {t('logout')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
