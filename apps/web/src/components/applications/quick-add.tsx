'use client';
import { AlertCircle, ChevronDown, FileClock, History, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  APP_STATUSES,
  CURRENCIES,
  detectSourceByUrl,
  type ApplicationDto,
  type AppStatus,
  type CreateApplicationInput,
  type SalaryType,
  type WorkFormat,
} from '@heyreply/shared';
import { Button } from '@/components/ui/button';
import { Combobox, TagInput } from '@/components/ui/combobox';
import { Checkbox, Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { useUI } from '@/components/shell/ui-context';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import { useFormat } from '@/lib/format';
import { useCreateApplication, useDeleteApplication, useDictionary, useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

const DRAFT_KEY = 'heyreply.quickAddDraft';
/** Older unsaved drafts are not worth offering back. */
const DRAFT_MAX_AGE_MS = 7 * 86_400_000;

type StoredDraft = FormState & { savedAt?: number };

function readDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredDraft;
    if (!d.companyName && !d.positionName) return null;
    if (!d.savedAt || Date.now() - d.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

interface FormState {
  companyName: string;
  positionName: string;
  vacancyUrl: string;
  sourceName: string;
  locationName: string;
  workFormat: WorkFormat | null;
  salaryFrom: string;
  salaryTo: string;
  currency: string;
  salaryType: SalaryType;
  date: string;
  status: AppStatus;
  coverLetter: boolean;
  note: string;
  tags: string[];
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const yesterday = () => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function empty(currency: string, salaryType: SalaryType): FormState {
  return {
    companyName: '',
    positionName: '',
    vacancyUrl: '',
    sourceName: '',
    locationName: '',
    workFormat: null,
    salaryFrom: '',
    salaryTo: '',
    currency,
    salaryType,
    date: today(),
    status: 'APPLIED',
    coverLetter: false,
    note: '',
    tags: [],
  };
}

const digits = (s: string) => s.replace(/\D/g, '');
const groupDigits = (s: string, tag: string) => (s ? new Intl.NumberFormat(tag).format(Number(s)) : '');

function fromDto(a: ApplicationDto, keepCompany: boolean, base: FormState): FormState {
  return {
    ...base,
    companyName: keepCompany ? a.company.name : '',
    positionName: a.position.name,
    sourceName: a.source?.name ?? '',
    locationName: a.location?.name ?? '',
    workFormat: a.workFormat,
    salaryFrom: a.salaryFrom != null ? String(a.salaryFrom) : '',
    salaryTo: a.salaryTo != null ? String(a.salaryTo) : '',
    currency: a.currency ?? base.currency,
    salaryType: a.salaryType ?? base.salaryType,
    coverLetter: a.coverLetter,
    tags: a.tags.map((t) => t.name),
  };
}

export function QuickAddSheet() {
  const t = useTranslations('quickAdd');
  const tc = useTranslations('common');
  const ts = useTranslations('status');
  const tf = useTranslations('format');
  const te = useErrorText();
  const f = useFormat();
  const locale = useLocale();
  const { quickAddOpen, closeQuickAdd, quickAddPrefill, openApp } = useUI();
  const { data: me } = useMe();
  const currencyDefault = me?.defaultCurrency ?? 'RUB';
  const typeDefault = me?.defaultSalaryType ?? 'GROSS';

  const companies = useDictionary('companies');
  const positions = useDictionary('positions');
  const sources = useDictionary('sources');
  const locations = useDictionary('locations');
  const tags = useDictionary('tags');
  const create = useCreateApplication();
  const remove = useDeleteApplication();

  const [form, setForm] = useState<FormState>(() => empty(currencyDefault, typeDefault));
  const [errors, setErrors] = useState<{ companyName?: boolean; positionName?: boolean; salary?: boolean; url?: boolean }>({});
  const [autoSource, setAutoSource] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<ApplicationDto | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  /** An unsaved draft from an earlier session: offered, never applied silently. */
  const [draftOffer, setDraftOffer] = useState<StoredDraft | null>(null);

  const companyRef = useRef<HTMLInputElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));
  const dirty = !!(form.companyName || form.positionName || form.vacancyUrl || form.note);

  // Initialize on open: always a fresh form (or the explicit prefill); a leftover draft is only offered
  useEffect(() => {
    if (!quickAddOpen) return;
    const base = empty(currencyDefault, typeDefault);
    if (quickAddPrefill) {
      // Form is (re)initialized each time the sheet opens
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        ...base,
        companyName: quickAddPrefill.companyName ?? '',
        positionName: quickAddPrefill.positionName ?? '',
        sourceName: quickAddPrefill.sourceName ?? '',
        locationName: quickAddPrefill.locationName ?? '',
        workFormat: quickAddPrefill.workFormat ?? null,
        vacancyUrl: quickAddPrefill.vacancyUrl ?? '',
        salaryFrom: quickAddPrefill.salaryFrom != null ? String(quickAddPrefill.salaryFrom) : '',
        salaryTo: quickAddPrefill.salaryTo != null ? String(quickAddPrefill.salaryTo) : '',
        currency: quickAddPrefill.currency ?? base.currency,
        coverLetter: quickAddPrefill.coverLetter ?? false,
        tags: quickAddPrefill.tags ?? [],
      });
    } else {
      setForm(base);
    }
    setDraftOffer(quickAddPrefill ? null : readDraft());
    setErrors({});
    setDuplicate(null);
    setAutoSource(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAddOpen]);

  // Draft autosave: only what the user actually typed. Typing a new application replaces an offered old draft.
  useEffect(() => {
    if (!quickAddOpen || !dirty) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, savedAt: Date.now() }));
      } catch {}
      setDraftOffer(null);
    }, 300);
    return () => clearTimeout(id);
  }, [form, dirty, quickAddOpen]);

  const restoreDraft = () => {
    if (!draftOffer) return;
    const draft: Partial<StoredDraft> = { ...draftOffer };
    delete draft.savedAt;
    setForm({ ...empty(currencyDefault, typeDefault), ...draft, date: today() });
    setDraftOffer(null);
    setTimeout(() => companyRef.current?.focus(), 0);
  };
  const discardDraft = () => {
    clearDraft();
    setDraftOffer(null);
    companyRef.current?.focus();
  };

  // Duplicate warning (non-blocking)
  useEffect(() => {
    if (!quickAddOpen || !form.companyName.trim() || !form.positionName.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDuplicate(null);
      return;
    }
    const id = setTimeout(() => {
      api<ApplicationDto[]>('/applications/duplicates', { query: { companyName: form.companyName, positionName: form.positionName } })
        .then((r) => setDuplicate(r[0] ?? null))
        .catch(() => setDuplicate(null));
    }, 400);
    return () => clearTimeout(id);
  }, [form.companyName, form.positionName, quickAddOpen]);

  const onUrlChange = (v: string) => {
    set('vacancyUrl', v);
    const detected = detectSourceByUrl(v.trim(), locale);
    if (detected && (!form.sourceName || form.sourceName === autoSource)) {
      set('sourceName', detected);
      setAutoSource(detected);
    }
  };

  const validate = () => {
    const e = {
      companyName: !form.companyName.trim(),
      positionName: !form.positionName.trim(),
      salary: !!(form.salaryFrom && form.salaryTo && Number(form.salaryFrom) > Number(form.salaryTo)),
      url: !!form.vacancyUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(form.vacancyUrl.trim()),
    };
    setErrors(e);
    if (e.companyName) companyRef.current?.focus();
    else if (e.positionName) positionRef.current?.focus();
    return !Object.values(e).some(Boolean);
  };

  const submit = useCallback(
    async (more: boolean) => {
      if (!validate() || create.isPending) return;
      const payload: CreateApplicationInput = {
        companyName: form.companyName.trim(),
        positionName: form.positionName.trim(),
        vacancyUrl: form.vacancyUrl.trim() || null,
        sourceName: form.sourceName.trim() || null,
        locationName: form.locationName.trim() || null,
        workFormat: form.workFormat,
        salaryFrom: form.salaryFrom ? Number(form.salaryFrom) : null,
        salaryTo: form.salaryTo ? Number(form.salaryTo) : null,
        currency: form.salaryFrom || form.salaryTo ? form.currency : null,
        salaryType: form.salaryFrom || form.salaryTo ? form.salaryType : null,
        appliedAt: form.date === today() ? undefined : new Date(`${form.date}T12:00:00`),
        status: form.status,
        coverLetter: form.coverLetter,
        note: form.note.trim() || null,
        tags: form.tags,
      };
      try {
        const created = await create.mutateAsync(payload);
        clearDraft();
        toast.success(t('added'), {
          description: `${created.company.name} · ${created.position.name}`,
          action: { label: tc('undo'), onClick: () => remove.mutate(created.id) },
          duration: 5000,
        });
        if (more) {
          // Serial entry: keep context fields, clear the vacancy-specific ones
          setForm((s) => ({
            ...empty(s.currency, s.salaryType),
            sourceName: s.sourceName,
            locationName: s.locationName,
            workFormat: s.workFormat,
            date: s.date,
            coverLetter: s.coverLetter,
          }));
          setDuplicate(null);
          setTimeout(() => companyRef.current?.focus(), 0);
        } else closeQuickAdd();
      } catch (e) {
        toast.error(te(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, create.isPending],
  );

  const repeatLast = async () => {
    const last = await api<ApplicationDto | null>('/applications/last').catch(() => null);
    if (!last) return;
    setForm((s) => fromDto(last, false, { ...s }));
    setTimeout(() => companyRef.current?.focus(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' && !(e.metaKey || e.ctrlKey)) return;
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      submit(false);
    } else if (e.shiftKey) {
      e.preventDefault();
      submit(true);
    } else if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox') {
      e.preventDefault();
      submit(false);
    }
  };

  const requestClose = (open: boolean) => {
    if (open) return;
    if (dirty) setConfirmClose(true);
    else closeQuickAdd();
  };

  const opts = (d: typeof companies) => d.data ?? [];
  const createLabel = (v: string) => tc('create', { value: v });
  const usageLabel = (n: number) => tc('usage', { count: n });

  return (
    <>
      <Sheet
        open={quickAddOpen}
        onOpenChange={requestClose}
        title={t('title')}
        description={t('description')}
        width={480}
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button onClick={() => submit(false)} disabled={create.isPending} className="flex-1">
                {t('save')}
              </Button>
              <Button variant="outline" onClick={() => submit(true)} disabled={create.isPending} className="flex-1">
                {t('saveAndMore')}
              </Button>
            </div>
            <p className="hidden text-center text-[11px] text-subtle md:block">{t('hints')}</p>
          </div>
        }
      >
        <form
          className="flex flex-col gap-6 px-6 py-5"
          onKeyDown={onKeyDown}
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          noValidate
        >
          {draftOffer ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-field border border-border bg-surface-2/70 px-3.5 py-3 text-[13px] animate-fade-up" role="status">
              <FileClock className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                {t('draftFound')}{' '}
                <span className="font-medium text-text">{[draftOffer.companyName, draftOffer.positionName].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="flex gap-1">
                <Button type="button" size="sm" variant="soft" onClick={restoreDraft}>
                  {t('draftRestore')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
                  {t('draftDiscard')}
                </Button>
              </span>
            </div>
          ) : null}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">{t('main')}</h3>
              <button type="button" onClick={repeatLast} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <History className="size-3.5" />
                {t('repeatLast')}
              </button>
            </div>
            <Field label={t('company')} htmlFor="qa-company" error={errors.companyName && te('required')}>
              <Combobox
                ref={companyRef}
                id="qa-company"
                size="lg"
                autoFocus
                value={form.companyName}
                onChange={(v) => set('companyName', v)}
                onCommit={() => positionRef.current?.focus()}
                options={opts(companies)}
                placeholder={t('companyPlaceholder')}
                createLabel={createLabel}
                usageLabel={usageLabel}
                invalid={errors.companyName}
              />
            </Field>
            <Field label={t('position')} htmlFor="qa-position" error={errors.positionName && te('required')}>
              <Combobox
                ref={positionRef}
                id="qa-position"
                size="lg"
                value={form.positionName}
                onChange={(v) => set('positionName', v)}
                onCommit={() => urlRef.current?.focus()}
                options={opts(positions)}
                placeholder={t('positionPlaceholder')}
                createLabel={createLabel}
                usageLabel={usageLabel}
                invalid={errors.positionName}
              />
            </Field>
            {duplicate ? (
              <div className="flex items-start gap-2.5 rounded-field border border-accent/25 bg-accent-soft px-3.5 py-3 text-[13px] text-text animate-fade-up">
                <AlertCircle className="mt-px size-4 shrink-0 text-accent" />
                <span className="flex-1">
                  {t('duplicate', { company: duplicate.company.name, when: f.relative(duplicate.appliedAt) })}
                </span>
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => openApp(duplicate.id)}>
                  {t('openDuplicate')}
                </button>
              </div>
            ) : null}
            <Field
              label={t('url')}
              htmlFor="qa-url"
              error={errors.url && te('url')}
              hint={
                autoSource && form.sourceName === autoSource ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Sparkles className="size-3" /> {t('sourceDetected', { source: autoSource })}
                  </span>
                ) : undefined
              }
            >
              <Input
                ref={urlRef}
                id="qa-url"
                type="url"
                inputMode="url"
                value={form.vacancyUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder={t('urlPlaceholder')}
                aria-invalid={errors.url}
              />
            </Field>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">{t('details')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('source')} htmlFor="qa-source">
                <Combobox
                  id="qa-source"
                  value={form.sourceName}
                  onChange={(v) => {
                    set('sourceName', v);
                    setAutoSource(null);
                  }}
                  options={opts(sources)}
                  placeholder={t('sourcePlaceholder')}
                  createLabel={createLabel}
                />
              </Field>
              <Field label={t('location')} htmlFor="qa-location">
                <Combobox
                  id="qa-location"
                  value={form.locationName}
                  onChange={(v) => set('locationName', v)}
                  options={opts(locations)}
                  placeholder={t('locationPlaceholder')}
                  createLabel={createLabel}
                />
              </Field>
            </div>
            <Field label={t('workFormat')}>
              <Segmented
                allowEmpty
                value={form.workFormat}
                onChange={(v) => set('workFormat', v)}
                options={(['OFFICE', 'HYBRID', 'REMOTE'] as const).map((v) => ({ value: v, label: tf(v) }))}
                className="w-full"
                ariaLabel={t('workFormat')}
              />
            </Field>
            <Field label={t('salary')} error={errors.salary && te('salary_range')}>
              <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
                <Input
                  inputMode="numeric"
                  placeholder={t('from')}
                  value={groupDigits(form.salaryFrom, f.tag)}
                  onChange={(e) => set('salaryFrom', digits(e.target.value).slice(0, 10))}
                  aria-label={`${t('salary')} ${t('from')}`}
                  className="tabular"
                />
                <Input
                  inputMode="numeric"
                  placeholder={t('to')}
                  value={groupDigits(form.salaryTo, f.tag)}
                  onChange={(e) => set('salaryTo', digits(e.target.value).slice(0, 10))}
                  aria-label={`${t('salary')} ${t('to')}`}
                  aria-invalid={errors.salary}
                  className="tabular"
                />
                <NativeSelect value={form.currency} onChange={(e) => set('currency', e.target.value)} aria-label={t('currency')}>
                  {[...new Set([currencyDefault, ...CURRENCIES])].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Segmented
                size="sm"
                value={form.salaryType}
                onChange={(v) => v && set('salaryType', v)}
                options={[
                  { value: 'GROSS', label: 'Gross' },
                  { value: 'NET', label: 'Net' },
                ]}
                className="mt-1 self-start"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('date')} htmlFor="qa-date">
                <Input id="qa-date" type="date" max={today()} value={form.date} onChange={(e) => set('date', e.target.value || today())} />
                <div className="flex gap-1.5">
                  {[
                    { v: today(), l: tc('today') },
                    { v: yesterday(), l: tc('yesterday') },
                  ].map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => set('date', d.v)}
                      className={cn(
                        'h-6 rounded-full px-2.5 text-[11px] font-medium transition-colors',
                        form.date === d.v ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted hover:text-text',
                      )}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('status')} htmlFor="qa-status">
                <NativeSelect id="qa-status" value={form.status} onChange={(e) => set('status', e.target.value as AppStatus)}>
                  {APP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ts(s)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Checkbox label={t('coverLetter')} checked={form.coverLetter} onChange={(e) => set('coverLetter', e.target.checked)} />
          </section>

          <section className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setNotesOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase hover:text-text"
              aria-expanded={notesOpen || !!form.note || form.tags.length > 0}
            >
              {t('notes')}
              <ChevronDown className={cn('size-3.5 transition-transform', (notesOpen || form.note || form.tags.length) && 'rotate-180')} />
            </button>
            {notesOpen || form.note || form.tags.length ? (
              <div className="flex flex-col gap-4 animate-fade-up">
                <Field label={t('tags')}>
                  <TagInput value={form.tags} onChange={(v) => set('tags', v)} options={opts(tags)} createLabel={createLabel} placeholder={t('tagsPlaceholder')} />
                </Field>
                <Field label={t('note')} htmlFor="qa-note">
                  <Textarea id="qa-note" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('notePlaceholder')} />
                </Field>
              </div>
            ) : null}
          </section>
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t('discardTitle')}
        description={t('discardText')}
        confirmLabel={t('discard')}
        cancelLabel={tc('cancel')}
        onConfirm={closeQuickAdd}
      />
    </>
  );
}
