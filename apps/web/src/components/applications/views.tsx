'use client';
import { ArrowDown, ArrowUp, Clock, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo, useMemo, useState } from 'react';
import type { ApplicationDto, AppStatus } from '@heyreply/shared';
import { useFormat } from '@/lib/format';
import { useChangeStatus, useMe } from '@/lib/queries';
import { STATUS_META } from '@/lib/status';
import { cn } from '@/lib/utils';
import { useUIActions } from '@/components/shell/ui-context';
import { CompanyAvatar } from './company-avatar';
import { StatusBadge, StatusPicker } from './status-badge';

export type ColumnKey = 'appliedAt' | 'company' | 'position' | 'status' | 'source' | 'location' | 'format' | 'salary' | 'waiting' | 'updatedAt' | 'tags';

export const ALL_COLUMNS: { key: ColumnKey; sort?: string; width: string; defaultOn: boolean; locked?: boolean }[] = [
  { key: 'appliedAt', sort: 'appliedAt', width: '96px', defaultOn: true },
  { key: 'company', sort: 'company', width: 'minmax(200px,1.4fr)', defaultOn: true, locked: true },
  { key: 'position', sort: 'position', width: 'minmax(180px,1.4fr)', defaultOn: true, locked: true },
  { key: 'status', sort: 'status', width: '190px', defaultOn: true, locked: true },
  { key: 'source', width: 'minmax(110px,0.8fr)', defaultOn: true },
  { key: 'location', width: 'minmax(110px,0.8fr)', defaultOn: false },
  { key: 'format', width: '96px', defaultOn: true },
  { key: 'salary', sort: 'salary', width: 'minmax(140px,1fr)', defaultOn: true },
  { key: 'waiting', width: '84px', defaultOn: true },
  { key: 'updatedAt', sort: 'updatedAt', width: '104px', defaultOn: false },
  { key: 'tags', width: 'minmax(120px,0.8fr)', defaultOn: false },
];

/** Everything a cell needs from hooks, resolved once per table instead of once per cell. */
interface CellCtx {
  f: ReturnType<typeof useFormat>;
  tf: ReturnType<typeof useTranslations<'format'>>;
  tl: ReturnType<typeof useTranslations<'list'>>;
  ghostingDays: number;
  changeStatus: (v: { id: string; status: AppStatus }) => void;
}

function renderCell(col: ColumnKey, a: ApplicationDto, { f, tf, tl, ghostingDays, changeStatus }: CellCtx) {
  switch (col) {
    case 'appliedAt':
      return <span className="text-[13px] text-muted tabular">{f.date(a.appliedAt)}</span>;
    case 'company':
      return (
        <span className="flex min-w-0 items-center gap-3">
          <CompanyAvatar name={a.company.name} size={30} />
          <span className="truncate font-medium">{a.company.name}</span>
        </span>
      );
    case 'position':
      return <span className="truncate text-text">{a.position.name}</span>;
    case 'status':
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <StatusPicker value={a.status} onChange={(s) => changeStatus({ id: a.id, status: s })}>
            <button className="rounded-full transition-transform hover:scale-[1.03]">
              <StatusBadge status={a.status} withChevron />
            </button>
          </StatusPicker>
        </span>
      );
    case 'source':
      return <span className="truncate text-[13px] text-muted">{a.source?.name ?? '—'}</span>;
    case 'location':
      return <span className="truncate text-[13px] text-muted">{a.location?.name ?? '—'}</span>;
    case 'format':
      return <span className="text-[13px] text-muted">{a.workFormat ? tf(a.workFormat) : '—'}</span>;
    case 'salary':
      return <span className="truncate text-[13px] tabular">{f.salary(a.salaryFrom, a.salaryTo, a.currency) ?? <span className="text-subtle">—</span>}</span>;
    case 'waiting':
      return a.daysWaiting != null ? (
        <span className={cn('text-[13px] tabular', a.daysWaiting > ghostingDays ? 'font-medium text-accent' : 'text-muted')}>{tl('daysShort', { count: a.daysWaiting })}</span>
      ) : (
        <span className="text-subtle">—</span>
      );
    case 'updatedAt':
      return <span className="text-[13px] text-muted tabular">{f.date(a.updatedAt)}</span>;
    case 'tags':
      return (
        <span className="flex gap-1 overflow-hidden">
          {a.tags.map((t) => (
            <span key={t.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
              {t.name}
            </span>
          ))}
        </span>
      );
  }
}

interface RowProps {
  a: ApplicationDto;
  cols: typeof ALL_COLUMNS;
  template: string;
  height: number;
  on: boolean;
  ctx: CellCtx;
  onOpen: (id: string) => void;
  onSelect: (ids: string[], on: boolean) => void;
}

/** Memoized: a sheet opening or one row being selected must not re-render the other hundreds of rows. */
const Row = memo(function Row({ a, cols, template, height, on, ctx, onOpen, onSelect }: RowProps) {
  return (
    <div
      role="row"
      onClick={() => onOpen(a.id)}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen(a.id)}
      tabIndex={0}
      className={cn(
        'group grid cursor-pointer items-center border-b border-border/70 text-sm transition-colors last:border-b-0 hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none',
        on && 'bg-primary-soft/50 hover:bg-primary-soft/70',
      )}
      style={{ gridTemplateColumns: template, height }}
    >
      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" aria-label="Select" className="size-4 accent-[var(--primary)]" checked={on} onChange={(e) => onSelect([a.id], e.target.checked)} />
      </div>
      {cols.map((c) => (
        <div role="cell" key={c.key} className="flex min-w-0 items-center px-3">
          {renderCell(c.key, a, ctx)}
        </div>
      ))}
    </div>
  );
});

