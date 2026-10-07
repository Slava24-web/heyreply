'use client';
import { ArrowDownRight, ArrowUpRight, CalendarClock, Hourglass, Lightbulb, Plus, RefreshCw } from 'lucide-react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { animate, useMotionValue, useTransform, motion } from 'motion/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { InsightDto, SummaryDto } from '@heyreply/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, MicroLabel, Skeleton } from '@/components/ui/card';
import { FunnelBars, Heatmap, StatusBars, TimelineChart } from '@/components/charts/charts';
import { CompanyAvatar } from '@/components/applications/company-avatar';
import { StatusBadge } from '@/components/applications/status-badge';
import { useUIActions } from '@/components/shell/ui-context';
import { numberFormat, useFormat } from '@/lib/format';
import { qk, useAttention, useBulk, useFunnel, useHeatmap, useInsights, useMe, useSummary, useTimeline } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { useMounted } from '@/lib/use-mounted';
import { PeriodSwitch, usePeriod } from './period';

function Counter({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const { tag } = useFormat();
  const mv = useMotionValue(0);
  // Runs on every animation frame: the formatter must not be rebuilt each time
  const text = useTransform(mv, (v) => `${(numberFormat(tag, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) ?? numberFormat(tag))!.format(v)}${suffix}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className="tabular">{text}</motion.span>;
}

function Delta({ cur, prev, invert, unit = 'pp' }: { cur: number; prev: number | undefined; invert?: boolean; unit?: 'pp' | 'n' }) {
  const t = useTranslations('period');
  const locale = useLocale();
  const f = useFormat();
  if (prev == null) return null;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return <span className="text-xs text-subtle">± 0</span>;
  const good = invert ? d < 0 : d > 0;
  const Icon = d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-primary' : 'text-accent')} title={t('vsPrev')}>
      <Icon className="size-3.5" />
      {d > 0 ? '+' : ''}
      {f.num(d)}
      {unit === 'pp' ? (locale === 'ru' ? ' п. п.' : ' pp') : ''}
    </span>
  );
}

function Kpi({ label, value, decimals, suffix, delta, loading }: { label: string; value: number | null; decimals?: number; suffix?: string; delta?: React.ReactNode; loading?: boolean }) {
  return (
    <Card className="flex flex-col justify-between gap-3 p-5">
      <MicroLabel>{label}</MicroLabel>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="flex items-end justify-between gap-2">
          <span className="font-display text-[32px] leading-none font-medium tracking-[-0.03em]">{value == null ? '—' : <Counter value={value} decimals={decimals} suffix={suffix} />}</span>
          {delta}
        </div>
      )}
    </Card>
  );
}

function Hero({ s, loading }: { s?: SummaryDto; loading: boolean }) {
  const t = useTranslations('dashboard');
  const f = useFormat();
  return (
    <section className="hero-gradient relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-panel border border-border p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <MicroLabel>{t('interviewRate')}</MicroLabel>
        {s?.previous ? <Delta cur={s.interviewRate} prev={s.previous.interviewRate} /> : null}
      </div>
      <div>
        {loading || !s ? (
          <Skeleton className="h-24 w-56" />
        ) : (
          <p className="font-display text-[clamp(72px,9vw,128px)] leading-[0.9] font-medium tracking-[-0.05em] text-text">
            <Counter value={s.interviewRate} decimals={1} />
            <span className="text-[0.45em] text-muted">%</span>
          </p>
        )}
        <p className="mt-3 text-[15px] text-muted">{s ? t('heroCaption', { total: f.num(s.total) }) : ' '}</p>
      </div>
      {/* Second-read: a quiet vertical rail with the three supporting rates */}
      {s ? (
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-text/10 pt-5">
          {[
            { l: t('responseRate'), v: s.responseRate },
            { l: t('offerRate'), v: s.offerRate },
            { l: t('ghostingRate'), v: s.ghostingRate },
          ].map((x) => (
            <div key={x.l}>
              <p className="font-display text-xl tabular">{f.pct(x.v)}</p>
              <p className="mt-0.5 text-xs text-muted">{x.l}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function insightText(i: InsightDto, t: ReturnType<typeof useTranslations<'insights'>>, tf: ReturnType<typeof useTranslations<'format'>>, f: ReturnType<typeof useFormat>) {
  const p = i.params;
  switch (i.kind) {
    case 'source':
      return { big: `${f.num(Number(p.ratio))}×`, text: t('source', { best: p.best, worst: p.worst, ratio: f.num(Number(p.ratio)) }) };
    case 'salary':
      return {
        big: f.pct(Number(p.rate)),
        text: t('salary', { from: f.compactMoney(Number(p.from), String(p.currency)), to: f.compactMoney(Number(p.to), null), rate: f.num(Number(p.rate)), other: f.num(Number(p.other)) }),
      };
    case 'coverLetter': {
      const d = Number(p.diff);
      return { big: `${d > 0 ? '+' : '−'}${f.num(Math.abs(d))}`, text: d > 0 ? t('coverLetterPos', { diff: f.num(d) }) : t('coverLetterNeg', { diff: f.num(Math.abs(d)) }) };
    }
    case 'format':
      return { big: f.pct(Number(p.rate)), text: t('format', { format: tf(String(p.format) as 'REMOTE'), rate: f.num(Number(p.rate)) }) };
    case 'ghosting':
      return { big: String(p.count), text: t('ghosting', { count: Number(p.count), days: p.days }) };
  }
}

function Insights({ period }: { period: { from?: string } }) {
  const t = useTranslations('dashboard');
  const ti = useTranslations('insights');
  const tf = useTranslations('format');
  const f = useFormat();
  const { data, isLoading } = useInsights(period);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="size-4 text-accent" />
        <h3 className="text-[15px] font-semibold">{t('insights')}</h3>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !data?.length ? (
        <p className="text-sm text-muted">{t('insightsEmpty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((i, idx) => {
            const x = insightText(i, ti, tf, f);
            return (
              <div key={idx} className="rounded-[14px] bg-surface-2/70 p-4 animate-fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
                <p className="font-display text-2xl font-medium tracking-tight text-primary tabular">{x.big}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-text">{x.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Attention() {
  const t = useTranslations('dashboard');
  const tl = useTranslations('list');
  const f = useFormat();
  const { openApp } = useUIActions();
  const { data, isLoading } = useAttention();
  const bulk = useBulk();
  if (isLoading) return <Skeleton className="h-64 w-full rounded-card" />;
  const empty = !data?.upcoming.length && !data?.waiting.length;
  return (
    <Card className="flex flex-col p-5">
      <h3 className="mb-4 text-[15px] font-semibold">{t('attention')}</h3>
      {empty ? <p className="text-sm text-muted">{t('nothingUrgent')}</p> : null}
      {data?.upcoming.length ? (
        <div className="mb-5">
          <MicroLabel className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" /> {t('upcoming')}
          </MicroLabel>
          <ul className="mt-2 flex flex-col">
            {data.upcoming.map((a) => (
              <li key={a.id}>
                <button onClick={() => openApp(a.id)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-surface-2">
                  <CompanyAvatar name={a.company.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.company.name}</span>
                    <span className="block truncate text-xs text-muted">{a.position.name}</span>
                  </span>
                  <span className="text-right">
                    <StatusBadge status={a.status} size="sm" />
                    <span className="mt-1 block text-[11px] text-subtle tabular">{f.dateTime(a.nextStepAt!)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data?.waiting.length ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <MicroLabel className="flex items-center gap-1.5">
              <Hourglass className="size-3.5" /> {t('waiting', { days: data.ghostingDays })} · {data.waiting.length}
            </MicroLabel>
          </div>
          <ul className="mt-2 flex flex-col">
            {data.waiting.slice(0, 4).map((a) => (
              <li key={a.id}>
                <button onClick={() => openApp(a.id)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-surface-2">
                  <CompanyAvatar name={a.company.name} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{a.company.name}</span> <span className="text-muted">· {a.position.name}</span>
                  </span>
                  <span className="text-xs font-medium text-accent tabular">{tl('daysShort', { count: a.daysWaiting ?? 0 })}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="soft"
            size="sm"
            className="mt-3 w-full"
            disabled={bulk.isPending}
            onClick={async () => {
              const r = await bulk.mutateAsync({ ids: data.waiting.map((a) => a.id), action: 'status', status: 'NO_RESPONSE' });
              toast.success(t('markedNoResponse', { count: r.affected }));
            }}
          >
            {t('markNoResponse')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Re-reads applications and analytics in place — picks up applications the browser extension added meanwhile. */
function RefreshButton() {
  const t = useTranslations('dashboard');
  const qc = useQueryClient();
  const fetching = useIsFetching({ predicate: (q) => q.queryKey[0] === qk.apps[0] || q.queryKey[0] === qk.analytics[0] }) > 0;
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={t('refresh')}
      title={t('refresh')}
      disabled={fetching}
      onClick={() => {
        qc.invalidateQueries({ queryKey: qk.apps });
        qc.invalidateQueries({ queryKey: qk.analytics });
      }}
    >
      <RefreshCw className={cn(fetching && 'animate-spin')} />
    </Button>
  );
}

export function Dashboard() {
  const t = useTranslations('dashboard');
  const tl = useTranslations('list');
  const locale = useLocale();
  const mounted = useMounted();
  const { period } = usePeriod();
  const { data: me } = useMe();
  const { openQuickAdd } = useUIActions();
  const summary = useSummary(period);
  const funnel = useFunnel(period);
  const timeline = useTimeline(period);
  const heatmap = useHeatmap();
  const s = summary.data;
  const prev = s?.previous ?? undefined;

  const hasAny = (heatmap.data?.length ?? 0) > 0 || (s?.total ?? 0) > 0;
  if (!summary.isLoading && !heatmap.isLoading && !hasAny) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-[34px] font-medium tracking-[-0.02em]">{mounted && me ? t('greeting', { name: me.name.split(' ')[0] }) : t('title')}</h1>
        <div className="hero-gradient flex flex-col items-start rounded-panel border border-border p-8 md:p-14">
          <h2 className="max-w-xl font-display text-[clamp(32px,4vw,52px)] leading-[1.05] font-medium tracking-[-0.03em]">{t('emptyTitle')}</h2>
          <p className="mt-4 max-w-md text-muted">{t('emptyText')}</p>
          <Button size="lg" className="mt-8" onClick={() => openQuickAdd()}>
            <Plus /> {tl('emptyCta')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{t('title')}</p>
          <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[34px]">{me ? t('greeting', { name: me.name.split(' ')[0] }) : ' '}</h1>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <PeriodSwitch />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <Hero s={s} loading={summary.isLoading} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Kpi label={t('total')} value={s?.total ?? null} loading={summary.isLoading} delta={prev ? <Delta cur={s!.total} prev={prev.total} unit="n" /> : null} />
          <Kpi label={t('active')} value={s?.active ?? null} loading={summary.isLoading} />
          <Kpi
            label={t('medianResponse')}
            value={s?.medianResponseDays ?? null}
            decimals={s?.medianResponseDays && s.medianResponseDays % 1 ? 1 : 0}
            suffix={locale === 'en' ? ' d' : ' дн.'}
            loading={summary.isLoading}
            delta={prev && s?.medianResponseDays != null && prev.medianResponseDays != null ? <Delta cur={s.medianResponseDays} prev={prev.medianResponseDays} invert unit="n" /> : null}
          />
          <Kpi label={t('rejectionRate')} value={s?.rejectionRate ?? null} decimals={1} suffix="%" loading={summary.isLoading} />
        </div>
      </div>

      <Card>
        <CardHeader title={t('funnel')} subtitle={t('funnelSubtitle')} />
        <div className="p-5">{funnel.data ? <FunnelBars stages={funnel.data.stages} /> : <Skeleton className="h-52 w-full" />}</div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title={t('dynamics')} subtitle={t('dynamicsSubtitle')} />
          <div className="p-5">{timeline.data ? <TimelineChart data={timeline.data} /> : <Skeleton className="h-60 w-full" />}</div>
        </Card>
        <Card>
          <CardHeader title={t('statuses')} />
          <div className="p-5">{funnel.data ? <StatusBars data={funnel.data.statuses} /> : <Skeleton className="h-60 w-full" />}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-4 lg:col-span-2 lg:gap-6">
          <Card>
            <CardHeader title={t('activity')} subtitle={t('activitySubtitle')} />
            <div className="p-5">{heatmap.data ? <Heatmap data={heatmap.data} /> : <Skeleton className="h-32 w-full" />}</div>
          </Card>
          <Insights period={period} />
        </div>
        <Attention />
      </div>
    </div>
  );
}
