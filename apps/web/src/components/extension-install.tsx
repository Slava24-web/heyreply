'use client';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useContext } from 'react';
import { buttonVariants } from '@/components/ui/button';
import type { ExtensionStores } from '@/lib/extension-stores';
import { cn } from '@/lib/utils';

const StoresContext = createContext<ExtensionStores>({ chrome: null, firefox: null });

/** Receives the store links from a server layout; client components can't read runtime env themselves. */
export function ExtensionStoresProvider({ stores, children }: { stores: ExtensionStores; children: React.ReactNode }) {
  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}

/** Install buttons for the stores that have a listing; renders nothing until at least one link is configured. */
export function ExtensionInstall({ stores, size = 'lg', className }: { stores?: ExtensionStores; size?: 'sm' | 'lg'; className?: string }) {
  const t = useTranslations('extensionInstall');
  const fromContext = useContext(StoresContext);
  const { chrome, firefox } = stores ?? fromContext;
  if (!chrome && !firefox) return null;
  const items = [
    { href: chrome, label: t('chrome') },
    { href: firefox, label: t('firefox') },
  ].filter((i): i is { href: string; label: string } => !!i.href);
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {items.map(({ href, label }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size })}>
          <Download /> {label}
        </a>
      ))}
    </div>
  );
}
