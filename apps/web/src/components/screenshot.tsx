import { cn } from '@/lib/utils';

/** A real screenshot of the app in both themes; the one matching the visitor's theme is shown. Sizes are fixed so the page doesn't jump while it loads. */
export function Screenshot({ name, locale, alt, priority, className }: { name: 'dashboard' | 'applications'; locale: string; alt: string; priority?: boolean; className?: string }) {
  const src = (theme: 'light' | 'dark') => `/screens/${name}-${locale === 'ru' ? 'ru' : 'en'}-${theme}.webp`;
  const common = { width: 1280, height: 800, decoding: 'async' as const, loading: priority ? ('eager' as const) : ('lazy' as const), fetchPriority: priority ? ('high' as const) : undefined };
  const frame = 'h-auto w-full rounded-[14px] border border-border shadow-[0_24px_60px_-28px_rgba(40,10,60,0.45)]';
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src('light')} alt={alt} {...common} className={cn(frame, 'dark:hidden', className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src('dark')} alt="" aria-hidden {...common} loading="lazy" fetchPriority={undefined} className={cn(frame, 'hidden dark:block', className)} />
    </>
  );
}
