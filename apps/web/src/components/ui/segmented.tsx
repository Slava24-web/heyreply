'use client';
import { cn } from '@/lib/utils';

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  allowEmpty,
  ariaLabel,
}: {
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
  allowEmpty?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-field border border-border bg-surface-2 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active && allowEmpty ? null : o.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[8px] font-medium whitespace-nowrap transition-all [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-[34px] px-3 text-[13px]',
              active ? 'bg-surface text-text shadow-[0_1px_3px_rgb(31_23_36/12%)] dark:bg-surface-3' : 'text-muted hover:text-text',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
