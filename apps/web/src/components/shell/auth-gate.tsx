'use client';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ApiError } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import { useMe } from '@/lib/queries';

/**
 * The proxy only checks that a session cookie exists, so a stale one reaches the app. Show nothing of the app
 * until the API confirms the session; a 401 is already redirecting to the login page, so the loader stays up.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const te = useErrorText();
  const { data: me, error, refetch, isFetching } = useMe();
  if (me) return children;
  const failed = error && !(error instanceof ApiError && error.status === 401);
  return (
    <div className="grid min-h-dvh place-items-center px-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo />
        {failed ? (
          <>
            <p className="text-sm text-muted">{te(error)}</p>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {t('retry')}
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t('loading')}
          </p>
        )}
      </div>
    </div>
  );
}
