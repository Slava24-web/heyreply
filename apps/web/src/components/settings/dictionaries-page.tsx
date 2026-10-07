'use client';
import { Check, Merge, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { DICTIONARY_TYPES, type DictionaryType, type DictItem } from '@heyreply/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { clampPage, Pagination, usePageSize } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog } from '@/components/ui/sheet';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import { useDictionary } from '@/lib/queries';
import { cn } from '@/lib/utils';

function Row({ item, type, selected, onToggle, onDelete }: { item: DictItem; type: DictionaryType; selected: boolean; onToggle: () => void; onDelete: () => void }) {
  const t = useTranslations('dict');
  const te = useErrorText();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [group, setGroup] = useState(item.groupName ?? '');

  const save = async (patch: { name?: string; groupName?: string | null }) => {
    try {
      await api(`/dictionaries/${type}/${item.id}`, { method: 'PATCH', body: patch });
      qc.invalidateQueries({ queryKey: ['dict', type] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      toast.success(t('renamed'));
      setEditing(false);
    } catch (e) {
      toast.error(te(e));
    }
  };

  return (
    <li className={cn('grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-0 sm:grid-cols-[32px_1fr_180px_112px_auto]', selected && 'bg-primary-soft/40')}>
      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={selected} onChange={onToggle} aria-label={item.name} />
      {editing ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name !== item.name) save({ name: name.trim() });
            else setEditing(false);
          }}
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-9" onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} />
          <Button size="icon-sm" type="submit" aria-label="Save">
            <Check />
          </Button>
          <Button size="icon-sm" variant="ghost" type="button" onClick={() => setEditing(false)} aria-label="Cancel">
            <X />
          </Button>
        </form>
      ) : (
        <span className="truncate text-sm font-medium">{item.name}</span>
      )}
      {type === 'positions' ? (
        <Input
          className="hidden h-9 sm:block"
          value={group}
          placeholder={t('groupPlaceholder')}
          onChange={(e) => setGroup(e.target.value)}
          onBlur={() => group !== (item.groupName ?? '') && save({ groupName: group || null })}
          aria-label={t('group')}
        />
      ) : (
        <span className="hidden sm:block" />
      )}
      <span className="hidden text-right text-sm text-muted tabular sm:block">{item.usageCount}</span>
      <span className="flex justify-end gap-1">
        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label={t('rename')}>
          <Pencil />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label="Delete" className="text-danger">
          <Trash2 />
        </Button>
      </span>
    </li>
  );
}

export function DictionariesPage() {
  const t = useTranslations('dict');
  const tc = useTranslations('common');
  const te = useErrorText();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const type = (DICTIONARY_TYPES as readonly string[]).includes(sp.get('type') ?? '') ? (sp.get('type') as DictionaryType) : 'companies';
  const { data, isLoading } = useDictionary(type);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [toDelete, setToDelete] = useState<DictItem | null>(null);
  const [filter, setFilter] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['dict', type] });
    qc.invalidateQueries({ queryKey: ['applications'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
  };

  const items = (data ?? []).filter((i) => !filter || i.name.toLowerCase().includes(filter.toLowerCase()));
  const sel = [...selected];
  const [pageSize, setPageSize] = usePageSize();
  const [page, setPage] = useState(1);
  // Derived: a search or a deletion can leave fewer pages than the one we were on
  const current = clampPage(page, items.length, pageSize);
  const shown = items.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[34px]">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>
      <Segmented
        value={type}
        onChange={(v) => {
          if (!v) return;
          setSelected(new Set());
          setPage(1);
          router.replace(`${pathname}?type=${v}`, { scroll: false });
        }}
        options={DICTIONARY_TYPES.map((d) => ({ value: d, label: t(d) }))}
        className="max-w-full self-start overflow-x-auto"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          placeholder={tc('search')}
          className="max-w-[260px]"
        />
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            try {
              await api(`/dictionaries/${type}`, { method: 'POST', body: { name: newName.trim() } });
              setNewName('');
              refresh();
            } catch (err) {
              toast.error(te(err));
            }
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('addPlaceholder')} className="max-w-[220px]" />
          <Button type="submit" variant="soft">
            <Plus /> {t('add')}
          </Button>
        </form>
      </div>

      {sel.length > 1 ? (
        <Card className="flex flex-wrap items-center gap-3 p-4 animate-fade-up">
          <Merge className="size-4 text-primary" />
          <span className="text-sm font-medium">{t('mergeTitle', { count: sel.length })}</span>
          <NativeSelect value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="max-w-[240px]">
            <option value="">{t('mergeInto')}</option>
            {(data ?? [])
              .filter((i) => selected.has(i.id))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </NativeSelect>
          <Button
            disabled={!mergeTarget}
            onClick={async () => {
              try {
                await api(`/dictionaries/${type}/merge`, { method: 'POST', body: { sourceIds: sel, targetId: mergeTarget } });
                toast.success(t('merged'));
                setSelected(new Set());
                setMergeTarget('');
                refresh();
              } catch (err) {
                toast.error(te(err));
              }
            }}
          >
            {t('merge')}
          </Button>
          <p className="w-full text-xs text-muted">{t('mergeText')}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[32px_1fr_180px_112px_auto] gap-3 border-b border-border px-4 py-2.5 text-xs font-medium text-subtle sm:grid">
          <span />
          <span>{t(type)}</span>
          <span>{type === 'positions' ? t('group') : ''}</span>
          <span className="text-right">{t('usage')}</span>
          <span className="w-[68px]" />
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length ? (
          <ul>
            {shown.map((i) => (
              <Row
                key={i.id}
                item={i}
                type={type}
                selected={selected.has(i.id)}
                onToggle={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(i.id)) n.delete(i.id);
                    else n.add(i.id);
                    return n;
                  })
                }
                onDelete={() => setToDelete(i)}
              />
            ))}
          </ul>
        ) : (
          <p className="p-10 text-center text-sm text-muted">{t('empty')}</p>
        )}
        {!isLoading ? <Pagination className="border-t border-border/70 px-4 py-3" page={current} pageSize={pageSize} total={items.length} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
      </Card>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete ? t('deleteConfirm', { name: toDelete.name }) : ''}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await api(`/dictionaries/${type}/${toDelete.id}`, { method: 'DELETE' });
            toast.success(t('deleted'));
            refresh();
          } catch (err) {
            toast.error(te(err));
          }
        }}
      />
    </div>
  );
}
