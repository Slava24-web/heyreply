'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppStatus, FunnelStageDto, SalaryBucketDto, SegmentRowDto, TimelinePointDto } from '@heyreply/shared';
import { useFormat } from '@/lib/format';
import { STAGE_LABEL_KEYS, STATUS_META } from '@/lib/status';
import { cn } from '@/lib/utils';
import { LowSample } from '@/components/ui/card';
import { clampPage, Pagination, usePageSize } from '@/components/ui/pagination';

const axisTick = { fill: 'var(--text-subtle)', fontSize: 11 };

function TooltipBox({ title, rows }: { title: React.ReactNode; rows: { color: string; label: React.ReactNode; value: React.ReactNode }[] }) {
  return (
    <div className="min-w-40 rounded-[12px] border border-border bg-surface px-3 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-medium text-text">{title}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-full" style={{ background: r.color }} />
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-text tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.line ? <span className="h-0.5 w-3.5 rounded-full" style={{ background: i.color }} /> : <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Funnel as labeled horizontal bars: every value is printed, so no hover is needed to read it. */
export function FunnelBars({ stages }: { stages: FunnelStageDto[] }) {
  const t = useTranslations('stage');
  const f = useFormat();
  const max = Math.max(1, stages[0]?.count ?? 1);
  return (
    <div className="flex flex-col gap-3" role="list">
      {stages.map((s, i) => (
        <div key={s.stage} role="listitem" className="grid grid-cols-[88px_1fr_auto] items-center gap-3 sm:grid-cols-[112px_1fr_120px]">
          <span className="text-[13px] text-muted">{t(STAGE_LABEL_KEYS[i])}</span>
          <div className="h-9 overflow-hidden rounded-[10px] bg-surface-2" title={`${t(STAGE_LABEL_KEYS[i])}: ${s.count}`}>
            <div
              className="flex h-full min-w-9 items-center rounded-[10px] px-3 text-[13px] font-semibold text-white tabular transition-[width] duration-700 ease-out dark:text-[#1b0f20]"
              style={{
                width: `${(s.count / max) * 100}%`,
                background: i === 4 ? 'var(--accent)' : 'var(--chart-1)',
                opacity: i === 4 ? 1 : 1 - i * 0.14,
                animation: `fade-up 500ms ${i * 70}ms both`,
              }}
            >
              {f.num(s.count)}
            </div>
          </div>
          <span className="text-right">
            <span className="font-display text-[15px] tabular">{f.pct(s.fromFirst)}</span>
            {i > 0 ? <span className="hidden text-[11px] text-subtle sm:block">{f.pct(s.fromPrev)}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimelineChart({ data }: { data: TimelinePointDto[] }) {
  const t = useTranslations('dashboard');
  const f = useFormat();
  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { color: 'var(--chart-1)', label: t('applicationsSeries') },
          { color: 'var(--chart-2)', label: t('responsesSeries'), line: true },
        ]}
      />
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => f.date(v)} minTickGap={24} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={f.date(label as string)}
                    rows={[
                      { color: 'var(--chart-1)', label: t('applicationsSeries'), value: payload.find((p) => p.dataKey === 'applications')?.value as number },
                      { color: 'var(--chart-2)', label: t('responsesSeries'), value: payload.find((p) => p.dataKey === 'responses')?.value as number },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="applications" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.85} />
            <Line dataKey="responses" type="monotone" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StatusBars({ data }: { data: { status: AppStatus; count: number }[] }) {
  const t = useTranslations('status');
  const f = useFormat();
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {sorted.map((d) => (
          <span key={d.status} style={{ width: `${(d.count / total) * 100}%`, background: STATUS_META[d.status].color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-col">
        {sorted.map((d) => {
          const Icon = STATUS_META[d.status].icon;
          return (
            <li key={d.status} className="flex h-8 items-center gap-2.5 text-[13px]">
              <Icon className="size-3.5" style={{ color: STATUS_META[d.status].color }} />
              <span className="flex-1 text-text">{t(d.status)}</span>
              <span className="text-subtle tabular">{f.pct((d.count / total) * 100)}</span>
              <span className="w-8 text-right font-medium tabular">{d.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Heatmap({ data }: { data: { date: string; count: number }[] }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const f = useFormat();
  const [hover, setHover] = useState<{ date: string; count: number; x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Most recent weeks matter most: start scrolled to the right edge on narrow screens
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [data]);
  const { weeks, max } = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d.count]));
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 363);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
    const weeks: { date: string; count: number }[][] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const wd = (d.getDay() + 6) % 7;
      if (wd === 0) weeks.push([]);
      weeks[weeks.length - 1].push({ date: iso, count: map.get(iso) ?? 0 });
    }
    return { weeks, max: Math.max(1, ...data.map((d) => d.count)) };
  }, [data]);
  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));

  return (
    <div className="relative">
      <div ref={scroller} className="scrollbar-thin overflow-x-auto pb-2">
        <div className="flex w-max gap-[3px]" onMouseLeave={() => setHover(null)}>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((d) => (
                <span
                  key={d.date}
                  role="img"
                  aria-label={`${f.date(d.date)}: ${tc('applicationsCount', { count: d.count })}`}
                  onMouseEnter={(e) => {
                    const r = (e.target as HTMLElement).getBoundingClientRect();
                    const p = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect();
                    setHover({ ...d, x: r.left - p.left + r.width / 2, y: r.top - p.top });
                  }}
                  className="size-[13px] rounded-[3px] transition-transform hover:scale-125"
                  style={{ background: `var(--heat-${level(d.count)})` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {hover ? (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[8px] bg-text px-2 py-1 text-[11px] whitespace-nowrap text-bg" style={{ left: hover.x, top: hover.y - 6 }}>
          {f.date(hover.date)} · {tc('applicationsCount', { count: hover.count })}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-subtle">
        {t('less')}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-[11px] rounded-[3px]" style={{ background: `var(--heat-${l})` }} />
        ))}
        {t('more')}
      </div>
    </div>
  );
}

/** Applications as the track, interviews as the filled part of it (a subset, so one scale). */
export function SegmentBars({ rows, noneLabel, limit = 10 }: { rows: SegmentRowDto[]; noneLabel: string; limit?: number }) {
  const t = useTranslations('analytics');
  const tc = useTranslations('common');
  const f = useFormat();
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map((r) => r.total));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Legend
          items={[
            { color: 'color-mix(in oklab, var(--chart-1) 28%, var(--surface-2))', label: t('applications') },
            { color: 'var(--chart-1)', label: t('interviews') },
            { color: 'var(--chart-2)', label: t('offers') },
          ]}
        />
        <span className="text-xs whitespace-nowrap text-subtle">{t('interviewRate')}</span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {shown.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(96px,160px)_1fr_auto] items-center gap-3" title={`${r.total} / ${r.interviews} / ${r.offers}`}>
            <span className="truncate text-[13px] text-text">{r.key === '__none' ? noneLabel : r.label}</span>
            <div className="relative h-7 rounded-[8px] bg-surface-2">
              <div className="absolute inset-y-0 left-0 rounded-[8px]" style={{ width: `${(r.total / max) * 100}%`, background: 'color-mix(in oklab, var(--chart-1) 28%, var(--surface-2))' }} />
              <div className="absolute inset-y-0 left-0 rounded-[8px]" style={{ width: `${(r.interviews / max) * 100}%`, background: 'var(--chart-1)' }} />
              {r.offers ? (
                <div className="absolute inset-y-0 left-0 rounded-[8px] ring-2 ring-surface" style={{ width: `${Math.max((r.offers / max) * 100, 1.2)}%`, background: 'var(--chart-2)' }} />
              ) : null}
              <span className="absolute inset-y-0 flex items-center pl-2 text-[11px] font-medium text-text tabular" style={{ left: `${(r.total / max) * 100}%` }}>
                {r.total}
              </span>
            </div>
            <span
              className={cn('w-16 text-right text-sm tabular', r.lowSample ? 'cursor-help text-subtle underline decoration-dashed underline-offset-4' : 'font-medium')}
              title={r.lowSample ? tc('lowSample') : undefined}
            >
              {f.pct(r.interviewRate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SegmentTable({ rows, noneLabel }: { rows: SegmentRowDto[]; noneLabel: string }) {
  const t = useTranslations('analytics');
  const tc = useTranslations('common');
  const f = useFormat();
  const [sort, setSort] = useState<keyof SegmentRowDto>('total');
  const [pageSize, setPageSize] = usePageSize();
  const [page, setPage] = useState(1);
  const sorted = [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  // Derived, so a shorter list (another period) can never leave the table on a page that no longer exists
  const current = clampPage(page, sorted.length, pageSize);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);
  const cols: { key: keyof SegmentRowDto; label: string; pct?: boolean }[] = [
    { key: 'total', label: t('applications') },
    { key: 'responseRate', label: t('responseRate'), pct: true },
    { key: 'interviewRate', label: t('interviewRate'), pct: true },
    { key: 'offerRate', label: t('offerRate'), pct: true },
  ];
  const best = Math.max(...rows.filter((r) => !r.lowSample).map((r) => r.interviewRate), -1);
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-subtle">
            <th className="py-2.5 pr-3 font-medium">{t('name')}</th>
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-right font-medium">
                <button
                  onClick={() => {
                    setSort(c.key);
                    setPage(1);
                  }}
                  className={cn('hover:text-text', sort === c.key && 'text-text')}
                >
                  {c.label}
                  {sort === c.key ? ' ↓' : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.key} className={cn('border-b border-border/60 last:border-0', r.lowSample && 'text-subtle')}>
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2">
                  {r.key === '__none' ? noneLabel : r.label}
                  {r.lowSample ? <LowSample label={tc('lowSample')} /> : null}
                </span>
              </td>
              {cols.map((c) => {
                const v = r[c.key] as number;
                const isBest = c.key === 'interviewRate' && !r.lowSample && v === best && best > 0;
                return (
                  <td key={c.key} className={cn('px-3 py-2.5 text-right tabular', isBest && 'font-semibold text-primary')}>
                    {c.pct ? f.pct(v) : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination compact className="mt-4" page={current} pageSize={pageSize} total={sorted.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  );
}

export function SalaryHistogram({ buckets, currency }: { buckets: SalaryBucketDto[]; currency: string }) {
  const t = useTranslations('analytics');
  const f = useFormat();
  const label = (b: SalaryBucketDto) => `${f.compactMoney(b.from, currency)}–${f.compactMoney(b.to, null)}`;
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="14%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="from" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => f.compactMoney(v, currency)} minTickGap={16} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              const b = payload?.[0]?.payload as SalaryBucketDto | undefined;
              return active && b ? (
                <TooltipBox
                  title={label(b)}
                  rows={[
                    { color: 'color-mix(in oklab, var(--chart-1) 35%, var(--surface-2))', label: t('applications'), value: b.total },
                    { color: 'var(--chart-1)', label: t('interviews'), value: b.interviews },
                    { color: 'var(--chart-2)', label: t('offers'), value: b.offers },
                  ]}
                />
              ) : null;
            }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="var(--chart-1)" fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalaryRateBars({ buckets, currency }: { buckets: SalaryBucketDto[]; currency: string }) {
  const tc = useTranslations('common');
  const t = useTranslations('analytics');
  const f = useFormat();
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 16, right: 8, bottom: 0, left: -20 }} barCategoryGap="14%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="from" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => f.compactMoney(v, currency)} minTickGap={16} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={44} domain={[0, 'auto']} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              const b = payload?.[0]?.payload as SalaryBucketDto | undefined;
              return active && b ? (
                <TooltipBox
                  title={`${f.compactMoney(b.from, currency)}–${f.compactMoney(b.to, null)}`}
                  rows={[
                    { color: 'var(--chart-2)', label: t('interviewRate'), value: b.total ? f.pct(b.interviewRate) : '—' },
                    { color: 'transparent', label: t('applications'), value: `${b.total}${b.lowSample ? ` · ${tc('lowSample')}` : ''}` },
                  ]}
                />
              ) : null;
            }}
          />
          <Bar dataKey="interviewRate" radius={[4, 4, 0, 0]}>
            {buckets.map((b) => (
              <Cell key={b.from} fill="var(--chart-2)" fillOpacity={b.lowSample ? 0.3 : 0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
