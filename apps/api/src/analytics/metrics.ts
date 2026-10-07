import {
  ACTIVE_STATUSES,
  APP_STATUSES,
  WAITING_STATUSES,
  type AppStatus,
  type FunnelStageDto,
  type InsightDto,
  type SalaryAnalyticsDto,
  type SegmentRowDto,
  type SummaryDto,
  type TimelinePointDto,
} from '@heyreply/shared';

export const LOW_SAMPLE = 10;
const DAY = 86_400_000;

export interface MetricRow {
  appliedAt: Date;
  status: AppStatus;
  maxStage: number;
  firstResponseAt: Date | null;
  coverLetter: boolean;
  workFormat: string | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  currency: string | null;
  offerAmount: number | null;
  source: { id: string; name: string } | null;
  position: { id: string; name: string; groupName: string | null };
  location: { id: string; name: string } | null;
  company: { name: string };
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const isGhosted = (r: MetricRow, ghostingDays: number, now: Date) =>
  r.status === 'NO_RESPONSE' || (WAITING_STATUSES.includes(r.status) && now.getTime() - r.appliedAt.getTime() > ghostingDays * DAY);

export function summary(rows: MetricRow[], ghostingDays: number, now = new Date()): Omit<SummaryDto, 'previous'> {
  const total = rows.length;
  const responded = rows.filter((r) => r.firstResponseAt).length;
  const ghosted = rows.filter((r) => isGhosted(r, ghostingDays, now)).length;
  // An application entered afterwards already in a later status has its response stamped at the application date: the
  // real wait is unknown, and counting it as 0 days would drag the median down. It still counts as a response above.
  const responseDays = rows
    .filter((r) => r.firstResponseAt && r.firstResponseAt.getTime() > r.appliedAt.getTime())
    .map((r) => Math.max(0, (r.firstResponseAt!.getTime() - r.appliedAt.getTime()) / DAY));
  const med = median(responseDays);
  return {
    total,
    responseRate: pct(responded, total),
    interviewRate: pct(rows.filter((r) => r.maxStage >= 4).length, total),
    offerRate: pct(rows.filter((r) => r.maxStage >= 5).length, total),
    rejectionRate: pct(rows.filter((r) => r.status === 'REJECTED').length, total),
    ghostingRate: pct(ghosted, total),
    active: rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    medianResponseDays: med == null ? null : Math.round(med * 10) / 10,
    waitingOverThreshold: rows.filter((r) => WAITING_STATUSES.includes(r.status) && isGhosted(r, ghostingDays, now)).length,
  };
}

export function funnel(rows: MetricRow[]): FunnelStageDto[] {
  const counts = [1, 2, 3, 4, 5].map((stage) => rows.filter((r) => r.maxStage >= stage).length);
  // Stage 1 is every application regardless of maxStage
  counts[0] = rows.length;
  return counts.map((count, i) => ({
    stage: i + 1,
    count,
    fromPrev: i === 0 ? 100 : pct(count, counts[i - 1]),
    fromFirst: pct(count, counts[0]),
  }));
}

export function statusDistribution(rows: MetricRow[]) {
  return APP_STATUSES.map((status) => ({ status, count: rows.filter((r) => r.status === status).length })).filter((s) => s.count > 0);
}

export function segment(rows: MetricRow[], keyFn: (r: MetricRow) => { key: string; label: string } | null): SegmentRowDto[] {
  const groups = new Map<string, { label: string; rows: MetricRow[] }>();
  for (const r of rows) {
    const k = keyFn(r) ?? { key: '__none', label: '__none' };
    const g = groups.get(k.key) ?? { label: k.label, rows: [] };
    g.rows.push(r);
    groups.set(k.key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const total = g.rows.length;
      const responded = g.rows.filter((r) => r.firstResponseAt).length;
      const interviews = g.rows.filter((r) => r.maxStage >= 4).length;
      const offers = g.rows.filter((r) => r.maxStage >= 5).length;
      return {
        key,
        label: g.label,
        total,
        responded,
        interviews,
        offers,
        responseRate: pct(responded, total),
        interviewRate: pct(interviews, total),
        offerRate: pct(offers, total),
        lowSample: total < LOW_SAMPLE,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function startOfWeek(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

export function timeline(rows: MetricRow[], from?: Date, to = new Date()): TimelinePointDto[] {
  if (!rows.length) return [];
  const start = startOfWeek(from ?? new Date(Math.min(...rows.map((r) => r.appliedAt.getTime()))));
  const end = startOfWeek(to);
  const map = new Map<string, TimelinePointDto>();
  for (let t = start.getTime(); t <= end.getTime(); t += 7 * DAY) {
    const k = new Date(t).toISOString().slice(0, 10);
    map.set(k, { period: k, applications: 0, responses: 0 });
  }
  for (const r of rows) {
    const k = startOfWeek(r.appliedAt).toISOString().slice(0, 10);
    const p = map.get(k);
    if (p) p.applications++;
    if (r.firstResponseAt) {
      const rk = map.get(startOfWeek(r.firstResponseAt).toISOString().slice(0, 10));
      if (rk) rk.responses++;
    }
  }
  return [...map.values()];
}

export function heatmap(rows: MetricRow[], now = new Date(), days = 364) {
  const counts = new Map<string, number>();
  const since = now.getTime() - days * DAY;
  for (const r of rows) {
    if (r.appliedAt.getTime() < since) continue;
    const k = r.appliedAt.toISOString().slice(0, 10);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export const salaryPoint = (r: MetricRow) =>
  r.salaryFrom != null && r.salaryTo != null ? (r.salaryFrom + r.salaryTo) / 2 : (r.salaryFrom ?? r.salaryTo);

export function salary(rows: MetricRow[], currency?: string, bucket?: number): SalaryAnalyticsDto {
  const byCur = new Map<string, number>();
  for (const r of rows) if (r.currency && salaryPoint(r) != null) byCur.set(r.currency, (byCur.get(r.currency) ?? 0) + 1);
  const currencies = [...byCur.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const cur = currency && currencies.includes(currency) ? currency : (currencies[0] ?? currency ?? 'RUB');
  const step = bucket ?? (cur === 'RUB' || cur === 'KZT' || cur === 'AMD' || cur === 'RSD' ? 50_000 : 1_000);
  const withSalary = rows.filter((r) => r.currency === cur && salaryPoint(r) != null);
  const points = withSalary.map((r) => salaryPoint(r)!).sort((a, b) => a - b);

  const buckets = new Map<number, MetricRow[]>();
  for (const r of withSalary) {
    const b = Math.floor(salaryPoint(r)! / step) * step;
    buckets.set(b, [...(buckets.get(b) ?? []), r]);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const filled: number[] = [];
  if (keys.length) for (let b = keys[0]; b <= keys[keys.length - 1]; b += step) filled.push(b);

  return {
    currency: cur,
    bucket: step,
    currencies,
    buckets: filled.map((from) => {
      const rs = buckets.get(from) ?? [];
      const interviews = rs.filter((r) => r.maxStage >= 4).length;
      return {
        from,
        to: from + step,
        total: rs.length,
        interviews,
        offers: rs.filter((r) => r.maxStage >= 5).length,
        interviewRate: pct(interviews, rs.length),
        lowSample: rs.length < LOW_SAMPLE,
      };
    }),
    quartiles: points.length
      ? {
          min: points[0],
          q1: Math.round(quantile(points, 0.25)),
          median: Math.round(quantile(points, 0.5)),
          q3: Math.round(quantile(points, 0.75)),
          max: points[points.length - 1],
        }
      : null,
    offers: withSalary
      .filter((r) => r.offerAmount != null)
      .map((r) => ({ company: r.company.name, position: r.position.name, salaryFrom: r.salaryFrom, salaryTo: r.salaryTo, offerAmount: r.offerAmount! })),
  };
}

/** Rule-based observations. Only produced when every compared group has enough data. */
export function insights(rows: MetricRow[], ghostingDays: number, now = new Date()): InsightDto[] {
  const out: InsightDto[] = [];

  const sources = segment(rows, (r) => (r.source ? { key: r.source.id, label: r.source.name } : null)).filter(
    (s) => s.key !== '__none' && !s.lowSample,
  );
  if (sources.length >= 2) {
    const sorted = [...sources].sort((a, b) => b.responseRate - a.responseRate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (worst.responseRate > 0 && best.responseRate / worst.responseRate >= 1.3) {
      out.push({
        kind: 'source',
        params: { best: best.label, worst: worst.label, ratio: Math.round((best.responseRate / worst.responseRate) * 10) / 10 },
      });
    }
  }

  const sal = salary(rows);
  const good = sal.buckets.filter((b) => !b.lowSample);
  if (good.length >= 2) {
    const best = [...good].sort((a, b) => b.interviewRate - a.interviewRate)[0];
    const others = good.filter((b) => b !== best);
    const otherRate = Math.round((others.reduce((s, b) => s + b.interviews, 0) / others.reduce((s, b) => s + b.total, 0)) * 1000) / 10;
    if (best.interviewRate > otherRate) {
      out.push({ kind: 'salary', params: { from: best.from, to: best.to, currency: sal.currency, rate: best.interviewRate, other: otherRate } });
    }
  }

  const withCl = rows.filter((r) => r.coverLetter);
  const withoutCl = rows.filter((r) => !r.coverLetter);
  if (withCl.length >= LOW_SAMPLE && withoutCl.length >= LOW_SAMPLE) {
    const a = summary(withCl, ghostingDays, now).responseRate;
    const b = summary(withoutCl, ghostingDays, now).responseRate;
    const diff = Math.round((a - b) * 10) / 10;
    if (Math.abs(diff) >= 3) out.push({ kind: 'coverLetter', params: { diff } });
  }

  const formats = segment(rows, (r) => (r.workFormat ? { key: r.workFormat, label: r.workFormat } : null)).filter(
    (s) => s.key !== '__none' && !s.lowSample,
  );
  if (formats.length >= 2) {
    const best = [...formats].sort((a, b) => b.interviewRate - a.interviewRate)[0];
    if (best.interviewRate > 0) out.push({ kind: 'format', params: { format: best.key, rate: best.interviewRate } });
  }

  const waiting = summary(rows, ghostingDays, now).waitingOverThreshold;
  if (waiting > 0) out.push({ kind: 'ghosting', params: { count: waiting, days: ghostingDays } });

  return out.slice(0, 4);
}
