'use client';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { Tip } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ANALYTICS_NAV, BOTTOM_NAV, NAV } from './nav-items';

function NavLink({ href, label, icon: Icon, collapsed }: { href: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-10 items-center gap-3 rounded-field px-3 text-sm font-medium transition-colors',
        active ? 'bg-surface text-text shadow-[0_1px_3px_rgb(31_23_36/8%)] dark:bg-surface-2' : 'text-muted hover:bg-surface/60 hover:text-text dark:hover:bg-surface-2/60',
        collapsed && 'justify-center px-0',
      )}
    >
      {active ? <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-primary" /> : null}
      <Icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : '')} />
      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tip content={label} side="right">
      {link}
    </Tip>
  ) : (
    link
  );
}

export function Sidebar() {
  const t = useTranslations('nav');
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem('heyreply.sidebar') === '1');
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('heyreply.sidebar', c ? '0' : '1');
      } catch {}
      return !c;
    });
  };
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border/70 py-5 transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px] px-3' : 'w-[232px] px-4',
      )}
    >
      <div className={cn('mb-8 flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
        <Link href="/dashboard" aria-label="heyreply">
          <Logo withText={!collapsed} />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={t(n.key)} icon={n.icon} collapsed={collapsed} />
        ))}
        <div className={cn('mt-6 mb-2 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase', collapsed ? 'text-center text-[9px]' : 'px-3')}>
          {collapsed ? '···' : t('analytics')}
        </div>
        {ANALYTICS_NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={t(n.key)} icon={n.icon} collapsed={collapsed} />
        ))}
        <div className="flex-1" />
        {BOTTOM_NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={t(n.key)} icon={n.icon} collapsed={collapsed} />
        ))}
        <button
          onClick={toggle}
          className={cn('mt-2 flex h-9 items-center gap-3 rounded-field px-3 text-[13px] text-subtle hover:text-text', collapsed && 'justify-center px-0')}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {collapsed ? null : t('collapse')}
        </button>
      </nav>
    </aside>
  );
}
