'use client';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DonateContext = createContext<string | null>(null);

/** Receives the donation link from the server layout; client components can't read runtime env themselves. */
export function DonateProvider({ url, children }: { url: string | null; children: React.ReactNode }) {
  return <DonateContext.Provider value={url}>{children}</DonateContext.Provider>;
}

export const useDonateUrl = () => useContext(DonateContext);

export function DonateCard() {
  const t = useTranslations('donate');
  const url = useDonateUrl();
  if (!url) return null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('text')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Heart className="size-4" /> {t('button')}
          </a>
        </Button>
        <span className="text-xs text-subtle">{t('hint')}</span>
      </div>
    </div>
  );
}

export function DonateNavLink({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('donate');
  const url = useDonateUrl();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('short')}
      className={cn('flex h-9 items-center gap-3 rounded-field px-3 text-[13px] text-subtle hover:text-text', collapsed && 'justify-center px-0')}
    >
      <Heart className="size-[18px]" />
      {collapsed ? null : t('short')}
    </a>
  );
}
