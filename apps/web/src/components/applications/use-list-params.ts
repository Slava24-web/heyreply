'use client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

export const ARRAY_KEYS = ['status', 'sourceId', 'positionId', 'locationId', 'format', 'tag'] as const;
export const SCALAR_KEYS = ['q', 'from', 'to', 'salaryMin', 'salaryMax', 'waitingOnly', 'sort'] as const;
export type ArrayKey = (typeof ARRAY_KEYS)[number];
export type ScalarKey = (typeof SCALAR_KEYS)[number];

export interface ListFilters {
  q?: string;
  status: string[];
  sourceId: string[];
  positionId: string[];
  locationId: string[];
  format: string[];
  tag: string[];
  from?: string;
  to?: string;
  salaryMin?: string;
  salaryMax?: string;
  waitingOnly?: string;
  sort: string;
}

/** Filter state lives in the URL so a filtered view can be bookmarked or shared. */
export function useListParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<ListFilters>(() => {
    const arr = (k: string) => (sp.get(k) ? sp.get(k)!.split(',').filter(Boolean) : []);
    return {
      q: sp.get('q') ?? undefined,
      status: arr('status'),
      sourceId: arr('sourceId'),
      positionId: arr('positionId'),
      locationId: arr('locationId'),
      format: arr('format'),
      tag: arr('tag'),
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      salaryMin: sp.get('salaryMin') ?? undefined,
      salaryMax: sp.get('salaryMax') ?? undefined,
      waitingOnly: sp.get('waitingOnly') ?? undefined,
      sort: sp.get('sort') ?? '-appliedAt',
    };
  }, [sp]);

  // 1-based page of the paginated views; lives in the URL like the filters, so back/forward and shared links keep the place
  const page = useMemo(() => {
    const n = Number.parseInt(sp.get('page') ?? '', 10);
    return Number.isFinite(n) && n > 1 ? n : 1;
  }, [sp]);

  const setPage = useCallback(
    (n: number) => {
      const next = new URLSearchParams(sp.toString());
      if (n > 1) next.set('page', String(n));
      else next.delete('page');
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  const update = useCallback(
    (patch: Partial<Record<ArrayKey, string[]> & Record<ScalarKey, string | undefined>>) => {
      const next = new URLSearchParams(sp.toString());
      // Any change of filter, search or sort starts again from the first page
      next.delete('page');
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
        else next.set(k, Array.isArray(v) ? v.join(',') : v);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  const clear = useCallback(() => {
    const next = new URLSearchParams();
    if (sp.get('sort')) next.set('sort', sp.get('sort')!);
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [sp, router, pathname]);

  const activeCount =
    ARRAY_KEYS.reduce((n, k) => n + (filters[k].length ? 1 : 0), 0) +
    (['from', 'to', 'salaryMin', 'salaryMax', 'waitingOnly'] as const).filter((k) => filters[k]).length;

  const apiParams = useMemo(() => {
    const p: Record<string, string | string[] | undefined> = {};
    for (const k of ARRAY_KEYS) if (filters[k].length) p[k] = filters[k];
    for (const k of SCALAR_KEYS) if (filters[k]) p[k] = filters[k];
    if (filters.to) p.to = `${filters.to}T23:59:59`;
    return p;
  }, [filters]);

  return { filters, update, clear, activeCount, apiParams, page, setPage };
}
