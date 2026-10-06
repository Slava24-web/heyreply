import { cn } from '@/lib/utils';

/** Mark: a rising funnel bar — three steps narrowing into one dot. */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-primary text-primary-fg shadow-[0_6px_18px_-6px_var(--primary)]">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="3" rx="1.5" fill="currentColor" opacity=".55" />
          <rect x="6" y="10.5" width="12" height="3" rx="1.5" fill="currentColor" opacity=".8" />
          <circle cx="12" cy="18.2" r="2.2" fill="var(--accent)" />
        </svg>
      </span>
      {withText ? <span className="font-display text-[17px] font-medium tracking-tight">heyreply</span> : null}
    </span>
  );
}
