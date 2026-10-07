'use client';
import { Popover as P } from 'radix-ui';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useId, useMemo, useRef, useState } from 'react';
import { useFieldId } from './input';
import { normalizeName, type DictItem } from '@heyreply/shared';
import { cn } from '@/lib/utils';
import { fieldClass } from './input';

const MAX_RESULTS = 50;

/** Prefix matches first, then word-start, then substring; server order (usage, recency) is kept inside each group. */
export function rankOptions(options: DictItem[], query: string) {
  const q = normalizeName(query);
  if (!q) return options.slice(0, MAX_RESULTS);
  const groups: DictItem[][] = [[], [], []];
  for (const o of options) {
    const n = normalizeName(o.name);
    if (n.startsWith(q)) groups[0].push(o);
    else if (n.split(/[\s\-/().,]+/).some((w) => w.startsWith(q))) groups[1].push(o);
    else if (n.includes(q)) groups[2].push(o);
  }
  return groups.flat().slice(0, MAX_RESULTS);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalizeName(query);
  if (!q) return <>{text}</>;
  const idx = normalizeName(text).indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[3px] bg-primary-soft px-px text-primary">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface ListProps {
  query: string;
  options: DictItem[];
  exclude?: string[];
  createLabel: (v: string) => React.ReactNode;
  usageLabel?: (n: number) => string;
}

function useList({ query, options, exclude }: Pick<ListProps, 'query' | 'options' | 'exclude'>) {
  return useMemo(() => {
    const ex = new Set((exclude ?? []).map(normalizeName));
    const ranked = rankOptions(options, query).filter((o) => !ex.has(normalizeName(o.name)));
    const q = normalizeName(query);
    const exact = ranked.some((o) => normalizeName(o.name) === q) || ex.has(q);
    const canCreate = !!q && !exact;
    return { ranked, canCreate, count: ranked.length + (canCreate ? 1 : 0) };
  }, [options, query, exclude]);
}

function OptionList({
  id,
  query,
  ranked,
  canCreate,
  active,
  setActive,
  onPick,
  createLabel,
  usageLabel,
}: {
  id: string;
  query: string;
  ranked: DictItem[];
  canCreate: boolean;
  active: number;
  setActive: (i: number) => void;
  onPick: (v: string) => void;
} & Pick<ListProps, 'createLabel' | 'usageLabel'>) {
  return (
    <div role="listbox" id={id} className="scrollbar-thin max-h-[296px] overflow-y-auto">
      {ranked.map((o, i) => (
        <div
          key={o.id}
          id={`${id}-${i}`}
          role="option"
          aria-selected={active === i}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(i)}
          onClick={() => onPick(o.name)}
          className={cn(
            'flex h-9 cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2.5 text-sm',
            active === i ? 'bg-surface-2 text-text' : 'text-text',
          )}
        >
          <span className="truncate">
            <Highlight text={o.name} query={query} />
          </span>
          {usageLabel && o.usageCount > 0 ? <span className="shrink-0 text-[11px] text-subtle tabular">{usageLabel(o.usageCount)}</span> : null}
        </div>
      ))}
      {canCreate ? (
        <div
          id={`${id}-${ranked.length}`}
          role="option"
          aria-selected={active === ranked.length}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(ranked.length)}
          onClick={() => onPick(query.trim().replace(/\s+/g, ' '))}
          className={cn(
            'flex h-9 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 text-sm text-primary',
            ranked.length ? 'mt-1' : '',
            active === ranked.length ? 'bg-primary-soft' : '',
          )}
        >
          <Plus className="size-4" />
          <span className="truncate">{createLabel(query.trim())}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The input lives outside the popover content, so Radix treats focusing or clicking it as an "outside"
 * interaction and would close the list the moment it opens. Interactions with the field itself don't count.
 */
function keepOpenForField(e: { target: EventTarget | null; preventDefault(): void }, field?: HTMLElement | null) {
  const target = e.target as HTMLElement | null;
  if (target?.closest?.('[role=combobox]') || (field && target && field.contains(target))) e.preventDefault();
}

export interface ComboboxProps extends Omit<ListProps, "query"> {
  value: string;
  onChange: (v: string) => void;
  /** Called after a suggestion is accepted via keyboard — lets the form move focus forward. */
  onCommit?: () => void;
  placeholder?: string;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
}

export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { value, onChange, onCommit, options, createLabel, usageLabel, placeholder, size = 'md', autoFocus, invalid, id, name },
  ref,
) {
  const ta = useTranslations('a11y');
  const fieldId = useFieldId({ id });
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { ranked, canCreate, count } = useList({ query: value, options });

  const pick = (v: string, viaKeyboard = false) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
    if (viaKeyboard) onCommit?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (count ? (a + 1) % count : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (count ? (a - 1 + count) % count : -1));
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey && open && active >= 0 && active < count) {
      e.preventDefault();
      pick(active < ranked.length ? ranked[active].name : value.trim(), true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <P.Root open={open && count > 0} onOpenChange={setOpen}>
      <P.Anchor asChild>
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            name={name}
            role="combobox"
            aria-expanded={open && count > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setActive(e.target.value.trim() ? 0 : -1);
            }}
            onFocus={() => {
              setOpen(true);
              setActive(value.trim() ? 0 : -1);
            }}
            onBlur={() => setOpen(false)}
            // Already focused (e.g. after Escape) — focus won't fire again, a click should still reopen
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(fieldClass, size === 'lg' ? 'h-12 text-[15px]' : 'h-10', value ? 'pr-9' : '')}
          />
          {value ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={ta('clear')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[6px] p-1 text-subtle hover:bg-surface-2 hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </P.Anchor>
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => keepOpenForField(e)}
          className="z-[70] w-[var(--radix-popover-trigger-width)] rounded-[14px] border border-border bg-surface p-1.5 shadow-pop"
        >
          <OptionList
            id={listId}
            query={value}
            ranked={ranked}
            canCreate={canCreate}
            active={active}
            setActive={setActive}
            onPick={(v) => pick(v)}
            createLabel={createLabel}
            usageLabel={usageLabel}
          />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
});

