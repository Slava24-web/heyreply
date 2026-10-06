'use client';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Segmented } from '@/components/ui/segmented';

export const PERIODS = ['7d', '30d', '90d', '1y', 'all'] as const;
export type PeriodKey = (typeof PERIODS)[number];
const DAYS: Record<PeriodKey, number | null> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: null };

export function usePeriod() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get('period') as PeriodKey | null;
  const key: PeriodKey = raw && PERIODS.includes(raw) ? raw : '90d';
  const period = useMemo(() => {
    const days = DAYS[key];
    if (!days) return {};
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - days + 1);
    return { from: from.toISOString() };
  }, [key]);
  const set = (k: PeriodKey) => {
    const next = new URLSearchParams(sp.toString());
    next.set('period', k);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  return { key, period, set };
}

export function PeriodSwitch() {
  const t = useTranslations('period');
  const { key, set } = usePeriod();
  return (
    <Segmented
      value={key}
      onChange={(v) => v && set(v)}
      options={PERIODS.map((p) => ({ value: p, label: t(p) }))}
      ariaLabel="Period"
      className="max-w-full overflow-x-auto"
    />
  );
}
