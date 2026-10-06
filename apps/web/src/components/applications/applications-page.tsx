'use client';
import { Columns3, Download, Kanban, LayoutList, Rows3, Tag, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useUI } from '@/components/shell/ui-context';
import { exportUrl } from '@/lib/api';
import { useBulk, useInfiniteApplications } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { FilterChips, FiltersPopover, SearchBox } from './filters';
import { StatusBadge, StatusPicker } from './status-badge';
import { useListParams } from './use-list-params';
import { ALL_COLUMNS, FeedView, KanbanView, TableView, type ColumnKey } from './views';

type View = 'table' | 'kanban' | 'feed';

function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      // Per-viewer preference read after mount (localStorage is unavailable during SSR)
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setV(JSON.parse(raw));
      else if (key === 'heyreply.view' && window.innerWidth < 768) setV('feed' as T);
    } catch {}
  }, [key]);
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [v, set] as const;
}

function EmptyState() {
  const t = useTranslations('list');
  const { openQuickAdd } = useUI();
  return (
    <div className="hero-gradient flex flex-col items-center rounded-panel border border-border px-6 py-20 text-center">
      <div className="mb-6 flex -space-x-3" aria-hidden>
        {['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'].map((c, i) => (
          <span key={c} className="size-12 rounded-[14px] border-2 border-surface" style={{ background: c, transform: `rotate(${(i - 1) * 8}deg)`, opacity: 0.9 - i * 0.15 }} />
        ))}
      </div>
      <h2 className="font-display text-2xl font-medium tracking-tight">{t('emptyTitle')}</h2>
      <p className="mt-3 max-w-md text-muted">{t('emptyText')}</p>
      <Button size="lg" className="mt-8" onClick={() => openQuickAdd()}>
        {t('emptyCta')}
      </Button>
      <p className="mt-3 text-xs text-subtle">{t('emptyHint')}</p>
    </div>
  );
}

function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const t = useTranslations('list');
  const tc = useTranslations('common');
  const bulk = useBulk();
  const [confirm, setConfirm] = useState(false);
  const [tag, setTag] = useState('');
  const run = async (body: Parameters<typeof bulk.mutateAsync>[0]) => {
    const r = await bulk.mutateAsync(body);
    toast.success(t('bulkDone', { count: r.affected }));
    onClear();
  };
  return (
    <div className="fixed inset-x-4 bottom-[88px] z-30 mx-auto flex max-w-[640px] items-center gap-2 rounded-panel border border-border bg-surface/95 p-2 pl-4 shadow-pop backdrop-blur animate-fade-up md:bottom-6">
      <span className="text-sm font-medium tabular">{t('selected', { count: ids.length })}</span>
      <div className="ml-auto flex items-center gap-1">
        <StatusPicker value={'APPLIED'} onChange={(s) => run({ ids, action: 'status', status: s })} align="end">
          <Button variant="ghost" size="sm">
            {t('bulkStatus')}
          </Button>
        </StatusPicker>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Tag /> <span className="hidden sm:inline">{t('bulkTag')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tag.trim()) run({ ids, action: 'tag', tagName: tag.trim() });
                setTag('');
              }}
              className="flex gap-2"
            >
              <Input autoFocus value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('bulkTagPrompt')} />
              <Button type="submit" size="md">
                {tc('apply')}
              </Button>
            </form>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm(true)}>
          <Trash2 /> <span className="hidden sm:inline">{t('bulkDelete')}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label={tc('close')}>
          <X />
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('bulkDeleteConfirm')}
        description={t('bulkDeleteText')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        onConfirm={() => run({ ids, action: 'delete' })}
      />
    </div>
  );
}

export function ApplicationsPage() {
  const t = useTranslations('list');
  const { filters, update, apiParams, activeCount } = useListParams();
  const [view, setView] = useStored<View>('heyreply.view', 'table');
  const [columns, setColumns] = useStored<ColumnKey[]>(
    'heyreply.columns',
    ALL_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key),
  );
  const [compact, setCompact] = useStored('heyreply.compact', false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pageSize = view === 'kanban' ? 500 : 60;
  const query = useInfiniteApplications(apiParams, pageSize);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  // Selection is meaningless once the filtered set changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSelected(new Set()), [apiParams]);

  const onSelect = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  const isEmptyAccount = !query.isLoading && total === 0 && !activeCount && !filters.q;
  const exportQuery = { ...apiParams } as Record<string, string | string[] | undefined>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[34px]">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted tabular">{query.isLoading ? '…' : t('subtitle', { count: total })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={(v) => v && setView(v)}
            options={[
              { value: 'table', label: <span className="hidden sm:inline">{t('table')}</span>, icon: <Rows3 /> },
              { value: 'kanban', label: <span className="hidden sm:inline">{t('kanban')}</span>, icon: <Kanban /> },
              { value: 'feed', label: <span className="hidden sm:inline">{t('feed')}</span>, icon: <LayoutList /> },
            ]}
            ariaLabel="View"
          />
          <Menu>
            <MenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t('columns')}>
                <Columns3 />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-56">
              <MenuLabel>{t('columns')}</MenuLabel>
              {ALL_COLUMNS.filter((c) => !c.locked).map((c) => (
                <MenuItem
                  key={c.key}
                  onSelect={(e) => {
                    e.preventDefault();
                    setColumns(columns.includes(c.key) ? columns.filter((x) => x !== c.key) : [...columns, c.key]);
                  }}
                >
                  <input type="checkbox" readOnly checked={columns.includes(c.key)} className="pointer-events-none size-4 accent-[var(--primary)]" />
                  {t(`col.${c.key}`)}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuLabel>{t('density')}</MenuLabel>
              <MenuItem onSelect={() => setCompact(false)} className={cn(!compact && 'text-primary')}>
                {t('comfortable')}
              </MenuItem>
              <MenuItem onSelect={() => setCompact(true)} className={cn(compact && 'text-primary')}>
                {t('compact')}
              </MenuItem>
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Export">
                <Download />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem asChild>
                <a href={exportUrl('/applications/export', { ...exportQuery, fileFormat: 'csv' })} download>
                  {t('exportCsv')}
                </a>
              </MenuItem>
              <MenuItem asChild>
                <a href={exportUrl('/applications/export', { ...exportQuery, fileFormat: 'json' })} download>
                  {t('exportJson')}
                </a>
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      {isEmptyAccount ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox />
              <FiltersPopover />
            </div>
            <FilterChips />
          </div>

          {query.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-[12px]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-card border border-dashed border-border-strong px-6 py-16 text-center">
              <p className="font-medium">{t('noResults')}</p>
              <p className="mt-1 text-sm text-muted">{t('noResultsText')}</p>
            </div>
          ) : view === 'table' ? (
            <TableView items={items} columns={columns} sort={filters.sort} onSort={(s) => update({ sort: s })} selected={selected} onSelect={onSelect} compact={compact} />
          ) : view === 'kanban' ? (
            <KanbanView items={items} />
          ) : (
            <FeedView items={items} />
          )}
          <div ref={sentinel} className="h-1" />
          {query.isFetchingNextPage ? <Skeleton className="h-14 w-full rounded-[12px]" /> : null}
        </>
      )}
      {selected.size > 0 ? <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} /> : null}
    </div>
  );
}