export function TagInput({
  value,
  onChange,
  options,
  createLabel,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: DictItem[];
  createLabel: (v: string) => React.ReactNode;
  placeholder?: string;
}) {
  const ta = useTranslations('a11y');
  const tagFieldId = useFieldId();
  const listId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { ranked, canCreate, count } = useList({ query, options, exclude: value });

  const add = (v: string) => {
    if (!v.trim()) return;
    onChange([...value, v.trim()]);
    setQuery('');
    setActive(-1);
  };

  return (
    <P.Root open={open && count > 0} onOpenChange={setOpen}>
      <P.Anchor asChild>
        <div
          ref={fieldRef}
          // Clicking the padding or between chips should behave like clicking the input
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              inputRef.current?.focus();
              setOpen(true);
            }
          }}
          className={cn(fieldClass, 'flex min-h-10 cursor-text flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15')}
        >
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary">
              {t}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-primary/15" aria-label={ta('removeTag', { name: t })}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={tagFieldId}
            role="combobox"
            aria-expanded={open && count > 0}
            aria-controls={listId}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            value={query}
            placeholder={value.length ? '' : placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(e.target.value.trim() ? 0 : -1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => (count ? (a + 1) % count : -1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => (count ? (a - 1 + count) % count : -1));
              } else if ((e.key === 'Enter' || e.key === ',') && query.trim() && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                add(active >= 0 && active < ranked.length ? ranked[active].name : query);
              } else if (e.key === 'Backspace' && !query && value.length) {
                onChange(value.slice(0, -1));
              } else if (e.key === 'Escape' && open) {
                e.stopPropagation();
                setOpen(false);
              }
            }}
            className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
          />
        </div>
      </P.Anchor>
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => keepOpenForField(e, fieldRef.current)}
          className="z-[70] w-[var(--radix-popover-trigger-width)] rounded-[14px] border border-border bg-surface p-1.5 shadow-pop"
        >
          <OptionList id={listId} query={query} ranked={ranked} canCreate={canCreate} active={active} setActive={setActive} onPick={add} createLabel={createLabel} />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
