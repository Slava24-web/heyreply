'use client';
import { Check, ChevronDown } from 'lucide-react';
import { Popover as P } from 'radix-ui';
import { useTranslations } from 'next-intl';
import { APP_STATUSES, type AppStatus } from '@heyreply/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STATUS_META } from '@/lib/status';
import { cn } from '@/lib/utils';

export function statusStyle(status: AppStatus): React.CSSProperties {
  const m = STATUS_META[status];
  const c = m.color;
  switch (m.variant) {
    case 'solid':
      return { background: c, color: 'var(--surface)', borderColor: c };
    case 'soft':
      return { background: `color-mix(in oklab, ${c} 14%, transparent)`, color: c, borderColor: 'transparent' };
    case 'muted':
      return { background: `color-mix(in oklab, ${c} 10%, transparent)`, color: c, borderColor: `color-mix(in oklab, ${c} 25%, transparent)` };
    case 'dashed':
      return { background: 'transparent', color: 'var(--text-muted)', borderColor: c, borderStyle: 'dashed' };
    default:
      return { background: 'transparent', color: c, borderColor: `color-mix(in oklab, ${c} 55%, transparent)` };
  }
}

export function StatusBadge({ status, size = 'md', className, withChevron }: { status: AppStatus; size?: 'sm' | 'md' | 'lg'; className?: string; withChevron?: boolean }) {
  const t = useTranslations('status');
  const Icon = STATUS_META[status].icon;
  return (
    <span
      style={statusStyle(status)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' && 'h-6 px-2 text-[11px] [&_svg]:size-3',
        size === 'md' && 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        size === 'lg' && 'h-9 px-3.5 text-sm [&_svg]:size-4',
        className,
      )}
    >
      <Icon aria-hidden />
      {t(status)}
      {withChevron ? <ChevronDown className="-mr-0.5 opacity-70" aria-hidden /> : null}
    </span>
  );
}

export function StatusDot({ status, className }: { status: AppStatus; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: STATUS_META[status].color }} />;
}

export function StatusPicker({
  value,
  onChange,
  children,
  align = 'start',
}: {
  value: AppStatus;
  onChange: (s: AppStatus) => void;
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
}) {
  const t = useTranslations('status');
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-56" onClick={(e) => e.stopPropagation()}>
        <div role="listbox" className="flex flex-col">
          {APP_STATUSES.map((s) => {
            const Icon = STATUS_META[s].icon;
            return (
              <PopoverClose key={s}>
                <button
                  role="option"
                  aria-selected={s === value}
                  onClick={() => s !== value && onChange(s)}
                  className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <Icon className="size-4" style={{ color: STATUS_META[s].color }} />
                  <span className="flex-1">{t(s)}</span>
                  {s === value ? <Check className="size-4 text-primary" /> : null}
                </button>
              </PopoverClose>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PopoverClose({ children }: { children: React.ReactNode }) {
  return <P.Close asChild>{children}</P.Close>;
}
