'use client';
import { Check, Copy, KeyRound, Plug, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IMPORT_PLATFORMS, PLATFORM_INFO, platformSourceName, type ApiTokenDto, type PlatformGroup } from '@heyreply/shared';
import { ExtensionInstall } from '@/components/extension-install';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import { useFormat } from '@/lib/format';

export function IntegrationsSection() {
  const t = useTranslations('integrations');
  const tc = useTranslations('common');
  const te = useErrorText();
  const f = useFormat();
  const locale = useLocale();
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: ['tokens'], queryFn: () => api<ApiTokenDto[]>('/me/tokens') });
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toRevoke, setToRevoke] = useState<ApiTokenDto | null>(null);

  const create = useMutation({
    mutationFn: () => api<ApiTokenDto & { token: string }>('/me/tokens', { method: 'POST', body: { name: name.trim() || t('defaultName') } }),
    onSuccess: (r) => {
      setFresh(r.token);
      setCopied(false);
      setName('');
      qc.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (e) => toast.error(te(e)),
  });

  const copy = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    setCopied(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary-soft text-primary">
          <Plug className="size-5" />
        </span>
        <div>
          <p className="font-medium">{t('extensionTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('extensionText')}</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {(['ru', 'intl', 'ats'] as PlatformGroup[]).map((g) => (
              <div key={g} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-full text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted uppercase sm:w-36">{t(`group_${g}`)}</span>
                {IMPORT_PLATFORMS.filter((p) => PLATFORM_INFO[p].group === g).map((p) => (
                  <span key={p} className="rounded-full border border-border-strong bg-surface-3 px-2.5 py-1 text-xs text-text">
                    {platformSourceName(p, locale)}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t('atsHint')}</p>
          <ExtensionInstall size="sm" className="mt-4" />
        </div>
      </div>

      <ol className="flex flex-col gap-2 text-sm text-muted [counter-reset:step]">
        {(['step1', 'step2', 'step3'] as const).map((k) => (
          <li key={k} className="flex gap-3 [counter-increment:step] before:grid before:size-6 before:shrink-0 before:place-items-center before:rounded-full before:bg-surface-2 before:text-xs before:font-semibold before:text-text before:content-[counter(step)]">
            <span className="min-w-0 pt-0.5 [overflow-wrap:anywhere]">{t(k)}</span>
          </li>
        ))}
      </ol>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-[13px] font-medium text-muted">
          {t('tokenName')}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('defaultName')} maxLength={60} />
        </label>
        <Button type="submit" disabled={create.isPending}>
          <KeyRound /> {t('create')}
        </Button>
      </form>

      {fresh ? (
        <div className="rounded-card border border-primary/30 bg-primary-soft/40 p-4 animate-fade-up" role="status">
          <p className="text-sm font-medium">{t('createdTitle')}</p>
          <p className="mt-1 text-[13px] text-muted">{t('createdText')}</p>
          <div className="mt-3 flex gap-2">
            <Input readOnly value={fresh} className="font-mono text-[13px]" onFocus={(e) => e.currentTarget.select()} aria-label={t('tokenName')} />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? t('copied') : t('copy')}
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.data?.length ? (
        <ul className="flex flex-col">
          {tokens.data.map((tk) => (
            <li key={tk.id} className="flex items-center justify-between gap-3 border-b border-border/70 py-3 first:pt-0 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{tk.name}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{tk.prefix}…</span> · {tk.lastUsedAt ? t('lastUsed', { date: f.dateTime(tk.lastUsedAt) }) : t('neverUsed')}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setToRevoke(tk)}>
                <Trash2 /> {t('revoke')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={!!toRevoke}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title={toRevoke ? t('revokeConfirm', { name: toRevoke.name }) : ''}
        description={t('revokeText')}
        confirmLabel={t('revoke')}
        cancelLabel={tc('cancel')}
        danger
        onConfirm={async () => {
          if (!toRevoke) return;
          await api(`/me/tokens/${toRevoke.id}`, { method: 'DELETE' });
          if (fresh?.startsWith(toRevoke.prefix)) setFresh(null);
          qc.invalidateQueries({ queryKey: ['tokens'] });
        }}
      />
    </div>
  );
}
