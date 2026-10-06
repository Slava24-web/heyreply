'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from 'radix-ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConsentBox, LegalLink } from '@/components/auth-forms';
import { api } from '@/lib/api';
import { qk, useMe } from '@/lib/queries';
import type { UserDto } from '@heyreply/shared';

/** Blocks the app until an existing account accepts the current legal documents (new accounts accept them at registration). */
export function ConsentGate() {
  const t = useTranslations('auth');
  const tl = useTranslations('legal');
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [terms, setTerms] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!me || me.legalAccepted) return null;

  const accept = async () => {
    setBusy(true);
    setError(false);
    try {
      const updated = await api<UserDto>('/me/consent', { method: 'POST', body: { acceptTerms: true, acceptPersonalData: true } });
      qc.setQueryData(qk.me, updated);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  };

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgb(31_23_36/45%)] backdrop-blur-sm dark:bg-black/60" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-[61] w-[calc(100vw-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-border bg-surface p-6 shadow-pop outline-none"
        >
          <Dialog.Title className="font-display text-lg font-medium tracking-tight">{tl('gateTitle')}</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] text-muted">{tl('gateText')}</Dialog.Description>
          <div className="mt-5 flex flex-col gap-2.5">
            <ConsentBox id="gateTerms" checked={terms} onChange={(e) => setTerms(e.target.checked)}>
              {t.rich('acceptTerms', { terms: (c) => <LegalLink href="/terms">{c}</LegalLink>, privacy: (c) => <LegalLink href="/privacy">{c}</LegalLink> })}
            </ConsentBox>
            <ConsentBox id="gatePersonal" checked={personal} onChange={(e) => setPersonal(e.target.checked)}>
              {t.rich('acceptPersonalData', { consent: (c) => <LegalLink href="/consent">{c}</LegalLink> })}
            </ConsentBox>
          </div>
          {error ? <p role="alert" className="mt-3 text-xs text-danger">{tl('gateError')}</p> : null}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" onClick={logout} className="text-sm text-muted hover:text-text hover:underline">
              {tl('gateLogout')}
            </button>
            <Button onClick={accept} disabled={!terms || !personal || busy}>
              {tl('gateAccept')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
