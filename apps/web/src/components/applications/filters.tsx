'use client';
import { Check, ListFilter, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { APP_STATUSES, WORK_FORMATS, type AppStatus, type DictItem } from '@heyreply/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDictionary, useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { StatusDot } from './status-badge';
import { useListParams, type ArrayKey } from './use-list-params';

export function SearchBox() {
  const t = useTranslations('list');
  const { filters, update } = useListParams();
  const [q, setQ] = useState(filters.q ?? '');
  // Keep the box in sync when the URL changes from outside (back/forward, clear all)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQ(filters.q ?? ''), [filters.q]);
  useEffect(() => {
    if ((filters.q ?? '') === q) return;
    const id = setTimeout(() => update({ q: q || undefined }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" aria-label={t('searchPlaceholder')} />
    </div>
  );
}

function OptionGroup({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: React.ReactNode }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 8);
  return (
    <div>
      <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">{title}</p>
      {shown.map((i) => {
        const on = selected.includes(i.id);
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => onToggle(i.id)}
            className="flex h-8 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] hover:bg-surface-2"
            aria-pressed={on}
          >
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-[5px] border', on ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong')}>
              {on ? <Check className="size-3" /> : null}
            </span>
            <span className="truncate">{i.label}</span>
          </button>
        );
      })}
      {items.length > 8 ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="px-2.5 py-1 text-xs font-medium text-primary hover:underline">
          {all ? '−' : `+${items.length - 8}`}
        </button>
      ) : null}
    </div>
  );
}

const dictItems = (d?: DictItem[]) => (d ?? []).filter((x) => x.usageCount > 0).map((x) => ({ id: x.id, label: x.name }));

export function FiltersPopover() {
  const t = useTranslations('list');
  const ts = useTranslations('status');
  const tf = useTranslations('format');
  const tq = useTranslations('quickAdd');
  const { filters, update, clear, activeCount } = useListParams();
  const { data: me } = useMe();
  const sources = useDictionary('sources');
  const positions = useDictionary('positions');
  const locations = useDictionary('locations');
  const tags = useDictionary('tags');

  const toggle = (key: ArrayKey) => (id: string) => {
    const cur = filters[key];
    update({ [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(activeCount && 'border-primary/40 text-primary')}>
          <ListFilter /> {t('filters')}
          {activeCount ? <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-fg">{activeCount}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="scrollbar-thin max-h-[min(70vh,620px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto p-3">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <OptionGroup
            title={tq('status')}
            items={APP_STATUSES.map((s) => ({
              id: s,
              label: (
                <span className="flex items-center gap-2">
                  <StatusDot status={s as AppStatus} className="size-2" />
                  {ts(s)}
                </span>
              ),
            }))}
            selected={filters.status}
            onToggle={toggle('status')}
          />
          <div>
            <OptionGroup title={tq('source')} items={dictItems(sources.data)} selected={filters.sourceId} onToggle={toggle('sourceId')} />
            <OptionGroup title={tq('workFormat')} items={WORK_FORMATS.map((f) => ({ id: f, label: tf(f) }))} selected={filters.format} onToggle={toggle('format')} />
          </div>
          <OptionGroup title={tq('position')} items={dictItems(positions.data)} selected={filters.positionId} onToggle={toggle('positionId')} />
          <div>
            <OptionGroup title={tq('location')} items={dictItems(locations.data)} selected={filters.locationId} onToggle={toggle('locationId')} />
            <OptionGroup title={tq('tags')} items={dictItems(tags.data)} selected={filters.tag} onToggle={toggle('tag')} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border px-1 pt-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('dateFrom')}
            <Input type="date" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('dateTo')}
            <Input type="date" value={filters.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('salaryMin')}
            <Input inputMode="numeric" className="tabular" value={filters.salaryMin ?? ''} onChange={(e) => update({ salaryMin: e.target.value.replace(/\D/g, '') || undefined })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('salaryMax')}
            <Input inputMode="numeric" className="tabular" value={filters.salaryMax ?? ''} onChange={(e) => update({ salaryMax: e.target.value.replace(/\D/g, '') || undefined })} />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!filters.waitingOnly} onChange={(e) => update({ waitingOnly: e.target.checked ? 'true' : undefined })} />
            {t('waitingOnly', { days: me?.ghostingDays ?? 14 })}
          </label>
          {activeCount ? (
            <Button variant="ghost" size="sm" onClick={clear}>
              {t('clearFilters')}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterChips() {
  const t = useTranslations('list');
  const ts = useTranslations('status');
  const tf = useTranslations('format');
  const { filters, update, clear, activeCount } = useListParams();
  const sources = useDictionary('sources');
  const positions = useDictionary('positions');
  const locations = useDictionary('locations');
  const tags = useDictionary('tags');
  const name = (d: DictItem[] | undefined, id: string) => d?.find((x) => x.id === id)?.name ?? '…';

  const chips = useMemo(() => {
    const out: { key: string; label: string; remove: () => void }[] = [];
    const arr = (k: ArrayKey, label: (id: string) => string) =>
      filters[k].forEach((id) => out.push({ key: k + id, label: label(id), remove: () => update({ [k]: filters[k].filter((x) => x !== id) }) }));
    arr('status', (id) => ts(id as AppStatus));
    arr('sourceId', (id) => name(sources.data, id));
    arr('positionId', (id) => name(positions.data, id));
    arr('locationId', (id) => name(locations.data, id));
    arr('format', (id) => tf(id as 'OFFICE'));
    arr('tag', (id) => '#' + name(tags.data, id));
    if (filters.from) out.push({ key: 'from', label: `≥ ${filters.from}`, remove: () => update({ from: undefined }) });
    if (filters.to) out.push({ key: 'to', label: `≤ ${filters.to}`, remove: () => update({ to: undefined }) });
    if (filters.salaryMin) out.push({ key: 'smin', label: `₽ ≥ ${filters.salaryMin}`, remove: () => update({ salaryMin: undefined }) });
    if (filters.salaryMax) out.push({ key: 'smax', label: `₽ ≤ ${filters.salaryMax}`, remove: () => update({ salaryMax: undefined }) });
    if (filters.waitingOnly) out.push({ key: 'wait', label: t('waitingOnly', { days: '…' }), remove: () => update({ waitingOnly: undefined }) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sources.data, positions.data, locations.data, tags.data]);

  if (!activeCount) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 animate-fade-up">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft py-0 pr-1 pl-3 text-xs font-medium text-primary">
          {c.label}
          <button onClick={c.remove} className="rounded-full p-0.5 hover:bg-primary/15" aria-label="Remove filter">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button onClick={clear} className="ml-1 text-xs font-medium text-muted hover:text-text">
        {t('clearFilters')}
      </button>
    </div>
  );
}
