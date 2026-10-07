'use client';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

/**
 * One step back in the browser history, like the browser's own button. The documents often open in a new tab (from the
 * sign-up form) where there is no history to go back to, so then it leads to the start page instead of doing nothing.
 */
export function BackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const t = useTranslations('common');
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 text-muted"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
    >
      <ArrowLeft /> {t('back')}
    </Button>
  );
}
