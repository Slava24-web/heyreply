'use client';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

const DAY = 86_400_000;

export function useFormat() {
  const locale = useLocale();
  return useMemo(() => {
    const tag = locale === 'ru' ? 'ru-RU' : 'en-US';
    const num = new Intl.NumberFormat(tag);
    const pctFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    const dateFmt = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' });
    const dateYFmt = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' });
    const dateTimeFmt = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const rel = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });

    const money = (v: number, currency?: string | null) => {
      if (!currency) return num.format(v);
      try {
        return new Intl.NumberFormat(tag, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
      } catch {
        return `${num.format(v)} ${currency}`;
      }
    };
    const compactMoney = (v: number, currency?: string | null) => {
      try {
        return new Intl.NumberFormat(tag, {
          style: currency ? 'currency' : 'decimal',
          currency: currency ?? undefined,
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(v);
      } catch {
        return num.format(v);
      }
    };

    return {
      tag,
      num: (v: number) => num.format(v),
      pct: (v: number) => `${pctFmt.format(v)}%`,
      money,
      compactMoney,
      salary(from: number | null, to: number | null, currency: string | null) {
        if (from == null && to == null) return null;
        if (from != null && to != null) return from === to ? money(from, currency) : `${num.format(from)} – ${money(to, currency)}`;
        return locale === 'ru'
          ? `${from != null ? 'от' : 'до'} ${money((from ?? to)!, currency)}`
          : `${from != null ? 'from' : 'up to'} ${money((from ?? to)!, currency)}`;
      },
      date(iso: string | Date) {
        const d = new Date(iso);
        return d.getFullYear() === new Date().getFullYear() ? dateFmt.format(d) : dateYFmt.format(d);
      },
      dateTime: (iso: string | Date) => dateTimeFmt.format(new Date(iso)),
      relative(iso: string | Date) {
        const diff = Math.round((new Date(iso).getTime() - Date.now()) / DAY);
        return rel.format(diff, 'day');
      },
    };
  }, [locale]);
}
