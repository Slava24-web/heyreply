'use client';
import { useTranslations } from 'next-intl';
import { ApiError } from './api';

/** Maps API error codes and zod messages to localized text. */
export function useErrorText() {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    const key = err instanceof ApiError ? err.code : typeof err === 'string' ? err : err instanceof Error ? err.message : '';
    if (key && t.has(key as never)) return t(key as never);
    if (err instanceof ApiError && err.details?.[0] && t.has(err.details[0].message as never)) return t(err.details[0].message as never);
    return t('generic');
  };
}
