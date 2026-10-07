'use client';
import { DonateNavLink } from './donate';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { Tip } from '@/components/ui/popover';
import { flagCodec, useStoredState } from '@/lib/use-stored';
import { cn } from '@/lib/utils';
import { ANALYTICS_NAV, BOTTOM_NAV, NAV } from './nav-items';
import { navItemClass } from './nav-style';

function NavLink({ href, label, icon: Icon, collapsed }: { href: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={navItemClass(active, collapsed)}
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
  // Read before the first paint, so a collapsed sidebar never opens wide and then animates shut
  const [collapsed, setCollapsed] = useStoredState('heyreply.sidebar', false, { codec: flagCodec });
  const toggle = () => setCollapsed(!collapsed);
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
        <DonateNavLink collapsed={collapsed} />
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
