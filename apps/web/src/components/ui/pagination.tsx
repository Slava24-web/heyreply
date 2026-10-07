'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { useStoredState } from '@/lib/use-stored';
import { cn } from '@/lib/utils';

export const PAGE_SIZES = [10, 20, 30, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

const isPageSize = (v: unknown): v is PageSize => PAGE_SIZES.includes(v as PageSize);

/** One "rows per page" choice for every table, kept in this browser. */
export function usePageSize() {
  return useStoredState<PageSize>('heyreply.pageSize', DEFAULT_PAGE_SIZE, { validate: isPageSize });
}

export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));
/** Keeps a page number inside what exists (after filtering or deleting the last rows of the last page). */
export const clampPage = (page: number, total: number, pageSize: number) => Math.min(Math.max(1, page), pageCount(total, pageSize));

/** 1 … 4 5 [6] 7 8 … 20: the first and last page, and the neighbours of the current one. */
export function pageItems(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => wanted.add(n));
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? (['gap', n] as const) : [n]));
}

interface Props {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  className?: string;
  /** Denser layout for narrow cards. */
  compact?: boolean;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, className, compact }: Props) {
  const t = useTranslations('pagination');
  // Nothing to page through and the smallest size already shows everything
  if (total <= PAGE_SIZES[0]) return null;
  const pages = pageCount(total, pageSize);
  const current = clampPage(page, total, pageSize);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  const go = (n: number) => n !== current && onPageChange(clampPage(n, total, pageSize));

  return (
    <nav aria-label={t('nav')} className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-muted tabular" aria-live="polite">
          {t('showing', { from, to, total })}
        </p>
        <label className="flex items-center gap-2 text-muted">
          <span className={cn(compact && 'sr-only')}>{t('rowsPerPage')}</span>
          <NativeSelect value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)} className="h-8 w-[72px] rounded-[8px] py-0 pr-7 pl-2.5 text-[13px]" aria-label={t('rowsPerPage')}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => go(current - 1)} disabled={current <= 1} aria-label={t('prev')}>
            <ChevronLeft />
          </Button>
          {/* Narrow screens (and compact cards): just "3 / 7"; wider ones: the page numbers */}
          <span className={cn('px-2 text-muted tabular', compact ? '' : 'sm:hidden')}>{t('pageOf', { page: current, pages })}</span>
          {!compact
            ? pageItems(current, pages).map((n, i) =>
                n === 'gap' ? (
                  <span key={`gap-${i}`} aria-hidden className="hidden w-6 text-center text-subtle sm:inline">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === current ? 'soft' : 'ghost'}
                    size="icon-sm"
                    className="hidden tabular sm:inline-flex"
                    onClick={() => go(n)}
                    aria-label={t('page', { page: n })}
                    aria-current={n === current ? 'page' : undefined}
                  >
                    {n}
                  </Button>
                ),
              )
            : null}
          <Button variant="outline" size="icon-sm" onClick={() => go(current + 1)} disabled={current >= pages} aria-label={t('next')}>
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
