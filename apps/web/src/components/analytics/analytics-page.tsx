'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { SegmentRowDto } from '@heyreply/shared';
import { Card, CardHeader, MicroLabel, Skeleton } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { SalaryHistogram, SalaryRateBars, SegmentBars, SegmentTable } from '@/components/charts/charts';
import { PeriodSwitch, usePeriod } from '@/components/dashboard/period';
import { Link } from '@/i18n/navigation';
import { useFormat } from '@/lib/format';
import { useByLocation, useSalary, useSegment } from '@/lib/queries';

export type SegmentKind = 'sources' | 'positions' | 'locations' | 'salary';

function Lead({ rows, noneLabel }: { rows?: SegmentRowDto[]; noneLabel: string }) {
  const t = useTranslations('analytics');
  const f = useFormat();
  if (!rows) return <Skeleton className="h-16 w-full max-w-2xl" />;
  const ok = rows.filter((r) => !r.lowSample && r.key !== '__none');
  if (ok.length < 1) return <p className="max-w-2xl text-lg text-muted">{t('noBest')}</p>;
  const best = [...ok].sort((a, b) => b.interviewRate - a.interviewRate)[0];
  const label = best.key === '__none' ? noneLabel : best.label;
  return (
    <p className="max-w-3xl font-display text-[clamp(22px,2.6vw,34px)] leading-[1.2] font-medium tracking-[-0.02em]">
      {t('bestLine', { label, rate: f.num(best.interviewRate) })}
    </p>
  );
}

function SegmentSection({ rows, loading, title }: { rows?: SegmentRowDto[]; loading: boolean; title?: string }) {
  const t = useTranslations('analytics');
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr] xl:gap-6">
      <Card>
        <CardHeader title={title ?? t('applications')} subtitle={`${t('applications')} · ${t('interviews')} · ${t('offers')}`} />
        <div className="p-5">{loading || !rows ? <Skeleton className="h-64 w-full" /> : <SegmentBars rows={rows} noneLabel={t('none')} />}</div>
      </Card>
      <Card>
        <div className="p-5">{loading || !rows ? <Skeleton className="h-64 w-full" /> : <SegmentTable rows={rows} noneLabel={t('none')} />}</div>
      </Card>
    </div>
  );
}

function SourcesView() {
  const { period } = usePeriod();
  const t = useTranslations('analytics');
  const q = useSegment('by-source', period);
  return (
    <>
      <Lead rows={q.data} noneLabel={t('none')} />
      <SegmentSection rows={q.data} loading={q.isLoading} title={t('sourcesTitle')} />
    </>
  );
}

function PositionsView() {
  const { period } = usePeriod();
  const t = useTranslations('analytics');
  const q = useSegment('by-position', period);
  return (
    <>
      <Lead rows={q.data} noneLabel={t('none')} />
      <SegmentSection rows={q.data} loading={q.isLoading} title={t('positionsTitle')} />
      <p className="text-sm text-muted">
        <Link href="/dictionaries?type=positions" className="text-primary hover:underline">
          {t('groupHint')} →
        </Link>
      </p>
    </>
  );
}

