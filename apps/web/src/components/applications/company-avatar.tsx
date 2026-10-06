import { cn, monogramColor } from '@/lib/utils';

export function CompanyAvatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const c = monogramColor(name);
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-[10px] font-display font-medium', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `color-mix(in oklab, ${c} 16%, var(--surface))`,
        color: c,
      }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
