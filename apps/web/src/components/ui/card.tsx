import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-glass surface-t rounded-card border', className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-text">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[8px]', className)} />;
}

export function LowSample({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-border-strong px-2 py-0.5 text-[11px] font-medium text-subtle">
      {label}
    </span>
  );
}

export function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle', className)}>{children}</span>;
}
