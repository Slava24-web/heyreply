'use client';
import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useMounted } from '@/lib/use-mounted';
import { switchLocale } from '@/lib/locale';
import { Menu, MenuContent, MenuItem, MenuTrigger, Tip } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export function ThemeToggle({ persist = false, className }: { persist?: boolean; className?: string }) {
  const t = useTranslations('nav');
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const Icon = !mounted ? Monitor : theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const choose = (v: 'light' | 'dark' | 'system') => {
    setTheme(v);
    if (persist) api('/me', { method: 'PATCH', body: { theme: v } }).catch(() => {});
  };
  return (
    <Menu>
      <Tip content={t('theme')}>
        <MenuTrigger className={cn('grid size-9 place-items-center rounded-field text-muted hover:bg-surface-2 hover:text-text', className)} aria-label={t('theme')}>
          <Icon className="size-[18px]" />
        </MenuTrigger>
      </Tip>
      <MenuContent className="min-w-40">
        <MenuItem onSelect={() => choose('light')}>
          <Sun /> {t('light')}
        </MenuItem>
        <MenuItem onSelect={() => choose('dark')}>
          <Moon /> {t('dark')}
        </MenuItem>
        <MenuItem onSelect={() => choose('system')}>
          <Monitor /> {t('system')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function LocaleSwitch({ persist = false, className }: { persist?: boolean; className?: string }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const next = locale === 'ru' ? 'en' : 'ru';
  return (
    <Tip content={t('language')}>
      <button
        onClick={() => switchLocale(next, { persist })}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-field px-2.5 text-[13px] font-semibold text-muted uppercase hover:bg-surface-2 hover:text-text', className)}
        aria-label={t('language')}
      >
        <Languages className="size-4" />
        {locale}
      </button>
    </Tip>
  );
}
