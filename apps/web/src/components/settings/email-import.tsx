'use client';
import { Check, Copy, ExternalLink, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformSourceName, type ImportPlatform } from '@heyreply/shared';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

interface InboundOverview {
  enabled: boolean;
  address: string | null;
  confirmation: { url: string | null; code: string | null; receivedAt: string; from: string } | null;
  recent: { id: string; from: string; subject: string; platform: string | null; kind: string; outcome: string | null; receivedAt: string }[];
  senders: string[];
}

type Provider = 'gmail' | 'yandex' | 'mailru';

/** Only links to the mail providers themselves are rendered (the server also requires their DKIM signature). */
const SAFE_CONFIRM_HOSTS = /(^|\.)(google\.com|yandex\.(ru|com)|ya\.ru|mail\.ru|outlook\.com|live\.com|microsoft\.com)$/;
const safeConfirmUrl = (u: string | null) => {
  try {
    return u && new URL(u).protocol === 'https:' && SAFE_CONFIRM_HOSTS.test(new URL(u).hostname) ? u : null;
  } catch {
    return null;
  }
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (value: string, key = value) => {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    },
  };
}

export function EmailImportSection() {
  const t = useTranslations('emailImport');
  const tc = useTranslations('common');
  const te = useErrorText();
  const f = useFormat();
  const locale = useLocale();
  const qc = useQueryClient();
  const { copied, copy } = useCopy();
  const [provider, setProvider] = useState<Provider>('gmail');
  const [confirmRotate, setConfirmRotate] = useState(false);
  const q = useQuery({ queryKey: ['inbound'], queryFn: () => api<InboundOverview>('/me/inbound'), refetchInterval: 15_000 });
  const rotate = useMutation({
    mutationFn: () => api<InboundOverview>('/me/inbound', { method: 'POST' }),
    onSuccess: (d) => qc.setQueryData(['inbound'], d),
    onError: (e) => toast.error(te(e)),
  });
  const disable = useMutation({
    mutationFn: () => api('/me/inbound', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbound'] }),
  });

  const d = q.data;
  const senders = d?.senders ?? [];
  const filterQuery = `from:(${senders.join(' OR ')})`;
  const confirmUrl = safeConfirmUrl(d?.confirmation?.url ?? null);

  const kindLabel = (k: string, outcome: string | null) => {
    if (k === 'application') return t(`outcome_${outcome ?? 'unchanged'}` as 'outcome_created');
    return t(`kind_${k}` as 'kind_ignored');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary-soft text-primary">
          <Mail className="size-5" />
        </span>
        <div>
          <p className="font-medium">{t('title')}</p>
          <p className="mt-1 text-sm text-muted">{t('text')}</p>
        </div>
      </div>

      {q.isLoading ? null : !d?.enabled ? (
        <p className="rounded-field border border-dashed border-border-strong p-4 text-sm text-muted">{t('disabled')}</p>
      ) : !d.address ? (
        <Button className="self-start" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
          <Mail /> {t('getAddress')}
        </Button>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">{t('yourAddress')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-field border border-border bg-surface-2/60 px-3 py-2.5 text-[13px]">{d.address}</code>
              <Button variant="outline" onClick={() => copy(d.address!, 'address')}>
                {copied === 'address' ? <Check /> : <Copy />} {copied === 'address' ? t('copied') : t('copy')}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-subtle">{t('addressHint')}</p>
          </div>

          {d.confirmation ? (
            <div className="rounded-card border border-primary/30 bg-primary-soft/40 p-4 animate-fade-up" role="status">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-primary" /> {t('confirmTitle')}
              </p>
              <p className="mt-1 text-[13px] text-muted [overflow-wrap:anywhere]">{t('confirmText', { from: d.confirmation.from })}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {d.confirmation.code ? (
                  <Button variant="outline" onClick={() => copy(d.confirmation!.code!, 'code')}>
                    {copied === 'code' ? <Check /> : <Copy />} {t('code')}: <span className="font-mono tabular">{d.confirmation.code}</span>
                  </Button>
                ) : null}
                {confirmUrl ? (
                  <Button asChild>
                    <a href={confirmUrl} target="_blank" rel="noreferrer noopener">
                      <ExternalLink /> {t('confirmLink')}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[13px] font-medium text-muted">{t('howTo')}</p>
            <Segmented
              value={provider}
              onChange={(v) => v && setProvider(v)}
              options={[
                { value: 'gmail', label: 'Gmail' },
                { value: 'yandex', label: t('yandex') },
                { value: 'mailru', label: 'Mail.ru' },
              ]}
              className="mb-3"
            />
            <ol className="flex flex-col gap-2 text-sm text-muted">
              {(['1', '2', '3', '4'] as const).map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-text">{n}</span>
                  <span className="min-w-0 pt-0.5 [overflow-wrap:anywhere]">{t(`${provider}_${n}` as 'gmail_1', { address: d.address! })}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-field border border-border bg-surface-2/60 px-3 py-2 text-xs">{provider === 'gmail' ? filterQuery : senders.join(', ')}</code>
              <Button variant="ghost" size="sm" onClick={() => copy(provider === 'gmail' ? filterQuery : senders.join(', '), 'senders')}>
                {copied === 'senders' ? <Check /> : <Copy />} {t('copySenders')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-subtle">{t('autoForwardOnly')}</p>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-muted">{t('journal')}</p>
            {d.recent.length ? (
              <ul className="flex flex-col">
                {d.recent.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 border-b border-border/70 py-2.5 first:pt-0 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{e.subject || '—'}</p>
                      <p className="truncate text-xs text-subtle">
                        {e.platform ? `${platformSourceName(e.platform as ImportPlatform, locale)} · ` : ''}
                        {e.from} · {f.dateTime(e.receivedAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                        e.kind === 'application' ? 'bg-primary-soft text-primary' : e.kind === 'unverified' ? 'bg-accent-soft text-danger' : 'bg-surface-2 text-muted',
                      )}
                      title={e.kind === 'unverified' ? t('kind_unverified_hint') : undefined}
                    >
                      {kindLabel(e.kind, e.outcome)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtle">{t('journalEmpty')}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmRotate(true)}>
              <RefreshCw /> {t('rotate')}
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => disable.mutate()}>
              {t('disable')}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={t('rotateConfirm')}
        description={t('rotateText')}
        confirmLabel={t('rotate')}
        cancelLabel={tc('cancel')}
        onConfirm={() => rotate.mutate()}
      />
    </div>
  );
}