function LocationsView() {
  const { period } = usePeriod();
  const t = useTranslations('analytics');
  const tf = useTranslations('format');
  const f = useFormat();
  const q = useByLocation(period);
  const formats = q.data?.formats.map((r) => ({ ...r, label: r.key === '__none' ? r.label : tf(r.key as 'REMOTE') }));
  const total = (formats ?? []).reduce((s, r) => s + r.total, 0) || 1;
  return (
    <>
      <Lead rows={q.data?.locations} noneLabel={t('none')} />
      <Card className="p-5">
        <MicroLabel>{t('formats')}</MicroLabel>
        {formats ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {formats
              .filter((r) => r.key !== '__none')
              .map((r) => (
                <div key={r.key} className="rounded-[14px] bg-surface-2/70 p-4">
                  <p className="text-sm text-muted">{r.label}</p>
                  <p className="mt-1 font-display text-3xl font-medium tracking-tight tabular">{Math.round((r.total / total) * 100)}%</p>
                  <p className="mt-2 text-xs text-muted tabular">
                    {t('interviewRate')} <span className="font-medium text-text">{r.lowSample ? '—' : f.pct(r.interviewRate)}</span> · {r.total}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <Skeleton className="mt-4 h-24 w-full" />
        )}
      </Card>
      <SegmentSection rows={q.data?.locations} loading={q.isLoading} title={t('locationsTitle')} />
    </>
  );
}

function SalaryView() {
  const { period } = usePeriod();
  const t = useTranslations('analytics');
  const f = useFormat();
  const [currency, setCurrency] = useState<string | undefined>();
  const q = useSalary({ ...period, currency });
  const d = q.data;
  const good = d?.buckets.filter((b) => !b.lowSample) ?? [];
  const best = good.length ? [...good].sort((a, b) => b.interviewRate - a.interviewRate)[0] : null;
  return (
    <>
      {d && best ? (
        <p className="max-w-3xl font-display text-[clamp(22px,2.6vw,34px)] leading-[1.2] font-medium tracking-[-0.02em]">
          {t('salaryBest', { range: `${f.compactMoney(best.from, d.currency)}–${f.compactMoney(best.to, null)}`, rate: f.pct(best.interviewRate) })}
        </p>
      ) : d ? (
        <p className="max-w-2xl text-lg text-muted">{t('noBest')}</p>
      ) : (
        <Skeleton className="h-12 w-96" />
      )}
      {d && d.currencies.length > 1 ? (
        <Segmented value={d.currency} onChange={(v) => v && setCurrency(v)} options={d.currencies.map((c) => ({ value: c, label: c }))} ariaLabel={t('currency')} className="self-start" />
      ) : null}
      {d && !d.buckets.length ? (
        <Card className="p-10 text-center text-muted">{t('noSalaryData')}</Card>
      ) : (
        <>
          {d?.quartiles ? (
            <Card className="p-5">
              <MicroLabel>{t('spread')}</MicroLabel>
              <div className="mt-5">
                <div className="relative h-10">
                  {(() => {
                    const { min, q1, median, q3, max } = d.quartiles!;
                    const span = max - min || 1;
                    const pos = (v: number) => `${((v - min) / span) * 100}%`;
                    return (
                      <>
                        <div className="absolute top-1/2 h-px w-full bg-border-strong" />
                        <div className="absolute top-1 bottom-1 rounded-[8px] bg-primary-soft ring-1 ring-primary/30" style={{ left: pos(q1), width: `calc(${pos(q3)} - ${pos(q1)})` }} />
                        <div className="absolute top-0 bottom-0 w-[3px] rounded-full bg-primary" style={{ left: pos(median) }} />
                      </>
                    );
                  })()}
                </div>
                <div className="mt-4 grid grid-cols-5 gap-3 text-center">
                  {(['min', 'q1', 'median', 'q3', 'max'] as const).map((k) => (
                    <div key={k}>
                      <p className="text-[11px] text-subtle">{t(k)}</p>
                      <p className={k === 'median' ? 'text-sm font-semibold text-primary tabular' : 'text-sm tabular'}>{f.compactMoney(d.quartiles![k], d.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-2 xl:gap-6">
            <Card>
              <CardHeader title={t('distribution')} subtitle={t('distributionSubtitle')} />
              <div className="p-5">{d ? <SalaryHistogram buckets={d.buckets} currency={d.currency} /> : <Skeleton className="h-64 w-full" />}</div>
            </Card>
            <Card>
              <CardHeader title={t('rateByBucket')} subtitle={t('rateByBucketSubtitle')} />
              <div className="p-5">{d ? <SalaryRateBars buckets={d.buckets} currency={d.currency} /> : <Skeleton className="h-52 w-full" />}</div>
            </Card>
          </div>
          {d?.offers.length ? (
            <Card>
              <CardHeader title={t('offersVsRange')} />
              <div className="scrollbar-thin overflow-x-auto p-5">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-subtle">
                      <th className="py-2 font-medium">{t('name')}</th>
                      <th className="py-2 text-right font-medium">{t('range')}</th>
                      <th className="py-2 text-right font-medium">{t('offer')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.offers.map((o, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5">
                          <span className="font-medium">{o.company}</span> <span className="text-muted">· {o.position}</span>
                        </td>
                        <td className="py-2.5 text-right text-muted tabular">{f.salary(o.salaryFrom, o.salaryTo, d.currency)}</td>
                        <td className="py-2.5 text-right font-medium text-accent tabular">{f.money(o.offerAmount, d.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

export function AnalyticsPage({ segment }: { segment: SegmentKind }) {
  const t = useTranslations('analytics');
  const title = { sources: t('sourcesTitle'), positions: t('positionsTitle'), locations: t('locationsTitle'), salary: t('salaryTitle') }[segment];
  const lead = { sources: t('sourcesLead'), positions: t('positionsLead'), locations: t('locationsLead'), salary: t('salaryLead') }[segment];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {t('title')} · {lead}
          </p>
          <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[34px]">{title}</h1>
        </div>
        <PeriodSwitch />
      </div>
      {segment === 'sources' ? <SourcesView /> : segment === 'positions' ? <PositionsView /> : segment === 'locations' ? <LocationsView /> : <SalaryView />}
    </div>
  );
}
