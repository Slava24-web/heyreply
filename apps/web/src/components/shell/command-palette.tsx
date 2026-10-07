'use client';
import { Command } from 'cmdk';
import { Dialog } from 'radix-ui';
import { Moon, Plus, Search, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useDeferredValue, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useApplications } from '@/lib/queries';
import { StatusBadge } from '@/components/applications/status-badge';
import { ANALYTICS_NAV, BOTTOM_NAV, NAV } from './nav-items';
import { useUI } from './ui-context';

const groupCls =
  'mt-1 first:mt-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-subtle [&_[cmdk-group-heading]]:uppercase';
const itemCls =
  'flex h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-sm text-text data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted';

export function CommandPalette() {
  const t = useTranslations('nav');
  const { paletteOpen, setPaletteOpen, openQuickAdd, openApp } = useUI();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  // The palette is always mounted: search only while it is open, otherwise every page would fetch (and refetch) these rows for nothing
  const { data } = useApplications({ q: dq || undefined, limit: 6 }, { enabled: paletteOpen });

  const needle = q.trim().toLowerCase();
  const navItems = [...NAV, ...ANALYTICS_NAV, ...BOTTOM_NAV].filter((n) => !needle || t(n.key).toLowerCase().includes(needle));
  const newLabel = t('newApplicationLong');
  const themeLabel = resolvedTheme === 'dark' ? t('light') : t('dark');
  // Commands follow the query like everything else; otherwise "New application" sits first and Enter opens it instead of the match
  const showNew = !needle || newLabel.toLowerCase().includes(needle);
  const showTheme = !needle || themeLabel.toLowerCase().includes(needle) || t('theme').toLowerCase().includes(needle);

  // cmdk only highlights the first row when it mounts. The matches arrive after the query, so point at the first row
  // of the visible list explicitly, otherwise Enter has nothing to open
  const [picked, setPicked] = useState<{ q: string; value: string } | null>(null);
  const firstValue = (needle ? [data?.items[0]?.id, showNew && 'cmd:new', showTheme && 'cmd:theme', navItems[0]?.href] : [showNew && 'cmd:new', showTheme && 'cmd:theme', data?.items[0]?.id, navItems[0]?.href]).find(Boolean) || '';
  const active = picked && picked.q === needle ? picked.value : firstValue;

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    setQ('');
    fn();
  };

  const commandsGroup =
    showNew || showTheme ? (
      <Command.Group key="commands" heading={t('commands')} className={groupCls}>
        {showNew ? (
          <Command.Item value="cmd:new" className={itemCls} onSelect={() => run(() => openQuickAdd())}>
            <Plus /> {newLabel}
            <kbd className="ml-auto text-xs text-subtle">N</kbd>
          </Command.Item>
        ) : null}
        {showTheme ? (
          <Command.Item value="cmd:theme" className={itemCls} onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}>
            {resolvedTheme === 'dark' ? <Sun /> : <Moon />} {themeLabel}
          </Command.Item>
        ) : null}
      </Command.Group>
    ) : null;

  const foundGroup = data?.items.length ? (
    <Command.Group key="found" heading={t('foundApplications')} className={groupCls}>
      {data.items.map((a) => (
        <Command.Item key={a.id} value={a.id} className={itemCls} onSelect={() => run(() => openApp(a.id))}>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{a.company.name}</span>
            <span className="text-muted"> · {a.position.name}</span>
          </span>
          <StatusBadge status={a.status} size="sm" />
        </Command.Item>
      ))}
    </Command.Group>
  ) : null;

  const navGroup = navItems.length ? (
    <Command.Group key="nav" heading={t('goTo')} className={groupCls}>
      {navItems.map((n) => (
        <Command.Item key={n.href} value={n.href} className={itemCls} onSelect={() => run(() => router.push(n.href))}>
          <n.icon /> {t(n.key)}
        </Command.Item>
      ))}
    </Command.Group>
  ) : null;

  return (
    <Dialog.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-panel border border-border bg-surface shadow-pop animate-fade-up">
          <Dialog.Title className="sr-only">{t('commandPlaceholder')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('commandPlaceholder')}</Dialog.Description>
          <Command shouldFilter={false} loop value={active} onValueChange={(value) => setPicked({ q: needle, value })}>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-subtle" />
              <Command.Input value={q} onValueChange={setQ} placeholder={t('commandPlaceholder')} className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle" />
            </div>
            <Command.List className="scrollbar-thin max-h-[420px] overflow-y-auto p-2">
              {/* With a query the found applications come first, so Enter opens the best match */}
              {needle ? [foundGroup, commandsGroup, navGroup] : [commandsGroup, foundGroup, navGroup]}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
