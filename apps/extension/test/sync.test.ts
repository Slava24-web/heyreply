import { describe, expect, it } from 'vitest';
import { backoffMinutes, itemKey, sanitize, sendBatch, SyncError } from '../src/sync';
import type { Observed } from '../src/types';

const item = (n: number, extra: Partial<Observed> = {}): Observed => ({ platform: 'hh', externalId: String(n), companyName: 'Acme', positionName: `Dev ${n}`, origin: 'apply', ...extra });
const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const ok = (outcomes: string[]) => json(200, { items: outcomes, created: 0, updated: 0, unchanged: 0, linked: 0, errors: [] });

describe('sanitize', () => {
  it('trims to server limits and drops what the server would refuse', () => {
    const s = sanitize(
      item(1, { positionName: 'x'.repeat(300), vacancyUrl: 'javascript:alert(1)', salaryFrom: -5, salaryTo: 12.5, currency: 'rub', locationName: ' Москва ', appliedAt: 'not a date' }),
    )!;
    expect(s.positionName).toHaveLength(160);
    expect(s).toMatchObject({ vacancyUrl: null, salaryFrom: null, salaryTo: null, currency: 'RUB', locationName: 'Москва', appliedAt: null });
  });
  it('rejects observations that cannot be saved', () => {
    expect(sanitize(item(1, { companyName: '   ' }))).toBeNull();
    expect(sanitize(item(1, { externalId: 'x'.repeat(121) }))).toBeNull();
  });
  it('keeps a plausible date and discards a future or ancient one', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(sanitize(item(1, { appliedAt: '2026-09-30T12:00:00.000Z' }), now)!.appliedAt).toBe('2026-09-30T12:00:00.000Z');
    expect(sanitize(item(1, { appliedAt: '2026-12-01T12:00:00.000Z' }), now)!.appliedAt).toBeNull();
    expect(sanitize(item(1, { appliedAt: '1970-01-01T00:00:00.000Z' }), now)!.appliedAt).toBeNull();
  });
});

describe('sendBatch', () => {
  it('maps the outcomes of a normal response', async () => {
    const out = await sendBatch([item(1), item(2)], async () => ok(['created', 'unchanged']));
    expect(out).toEqual(['created', 'unchanged']);
  });

  it('isolates one invalid item instead of blocking the whole batch', async () => {
    const batch = [1, 2, 3, 4, 5].map((n) => item(n));
    const calls: number[] = [];
    const post = async (items: Observed[]) => {
      calls.push(items.length);
      if (items.some((i) => i.externalId === '3')) return json(400, { code: 'VALIDATION' });
      return ok(items.map(() => 'created'));
    };
    const out = await sendBatch(batch, post);
    expect(out).toEqual(['created', 'created', 'rejected', 'created', 'created']);
    expect(calls.length).toBeLessThan(batch.length * 2);
  });

  it('treats a refusal of everything as a connection problem, not as bad items', async () => {
    await expect(sendBatch([item(1), item(2), item(3)], async () => json(422))).rejects.toMatchObject({ message: 'REJECTED' });
  });

  it('reports a single refused item as rejected', async () => {
    expect(await sendBatch([item(1)], async () => json(400))).toEqual(['rejected']);
  });

  it('fails the whole send on a bad token, rate limit and server errors', async () => {
    await expect(sendBatch([item(1)], async () => json(401))).rejects.toMatchObject({ message: 'BAD_TOKEN' });
    const limited = await sendBatch([item(1)], async () => json(429, {}, { 'Retry-After': '90' })).catch((e) => e);
    expect(limited).toBeInstanceOf(SyncError);
    expect(limited).toMatchObject({ message: 'RATE_LIMIT', retryAfterMin: 2 });
    await expect(sendBatch([item(1)], async () => json(503))).rejects.toMatchObject({ message: 'HTTP_503' });
  });

  it('propagates network errors', async () => {
    await expect(sendBatch([item(1)], async () => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow('Failed to fetch');
  });
});

describe('helpers', () => {
  it('backs off and caps the delay', () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffMinutes)).toEqual([1, 2, 5, 15, 30, 30]);
  });
  it('keys one entry per vacancy and origin', () => {
    expect(itemKey(item(7))).toBe('hh:7:apply');
    expect(itemKey(item(7, { origin: 'sync' }))).toBe('hh:7:sync');
  });
});
