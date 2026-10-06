'use client';
import { Download, LogOut, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { CURRENCIES, registerSchema } from '@heyreply/shared';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { switchLocale } from '@/lib/locale';
import { api, clearLocalUserData, exportUrl } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import { useFormat } from '@/lib/format';
import { useMe, useUpdateMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { IntegrationsSection } from './integrations';
import { EmailImportSection } from './email-import';

const SECTIONS = ['profile', 'preferences', 'integrations', 'security', 'sessions', 'data'] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 font-display text-lg font-medium tracking-tight">{title}</h2>
      <Card className="p-5 md:p-6">{children}</Card>
    </section>
  );
}

function ThemeCard({ value, label, icon: Icon, active, onClick }: { value: string; label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  const dark = value === 'dark';
  const sys = value === 'system';
  return (
    <button onClick={onClick} aria-pressed={active} className={cn('group flex flex-col gap-2 rounded-[14px] border-2 p-2 text-left transition', active ? 'border-primary' : 'border-transparent hover:border-border-strong')}>
      <span
        className="relative block h-20 overflow-hidden rounded-[10px] border border-border"
        style={{ background: sys ? 'linear-gradient(115deg,#faf7fb 50%,#131015 50%)' : dark ? '#131015' : '#faf7fb' }}
      >
        <span className="absolute top-2 left-2 h-2 w-10 rounded-full" style={{ background: dark ? '#c58bdb' : '#7a2e8e' }} />
        <span className="absolute top-6 right-2 left-2 h-9 rounded-[6px]" style={{ background: dark ? '#1b171f' : '#ffffff', border: `1px solid ${dark ? '#352c3b' : '#e8dfec'}` }} />
        <span className="absolute bottom-4 left-4 h-1.5 w-12 rounded-full" style={{ background: '#e0457b', opacity: 0.8 }} />
      </span>
      <span className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <Icon className="size-4 text-muted" /> {label}
      </span>
    </button>
  );
}

export function SettingsPage() {
  const t = useTranslations('settings');
  const tn = useTranslations('nav');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useErrorText();
  const f = useFormat();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const { data: me, isLoading } = useMe();
  const update = useUpdateMe();
  const [name, setName] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [active, setActive] = useState<string>('profile');
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<{ id: string; userAgent: string | null; createdAt: string; current: boolean }[]>('/me/sessions'),
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (me) setName(me.name);
  }, [me]);

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-30% 0px -60% 0px' });
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [isLoading]);

  const patch = (body: Parameters<typeof update.mutate>[0]) =>
    update.mutate(body, { onSuccess: () => toast.success(tc('saved')), onError: (e) => toast.error(te(e)) });

  if (isLoading || !me) return <Skeleton className="h-96 w-full rounded-panel" />;

  const ua = (s: string | null) => {
    if (!s) return '—';
    const browser = /Edg\//.test(s) ? 'Edge' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'Browser';
    const os = /Mac OS/.test(s) ? 'macOS' : /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iOS' : /Linux/.test(s) ? 'Linux' : '';
    return `${browser}${os ? ` · ${os}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[34px]">{t('title')}</h1>
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a href={`#${s}`} className={cn('block rounded-field px-3 py-2 text-sm transition-colors', active === s ? 'bg-surface font-medium text-text shadow-card' : 'text-muted hover:text-text')}>
                  {t(s)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex max-w-3xl flex-col gap-10">
          <Section id="profile" title={t('profile')}>
            <div className="mb-6 flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-full bg-primary-soft font-display text-xl text-primary">{me.name[0]?.toUpperCase()}</span>
              <div>
                <p className="font-medium">{me.name}</p>
                <p className="text-sm text-muted">{t('memberSince', { date: f.date(me.createdAt) })}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('name')}>
                <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== me.name && patch({ name: name.trim() })} />
              </Field>
              <Field label={t('email')}>
                <Input value={me.email} disabled />
              </Field>
            </div>
          </Section>

          <Section id="preferences" title={t('preferences')}>
            <div className="flex flex-col gap-6">
              <Field label={t('theme')}>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['light', tn('light'), Sun],
                      ['dark', tn('dark'), Moon],
                      ['system', tn('system'), Monitor],
                    ] as const
                  ).map(([v, l, I]) => (
                    <ThemeCard
                      key={v}
                      value={v}
                      label={l}
                      icon={I}
                      active={theme === v}
                      onClick={() => {
                        setTheme(v);
                        patch({ theme: v });
                      }}
                    />
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('language')}>
                  <Segmented
                    value={locale as 'ru' | 'en'}
                    onChange={(v) => {
                      if (!v || v === locale) return;
                      switchLocale(v, { persist: true });
                    }}
                    options={[
                      { value: 'ru', label: 'Русский' },
                      { value: 'en', label: 'English' },
                    ]}
                    className="w-full"
                  />
                </Field>
                <Field label={t('defaultCurrency')}>
                  <NativeSelect value={me.defaultCurrency} onChange={(e) => patch({ defaultCurrency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t('defaultSalaryType')}>
                  <Segmented
                    value={me.defaultSalaryType}
                    onChange={(v) => v && patch({ defaultSalaryType: v })}
                    options={[
                      { value: 'GROSS', label: 'Gross' },
                      { value: 'NET', label: 'Net' },
                    ]}
                    className="w-full"
                  />
                </Field>
                <Field label={t('ghostingDays')} hint={t('ghostingHint')}>
                  <Input
                    type="number"
                    min={3}
                    max={90}
                    defaultValue={me.ghostingDays}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 3 && v <= 90 && v !== me.ghostingDays) patch({ ghostingDays: v });
                    }}
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section id="integrations" title={t('integrations')}>
            <IntegrationsSection />
            <div className="my-6 h-px bg-border" />
            <EmailImportSection />
          </Section>

          <Section id="security" title={t('security')}>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setPwError(null);
                const parsed = registerSchema.shape.password.safeParse(pw.newPassword);
                if (!parsed.success) return setPwError(te(parsed.error.issues[0].message === 'password_letter' || parsed.error.issues[0].message === 'password_digit' ? parsed.error.issues[0].message : 'min8'));
                try {
                  await api('/me/password', { method: 'PATCH', body: pw });
                  setPw({ currentPassword: '', newPassword: '' });
                  toast.success(t('passwordChanged'));
                } catch (err) {
                  setPwError(te(err));
                }
              }}
            >
              <Field label={t('currentPassword')}>
                <Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((s) => ({ ...s, currentPassword: e.target.value }))} />
              </Field>
              <Field label={t('newPassword')} hint={ta('passwordHint')} error={pwError}>
                <Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((s) => ({ ...s, newPassword: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" variant="outline" disabled={!pw.currentPassword || !pw.newPassword}>
                  {t('changePassword')}
                </Button>
              </div>
            </form>
          </Section>

          <Section id="sessions" title={t('sessions')}>
            <ul className="flex flex-col">
              {(sessions.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 border-b border-border/70 py-3 first:pt-0 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">
                      {ua(s.userAgent)}
                      {s.current ? <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">{t('currentSession')}</span> : null}
                    </p>
                    <p className="text-xs text-muted">{f.dateTime(s.createdAt)}</p>
                  </div>
                  {!s.current ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api(`/me/sessions/${s.id}`, { method: 'DELETE' });
                        sessions.refetch();
                      }}
                    >
                      {t('endSession')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-5"
              onClick={async () => {
                await api('/auth/logout-all', { method: 'POST' }).catch(() => {});
                clearLocalUserData();
                window.location.href = `/${locale}/login`;
              }}
            >
              <LogOut /> {t('logoutAll')}
            </Button>
          </Section>

          <Section id="data" title={t('data')}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={exportUrl('/me/export')} download>
                  <Download /> {t('exportAll')}
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={exportUrl('/applications/export', { fileFormat: 'csv' })} download>
                  <Download /> {t('exportCsv')}
                </a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-danger/25 bg-accent-soft/50 p-4">
              <div>
                <p className="text-sm font-medium text-danger">{t('deleteAccount')}</p>
                <p className="text-xs text-muted">{t('deleteAccountText')}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete((v) => !v)}>
                <Trash2 /> {t('deleteAccount')}
              </Button>
              {confirmDelete ? (
                <form
                  className="flex w-full flex-wrap items-end gap-2 animate-fade-up"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setDeleteError(null);
                    try {
                      await api('/me', { method: 'DELETE', body: { password: deletePassword } });
                      clearLocalUserData();
                      window.location.href = `/${locale}/register`;
                    } catch (err) {
                      setDeleteError(te(err));
                    }
                  }}
                >
                  <Field label={t('deleteAccountPassword')} error={deleteError} className="min-w-56 flex-1">
                    <Input type="password" autoComplete="current-password" autoFocus value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
                  </Field>
                  <Button type="submit" variant="danger" disabled={!deletePassword}>
                    {t('deleteAccountConfirm')}
                  </Button>
                </form>
              ) : null}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
