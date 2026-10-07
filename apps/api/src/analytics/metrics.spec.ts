import { funnel, insights, median, salary, segment, summary, timeline } from './metrics';
import type { MetricRow } from './metrics';
import { applyTransition } from '../applications/status.logic';

const now = new Date('2026-10-05T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

function row(over: Partial<MetricRow> = {}): MetricRow {
  return {
    appliedAt: daysAgo(5),
    status: 'APPLIED',
    maxStage: 1,
    firstResponseAt: null,
    coverLetter: false,
    workFormat: 'REMOTE',
    salaryFrom: null,
    salaryTo: null,
    currency: null,
    offerAmount: null,
    source: { id: 's1', name: 'HeadHunter' },
    position: { id: 'p1', name: 'Frontend', groupName: null },
    location: null,
    company: { name: 'Co' },
    ...over,
  };
}

describe('applyTransition', () => {
  it('keeps max stage and first response when moving to rejection', () => {
    const t0 = daysAgo(10);
    let s = applyTransition(null, 'APPLIED', t0);
    expect(s).toMatchObject({ maxStage: 1, firstResponseAt: null, finishedAt: null });
    s = applyTransition(s, 'INTERVIEW', daysAgo(6));
    expect(s.maxStage).toBe(4);
    expect(s.firstResponseAt).toEqual(daysAgo(6));
    s = applyTransition(s, 'REJECTED', daysAgo(2));
    expect(s.maxStage).toBe(4);
    expect(s.firstResponseAt).toEqual(daysAgo(6));
    expect(s.finishedAt).toEqual(daysAgo(2));
  });

  it('treats an immediate rejection as a response but not VIEWED', () => {
    expect(applyTransition(null, 'VIEWED', now).firstResponseAt).toBeNull();
    expect(applyTransition(null, 'REJECTED', now).firstResponseAt).toEqual(now);
  });
});

describe('summary', () => {
  it('computes rates per the spec formulas', () => {
    const rows = [
      row({ status: 'OFFER', maxStage: 5, firstResponseAt: daysAgo(3) }),
      row({ status: 'REJECTED', maxStage: 4, firstResponseAt: daysAgo(4) }),
      row({ status: 'REJECTED', maxStage: 1, firstResponseAt: daysAgo(1) }),
      row({ status: 'APPLIED', appliedAt: daysAgo(20) }),
    ];
    const s = summary(rows, 14, now);
    expect(s.total).toBe(4);
    expect(s.responseRate).toBe(75);
    expect(s.interviewRate).toBe(50);
    expect(s.offerRate).toBe(25);
    expect(s.rejectionRate).toBe(50);
    expect(s.ghostingRate).toBe(25);
    expect(s.waitingOverThreshold).toBe(1);
    expect(s.medianResponseDays).toBe(2);
  });

  it('leaves applications entered with a known later status out of the median wait', () => {
    const base = { maxStage: 4, coverLetter: false, workFormat: null, salaryFrom: null, salaryTo: null, currency: null, offerAmount: null, source: null, position: { id: 'p', name: 'p', groupName: null }, location: null, company: { name: 'c' }, status: 'INTERVIEW' as const };
    const applied = new Date('2026-09-01T10:00:00Z');
    const rows = [
      { ...base, appliedAt: applied, firstResponseAt: applied }, // entered afterwards: response date unknown
      { ...base, appliedAt: applied, firstResponseAt: new Date('2026-09-04T10:00:00Z') },
    ];
    const s = summary(rows, 14, now);
    expect(s.responseRate).toBe(100);
    expect(s.medianResponseDays).toBe(3);
    expect(summary([rows[0]], 14, now).medianResponseDays).toBeNull();
  });

  it('handles empty input', () => {
    expect(summary([], 14, now)).toMatchObject({ total: 0, responseRate: 0, medianResponseDays: null });
  });
});

describe('funnel', () => {
  it('counts applications that reached each stage', () => {
    const f = funnel([row({ maxStage: 5 }), row({ maxStage: 4 }), row({ maxStage: 2 }), row({ maxStage: 1 })]);
    expect(f.map((s) => s.count)).toEqual([4, 3, 2, 2, 1]);
    expect(f[3].fromPrev).toBe(100);
    expect(f[4].fromFirst).toBe(25);
  });
});

describe('segment', () => {
  it('flags low samples', () => {
    const rows = Array.from({ length: 12 }, () => row()).concat([row({ source: { id: 's2', name: 'LinkedIn' } })]);
    const seg = segment(rows, (r) => (r.source ? { key: r.source.id, label: r.source.name } : null));
    expect(seg[0]).toMatchObject({ key: 's1', total: 12, lowSample: false });
    expect(seg[1]).toMatchObject({ key: 's2', total: 1, lowSample: true });
  });
});

describe('salary', () => {
  it('buckets by midpoint and fills gaps', () => {
    const rows = [
      row({ salaryFrom: 200_000, salaryTo: 240_000, currency: 'RUB', maxStage: 4 }),
      row({ salaryFrom: 330_000, currency: 'RUB' }),
      row({ salaryFrom: 1000, currency: 'USD' }),
    ];
    const s = salary(rows);
    expect(s.currency).toBe('RUB');
    expect(s.buckets.map((b) => b.from)).toEqual([200_000, 250_000, 300_000]);
    expect(s.buckets[0]).toMatchObject({ total: 1, interviews: 1, interviewRate: 100 });
    expect(s.quartiles?.median).toBe(275_000);
  });
});

describe('timeline', () => {
  it('groups by week starting monday', () => {
    const t = timeline([row({ appliedAt: new Date('2026-09-30T10:00:00Z') })], new Date('2026-09-28T00:00:00Z'), new Date('2026-10-05T00:00:00Z'));
    expect(t[0]).toEqual({ period: '2026-09-28', applications: 1, responses: 0 });
    expect(t).toHaveLength(2);
  });
});

describe('median', () => {
  it('works for even and odd lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('insights', () => {
  it('compares sources only with enough data', () => {
    const hh = Array.from({ length: 10 }, (_, i) => row({ firstResponseAt: i < 2 ? daysAgo(1) : null }));
    const li = Array.from({ length: 10 }, (_, i) =>
      row({ source: { id: 's2', name: 'LinkedIn' }, firstResponseAt: i < 6 ? daysAgo(1) : null }),
    );
    const ins = insights([...hh, ...li], 14, now);
    expect(ins.find((i) => i.kind === 'source')?.params).toMatchObject({ best: 'LinkedIn', worst: 'HeadHunter', ratio: 3 });
  });
});