export function TableView({
  items,
  columns,
  sort,
  onSort,
  selected,
  onSelect,
  compact,
}: {
  items: ApplicationDto[];
  columns: ColumnKey[];
  sort: string;
  onSort: (s: string) => void;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  compact: boolean;
}) {
  const t = useTranslations('list.col');
  const { openApp } = useUIActions();
  const f = useFormat();
  const tf = useTranslations('format');
  const tl = useTranslations('list');
  const { data: me } = useMe();
  const { mutate: changeStatus } = useChangeStatus();
  const ghostingDays = me?.ghostingDays ?? 14;
  const ctx = useMemo<CellCtx>(() => ({ f, tf, tl, ghostingDays, changeStatus }), [f, tf, tl, ghostingDays, changeStatus]);
  const cols = useMemo(() => ALL_COLUMNS.filter((c) => columns.includes(c.key)), [columns]);
  const template = `44px ${cols.map((c) => c.width).join(' ')}`;
  const rowH = compact ? 44 : 56;
  const allOn = items.length > 0 && items.every((a) => selected.has(a.id));

  return (
    <div className="card-glass scrollbar-thin overflow-x-auto rounded-card border">
      <div role="table" className="min-w-[960px]" aria-rowcount={items.length}>
        <div role="row" className="grid items-center border-b border-border bg-surface-2/40 text-[12px] font-medium text-subtle" style={{ gridTemplateColumns: template }}>
          <div className="flex h-11 items-center justify-center">
            <input type="checkbox" aria-label="Select all" className="size-4 accent-[var(--primary)]" checked={allOn} onChange={(e) => onSelect(items.map((a) => a.id), e.target.checked)} />
          </div>
          {cols.map((c) => {
            const active = sort.replace('-', '') === c.sort;
            const desc = sort.startsWith('-');
            return (
              <div role="columnheader" key={c.key} className="flex h-11 items-center px-3" aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}>
                {c.sort ? (
                  <button onClick={() => onSort(active && desc ? c.sort! : `-${c.sort}`)} className={cn('inline-flex items-center gap-1 hover:text-text', active && 'text-text')}>
                    {t(c.key)}
                    {active ? desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" /> : null}
                  </button>
                ) : (
                  t(c.key)
                )}
              </div>
            );
          })}
        </div>
        <div>
          {items.map((a) => (
            <Row key={a.id} a={a} cols={cols} template={template} height={rowH} on={selected.has(a.id)} ctx={ctx} onOpen={openApp} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

const KANBAN: AppStatus[] = ['APPLIED', 'VIEWED', 'SCREENING', 'TEST_TASK', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'NO_RESPONSE', 'DECLINED'];

export function KanbanView({ items }: { items: ApplicationDto[] }) {
  const ts = useTranslations('status');
  const f = useFormat();
  const { openApp } = useUIActions();
  const change = useChangeStatus();
  const [over, setOver] = useState<AppStatus | null>(null);
  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      {KANBAN.map((s) => {
        const col = items.filter((a) => a.status === s);
        return (
          <section
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              const a = items.find((x) => x.id === id);
              if (a && a.status !== s) change.mutate({ id, status: s });
            }}
            className={cn('flex w-[272px] shrink-0 flex-col rounded-card border border-border bg-surface-2/50 transition-colors', over === s && 'border-primary/50 bg-primary-soft/40')}
          >
            <header className="relative flex items-center justify-between overflow-hidden rounded-t-card px-3.5 pt-4 pb-3">
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: STATUS_META[s].color }} />
              <h3 className="text-[13px] font-semibold">{ts(s)}</h3>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted tabular">{col.length}</span>
            </header>
            <div className="scrollbar-thin flex max-h-[68vh] min-h-24 flex-col gap-2 overflow-y-auto px-2.5 pb-3">
              {col.map((a) => (
                <article
                  key={a.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}
                  onClick={() => openApp(a.id)}
                  className="card-tint cursor-grab rounded-[12px] border p-3 transition hover:-translate-y-px hover:border-border-strong active:cursor-grabbing"
                >
                  <div className="flex items-center gap-2.5">
                    <CompanyAvatar name={a.company.name} size={26} />
                    <p className="truncate text-sm font-medium">{a.company.name}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] text-muted">{a.position.name}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-subtle tabular">
                    <span>{f.date(a.appliedAt)}</span>
                    {a.salaryFrom || a.salaryTo ? <span>{f.compactMoney((a.salaryFrom ?? a.salaryTo)!, a.currency)}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function FeedView({ items }: { items: ApplicationDto[] }) {
  const f = useFormat();
  const tl = useTranslations('list');
  const { openApp } = useUIActions();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <button onClick={() => openApp(a.id)} className="card-tint flex w-full items-start gap-3 rounded-card border p-4 text-left transition-[border-color,transform] hover:-translate-y-px hover:border-border-strong">
            <CompanyAvatar name={a.company.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{a.company.name}</span>
                <span className="shrink-0 text-xs text-subtle tabular">{f.date(a.appliedAt)}</span>
              </span>
              <span className="block truncate text-[13px] text-muted">{a.position.name}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={a.status} size="sm" />
                {a.location ? (
                  <span className="inline-flex items-center gap-1 text-xs text-subtle">
                    <MapPin className="size-3" />
                    {a.location.name}
                  </span>
                ) : null}
                {a.daysWaiting != null && a.daysWaiting > 7 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-subtle">
                    <Clock className="size-3" />
                    {tl('daysShort', { count: a.daysWaiting })}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
