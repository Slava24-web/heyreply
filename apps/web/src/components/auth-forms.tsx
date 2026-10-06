'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { loginSchema, registerSchema } from '@heyreply/shared';
import { Link } from '@/i18n/navigation';
import { Button } from './ui/button';
import { Field, Input } from './ui/input';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/errors';

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-[28px] font-medium tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
    </div>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} size_="lg" className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[8px] p-1.5 text-subtle hover:text-text"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-field border border-danger/30 bg-accent-soft px-3.5 py-2.5 text-sm text-danger">{message}</div>;
}

function afterAuth(next: string | null, locale: string) {
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  // Full navigation so the proxy sees the fresh session cookie.
  window.location.href = `/${locale}${safe}`;
}

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const te = useErrorText();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api('/auth/login', { method: 'POST', body: v });
      afterAuth(params.get('next'), locale);
    } catch (e) {
      setError(te(e));
    }
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <>
      <Heading title={t('loginTitle')} subtitle={t('loginSubtitle')} />
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <FormError message={error} />
        <Field label={t('email')} htmlFor="email" error={errors.email && te('email')}>
          <Input id="email" type="email" autoComplete="email" size_="lg" autoFocus aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              {t('password')}
              <Link href="/forgot-password" className="text-[13px] font-normal text-primary hover:underline">
                {t('forgot')}
              </Link>
            </span>
          }
          htmlFor="password"
          error={errors.password && te('required')}
        >
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {t('login')} <ArrowRight />
        </Button>
        <p className="text-center text-sm text-muted">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('toRegister')}
          </Link>
        </p>
      </form>
    </>
  );
}

export function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const te = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api('/auth/register', { method: 'POST', body: { ...v, locale } });
      afterAuth(null, locale);
    } catch (e) {
      setError(te(e));
    }
  });
  const { errors, isSubmitting } = form.formState;
  const pwError = errors.password?.message;
  return (
    <>
      <Heading title={t('registerTitle')} subtitle={t('registerSubtitle')} />
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <FormError message={error} />
        <Field label={t('name')} htmlFor="name" error={errors.name && te('required')}>
          <Input id="name" autoComplete="given-name" size_="lg" autoFocus aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label={t('email')} htmlFor="email" error={errors.email && te('email')}>
          <Input id="email" type="email" autoComplete="email" size_="lg" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field
          label={t('password')}
          htmlFor="password"
          hint={t('passwordHint')}
          error={pwError && (pwError.startsWith('password_') ? te(pwError) : te('min8'))}
        >
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
          {t('register')} <ArrowRight />
        </Button>
        <p className="text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('toLogin')}
          </Link>
        </p>
      </form>
    </>
  );
}

export function ForgotForm() {
  const t = useTranslations('auth');
  const te = useErrorText();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().email() })) });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api('/auth/forgot-password', { method: 'POST', body: v });
      setSent(true);
    } catch (e) {
      setError(te(e));
    }
  });
  return (
    <>
      <Heading title={t('forgotTitle')} subtitle={t('forgotSubtitle')} />
      {sent ? (
        <div className="card-glass flex gap-3 rounded-card border p-4 text-sm text-muted">
          <MailCheck className="size-5 shrink-0 text-primary" />
          {t('forgotSent')}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <FormError message={error} />
          <Field label={t('email')} htmlFor="email" error={form.formState.errors.email && te('email')}>
            <Input id="email" type="email" size_="lg" autoFocus {...form.register('email')} />
          </Field>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {t('forgotSend')}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        ← {t('backToLogin')}
      </Link>
    </>
  );
}

export function ResetForm() {
  const t = useTranslations('auth');
  const te = useErrorText();
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password: registerSchema.shape.password })) });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: v.password } });
      setDone(true);
    } catch (e) {
      setError(te(e));
    }
  });
  const pwError = form.formState.errors.password?.message;
  return (
    <>
      <Heading title={t('resetTitle')} subtitle={t('passwordHint')} />
      {done ? (
        <div className="card-glass rounded-card border p-4 text-sm text-muted">{t('resetDone')}</div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <FormError message={error} />
          <Field label={t('password')} htmlFor="password" error={pwError && (pwError.startsWith('password_') ? te(pwError) : te('min8'))}>
            <PasswordInput id="password" autoComplete="new-password" autoFocus {...form.register('password')} />
          </Field>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {t('resetSubmit')}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        ← {t('backToLogin')}
      </Link>
    </>
  );
}
