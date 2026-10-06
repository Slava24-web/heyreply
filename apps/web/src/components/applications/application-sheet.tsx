'use client';
import { Check, Copy, ExternalLink, Loader2, Plug, Trash2, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CURRENCIES,
  REJECTION_REASONS,
  IMPORT_PLATFORMS,
  isSafeHttpUrl,
  platformSourceName,
  type ImportPlatform,
  STATUS_STAGE,
  type ApplicationDto,
  type AppStatus,
  type UpdateApplicationInput,
} from '@heyreply/shared';
import { Button } from '@/components/ui/button';
import { Combobox, TagInput } from '@/components/ui/combobox';
import { Checkbox, Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/card';
import { useUI } from '@/components/shell/ui-context';
import { useErrorText } from '@/lib/errors';
import { useFormat } from '@/lib/format';
import { useApplication, useChangeStatus, useDeleteApplication, useDictionary, useRestoreApplication, useUpdateApplication } from '@/lib/queries';
import { STAGE_LABEL_KEYS, STATUS_META } from '@/lib/status';
import { cn } from '@/lib/utils';
import { CompanyAvatar } from './company-avatar';
import { StatusBadge, StatusPicker } from './status-badge';

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const toDateTimeInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Stepper({ app }: { app: ApplicationDto }) {
  const t = useTranslations('stage');
  const failed = STATUS_STAGE[app.status] === 0;
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Funnel">
      {STAGE_LABEL_KEYS.map((k, i) => {
        const reached = app.maxStage >= i + 1;
        const isLast = reached && app.maxStage === i + 1;
        return (
          <li key={k} className="flex flex-col gap-1.5">
            <span
              className={cn('h-1.5 rounded-full transition-colors', reached ? '' : 'bg-surface-3')}
              style={reached ? { background: i === 4 ? 'var(--accent)' : 'var(--primary)', opacity: failed && isLast ? 0.45 : 1 } : undefined}
            />
            <span className={cn('truncate text-[11px]', reached ? 'font-medium text-text' : 'text-subtle')}>{t(k)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusChangePanel({ app, next, onDone }: { app: ApplicationDto; next: AppStatus; onDone: () => void }) {
  const t = useTranslations('detail');
  const ts = useTranslations('status');
  const tr = useTranslations('rejection');
  const tc = useTranslations('common');
  const te = useErrorText();
  const change = useChangeStatus();
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [offer, setOffer] = useState(app.offerAmount ? String(app.offerAmount) : '');

  const save = async () => {
    try {
      const isToday = date === new Date().toISOString().slice(0, 10);
      await change.mutateAsync({
        id: app.id,
        status: next,
        changedAt: isToday ? undefined : new Date(`${date}T12:00:00`),
        comment: comment || null,
        ...(next === 'REJECTED' && reason ? { rejectionReason: reason } : {}),
        ...((next === 'INTERVIEW' || next === 'FINAL_INTERVIEW' || next === 'SCREENING' || next === 'TEST_TASK') && nextStep
          ? { nextStepAt: new Date(nextStep) }
          : {}),
        ...((next === 'OFFER' || next === 'ACCEPTED') && offer ? { offerAmount: Number(offer) } : {}),
      });
      toast.success(t('statusChanged', { status: ts(next) }));
      onDone();
    } catch (e) {
      toast.error(te(e));
    }
  };

  return (
    <div className="mt-4 rounded-card border border-border bg-surface-2/60 p-4 animate-fade-up">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <StatusBadge status={app.status} size="sm" />
        <span className="text-subtle">→</span>
        <StatusBadge status={next} size="sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('eventDate')}>
          <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {next === 'REJECTED' ? (
          <Field label={t('rejectionReason')}>
            <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">—</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        {['SCREENING', 'TEST_TASK', 'INTERVIEW', 'FINAL_INTERVIEW'].includes(next) ? (
          <Field label={t('nextStep')}>
            <Input type="datetime-local" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
          </Field>
        ) : null}
        {next === 'OFFER' || next === 'ACCEPTED' ? (
          <Field label={t('offerAmount')}>
            <Input inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value.replace(/\D/g, ''))} className="tabular" />
          </Field>
        ) : null}
      </div>
      <Field label={t('statusComment')} className="mt-3">
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('statusCommentPlaceholder')} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {tc('cancel')}
        </Button>
        <Button size="sm" onClick={save} disabled={change.isPending}>
          {tc('save')}
        </Button>
      </div>
    </div>
  );
}

function DetailsForm({ app, onSaving }: { app: ApplicationDto; onSaving: (s: 'idle' | 'saving' | 'saved') => void }) {
  const tq = useTranslations('quickAdd');
  const tf = useTranslations('format');
  const tc = useTranslations('common');
  const td = useTranslations('detail');
  const tr = useTranslations('rejection');
  const te = useErrorText();
  const update = useUpdateApplication(app.id);
  const companies = useDictionary('companies');
  const positions = useDictionary('positions');
  const sources = useDictionary('sources');
  const locations = useDictionary('locations');
  const tags = useDictionary('tags');

  const [v, setV] = useState(() => ({
    companyName: app.company.name,
    positionName: app.position.name,
    sourceName: app.source?.name ?? '',
    locationName: app.location?.name ?? '',
    vacancyUrl: app.vacancyUrl ?? '',
    salaryFrom: app.salaryFrom != null ? String(app.salaryFrom) : '',
    salaryTo: app.salaryTo != null ? String(app.salaryTo) : '',
    offerAmount: app.offerAmount != null ? String(app.offerAmount) : '',
    note: app.note ?? '',
  }));

  const latest = useRef(v);
  useEffect(() => {
    latest.current = v;
  });

  const save = async (patch: UpdateApplicationInput) => {
    onSaving('saving');
    try {
      await update.mutateAsync(patch);
      onSaving('saved');
    } catch (e) {
      onSaving('idle');
      toast.error(te(e));
    }
  };
  /** Saves a text field on blur if it changed. `build` receives the latest value. */
  const commitText = (key: keyof typeof v, build: (val: string) => UpdateApplicationInput, original: string) => {
    const val = latest.current[key];
    if (val === original) return;
    if ((key === 'companyName' || key === 'positionName') && !val.trim()) {
      setV((s) => ({ ...s, [key]: original }));
      return;
    }
    save(build(val));
  };
  const num = (s: string) => (s ? Number(s) : null);
  const createLabel = (x: string) => tc('create', { value: x });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tq('company')}>
          <div onBlur={() => commitText('companyName', (x) => ({ companyName: x }), app.company.name)}>
            <Combobox value={v.companyName} onChange={(x) => setV((s) => ({ ...s, companyName: x }))} options={companies.data ?? []} createLabel={createLabel} />
          </div>
        </Field>
        <Field label={tq('position')}>
          <div onBlur={() => commitText('positionName', (x) => ({ positionName: x }), app.position.name)}>
            <Combobox value={v.positionName} onChange={(x) => setV((s) => ({ ...s, positionName: x }))} options={positions.data ?? []} createLabel={createLabel} />
          </div>
        </Field>
      </div>
      <Field label={tq('url')}>
        <Input
          value={v.vacancyUrl}
          type="url"
          onChange={(e) => setV((s) => ({ ...s, vacancyUrl: e.target.value }))}
          onBlur={() => commitText('vacancyUrl', (x) => ({ vacancyUrl: x || null }), app.vacancyUrl ?? '')}
          placeholder="https://…"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tq('source')}>
          <div onBlur={() => commitText('sourceName', (x) => ({ sourceName: x || null }), app.source?.name ?? '')}>
            <Combobox value={v.sourceName} onChange={(x) => setV((s) => ({ ...s, sourceName: x }))} options={sources.data ?? []} createLabel={createLabel} />
          </div>
        </Field>
        <Field label={tq('location')}>
          <div onBlur={() => commitText('locationName', (x) => ({ locationName: x || null }), app.location?.name ?? '')}>
            <Combobox value={v.locationName} onChange={(x) => setV((s) => ({ ...s, locationName: x }))} options={locations.data ?? []} createLabel={createLabel} />
          </div>
        </Field>
      </div>
      <Field label={tq('workFormat')}>
        <Segmented
          allowEmpty
          value={app.workFormat}
          onChange={(x) => save({ workFormat: x })}
          options={(['OFFICE', 'HYBRID', 'REMOTE'] as const).map((x) => ({ value: x, label: tf(x) }))}
          className="w-full"
        />
      </Field>
      <Field label={tq('salary')}>
        <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
          <Input
            inputMode="numeric"
            className="tabular"
            placeholder={tq('from')}
            value={v.salaryFrom}
            onChange={(e) => setV((s) => ({ ...s, salaryFrom: e.target.value.replace(/\D/g, '') }))}
            onBlur={() => commitText('salaryFrom', (x) => ({ salaryFrom: num(x), currency: app.currency ?? undefined }), app.salaryFrom != null ? String(app.salaryFrom) : '')}
          />
          <Input
            inputMode="numeric"
            className="tabular"
            placeholder={tq('to')}
            value={v.salaryTo}
            onChange={(e) => setV((s) => ({ ...s, salaryTo: e.target.value.replace(/\D/g, '') }))}
            onBlur={() => commitText('salaryTo', (x) => ({ salaryTo: num(x) }), app.salaryTo != null ? String(app.salaryTo) : '')}
          />
          <NativeSelect value={app.currency ?? 'RUB'} onChange={(e) => save({ currency: e.target.value })}>
            {[...new Set([app.currency ?? 'RUB', ...CURRENCIES])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tq('date')}>
          <Input type="date" defaultValue={toDateInput(app.appliedAt)} onBlur={(e) => e.target.value && e.target.value !== toDateInput(app.appliedAt) && save({ appliedAt: new Date(`${e.target.value}T12:00:00`) })} />
        </Field>
        <Field label={td('nextStep')}>
          <Input
            type="datetime-local"
            defaultValue={toDateTimeInput(app.nextStepAt)}
            onBlur={(e) => e.target.value !== toDateTimeInput(app.nextStepAt) && save({ nextStepAt: e.target.value ? new Date(e.target.value) : null })}
          />
        </Field>
        <Field label={td('offerAmount')}>
          <Input
            inputMode="numeric"
            className="tabular"
            value={v.offerAmount}
            onChange={(e) => setV((s) => ({ ...s, offerAmount: e.target.value.replace(/\D/g, '') }))}
            onBlur={() => commitText('offerAmount', (x) => ({ offerAmount: num(x) }), app.offerAmount != null ? String(app.offerAmount) : '')}
          />
        </Field>
        <Field label={td('rejectionReason')}>
          <NativeSelect value={app.rejectionReason ?? ''} onChange={(e) => save({ rejectionReason: e.target.value || null })}>
            <option value="">—</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Checkbox label={tq('coverLetter')} checked={app.coverLetter} onChange={(e) => save({ coverLetter: e.target.checked })} />
      <Field label={tq('tags')}>
        <TagInput value={app.tags.map((x) => x.name)} onChange={(x) => save({ tags: x })} options={tags.data ?? []} createLabel={createLabel} placeholder={tq('tagsPlaceholder')} />
      </Field>
      <Field label={tq('note')}>
        <Textarea
          value={v.note}
          onChange={(e) => setV((s) => ({ ...s, note: e.target.value }))}
          onBlur={() => commitText('note', (x) => ({ note: x || null }), app.note ?? '')}
          placeholder={tq('notePlaceholder')}
        />
      </Field>
    </div>
  );
}

function Timeline({ app }: { app: ApplicationDto }) {
  const ts = useTranslations('status');
  const f = useFormat();
  const items = [...(app.history ?? [])].reverse();
  return (
    <ol className="relative ml-1.5 border-l border-border pl-6">
      {items.map((h, i) => {
        const Icon = STATUS_META[h.toStatus].icon;
        return (
          <li key={h.id} className={cn('relative pb-6 last:pb-0', i === 0 && 'animate-fade-up')}>
            <span
              className="absolute top-0 -left-[37px] grid size-[22px] place-items-center rounded-full ring-4 ring-surface"
              style={{ background: STATUS_META[h.toStatus].color, color: 'var(--surface)' }}
            >
              <Icon className="size-3" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{ts(h.toStatus)}</p>
              <time className="text-xs text-subtle tabular">{f.dateTime(h.changedAt)}</time>
            </div>
            {h.comment ? <p className="mt-1 text-[13px] text-muted">{h.comment}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ApplicationSheet() {
  const { appId, closeApp, openQuickAdd } = useUI();
  const locale = useLocale();
  const t = useTranslations('detail');
  const tc = useTranslations('common');
  const f = useFormat();
  const { data: app, isLoading } = useApplication(appId);
  const remove = useDeleteApplication();
  const restore = useRestoreApplication();
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [pending, setPending] = useState<AppStatus | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    // Reset per-application UI state when another application is opened
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('details');
    setPending(null);
    setSaving('idle');
  }, [appId]);
  useEffect(() => {
    if (saving !== 'saved') return;
    const id = setTimeout(() => setSaving('idle'), 1800);
    return () => clearTimeout(id);
  }, [saving]);

  const header = (
    <div className="border-b border-border px-6 pt-5 pb-5">
      <div className="flex items-start gap-4">
        {app ? <CompanyAvatar name={app.company.name} size={48} /> : <Skeleton className="size-12" />}
        <div className="min-w-0 flex-1">
          {app ? (
            <>
              <h2 className="truncate font-display text-xl font-medium tracking-tight">{app.company.name}</h2>
              <p className="truncate text-[15px] text-muted">{app.position.name}</p>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1 text-xs text-subtle transition-opacity', saving === 'idle' && 'opacity-0')} aria-live="polite">
            {saving === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-primary" />}
            {saving === 'saving' ? tc('saving') : tc('saved')}
          </span>
          <Dialog.Close className="rounded-[8px] p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={tc('close')}>
            <X className="size-4" />
          </Dialog.Close>
        </div>
      </div>
      {app ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusPicker value={app.status} onChange={setPending}>
              <button className="rounded-full focus-visible:outline-2" aria-label={t('changeStatus')}>
                <StatusBadge status={app.status} size="lg" withChevron />
              </button>
            </StatusPicker>
            <span className="text-[13px] text-muted">{t('appliedOn', { date: f.date(app.appliedAt) })}</span>
            {app.externalSource && (IMPORT_PLATFORMS as readonly string[]).includes(app.externalSource) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted" title={t('importedHint')}>
                <Plug className="size-3" /> {t('importedFrom', { source: platformSourceName(app.externalSource as ImportPlatform, locale) })}
              </span>
            ) : null}
            {app.salaryFrom != null || app.salaryTo != null ? (
              <span className="text-[13px] font-medium tabular">{f.salary(app.salaryFrom, app.salaryTo, app.currency)}</span>
            ) : null}
          </div>
          {pending ? <StatusChangePanel key={pending} app={app} next={pending} onDone={() => setPending(null)} /> : null}
          <div className="mt-5">
            <Stepper app={app} />
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <>
      <Sheet
        open={!!appId}
        onOpenChange={(o) => !o && closeApp()}
        title={app ? `${app.company.name} — ${app.position.name}` : tc('loading')}
        width={580}
        header={header}
        footer={
          app ? (
            <div className="flex flex-wrap items-center gap-2">
              {isSafeHttpUrl(app.vacancyUrl) ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={app.vacancyUrl} target="_blank" rel="noreferrer noopener">
                    <ExternalLink /> {t('openVacancy')}
                  </a>
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  closeApp();
                  openQuickAdd({
                    companyName: app.company.name,
                    positionName: app.position.name,
                    sourceName: app.source?.name,
                    locationName: app.location?.name,
                    workFormat: app.workFormat,
                    salaryFrom: app.salaryFrom,
                    salaryTo: app.salaryTo,
                    currency: app.currency,
                    coverLetter: app.coverLetter,
                    tags: app.tags.map((x) => x.name),
                  });
                }}
              >
                <Copy /> {t('duplicate')}
              </Button>
              <Button variant="ghost" size="sm" className="ml-auto text-danger hover:bg-accent-soft" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> {t('delete')}
              </Button>
            </div>
          ) : null
        }
      >
        {isLoading || !app ? (
          <div className="flex flex-col gap-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="px-6 py-5">
            <Segmented
              value={tab}
              onChange={(x) => x && setTab(x)}
              options={[
                { value: 'details', label: t('details') },
                { value: 'history', label: `${t('history')} · ${app.history?.length ?? 0}` },
              ]}
              className="mb-5"
            />
            {tab === 'details' ? <DetailsForm key={app.id} app={app} onSaving={setSaving} /> : <Timeline app={app} />}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteConfirm')}
        description={t('deleteText')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        onConfirm={() => {
          if (!app) return;
          const id = app.id;
          remove.mutate(id, {
            onSuccess: () =>
              toast(t('delete'), {
                action: { label: tc('restore'), onClick: () => restore.mutate(id) },
              }),
          });
          closeApp();
        }}
      />
    </>
  );
}
