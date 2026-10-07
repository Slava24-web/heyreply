import type { ImportOutcome, ImportResultDto } from '@heyreply/shared';
import type { Observed } from './types';

/** Server limits (packages/shared importItemSchema): an item over any of them would make the whole batch fail with 400. */
const MAX_NAME = 160;
const MAX_ID = 120;
const MAX_URL = 2000;
const MAX_SALARY = 1_000_000_000;
const MIN_DATE = Date.UTC(2000, 0, 1);

export const MAX_ATTEMPTS = 5;
/** Minutes to wait after the 1st, 2nd, … consecutive failed send. */
const BACKOFF_MIN = [1, 2, 5, 15, 30];

export const itemKey = (i: Pick<Observed, 'platform' | 'externalId' | 'origin'>) => `${i.platform}:${i.externalId}:${i.origin}`;

export const backoffMinutes = (failures: number) => BACKOFF_MIN[Math.min(Math.max(failures, 1), BACKOFF_MIN.length) - 1];

const text = (v: string | null | undefined, max: number) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const money = (v: number | null | undefined) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SALARY ? v : null);

function httpUrl(v: string | null | undefined): string | null {
  if (!v || v.length > MAX_URL) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Makes an observation fit the server schema, so one oddly formatted page can't get a whole batch rejected.
 * Returns null when it can't be saved at all (no id, company or position).
 */
export function sanitize(i: Observed, now = Date.now()): Observed | null {
  const externalId = text(i.externalId, MAX_ID + 1);
  const companyName = text(i.companyName, MAX_NAME);
  const positionName = text(i.positionName, MAX_NAME);
  if (!externalId || externalId.length > MAX_ID || !companyName || !positionName) return null;
  const applied = i.appliedAt ? Date.parse(i.appliedAt) : NaN;
  return {
    ...i,
    externalId,
    companyName,
    positionName,
    vacancyUrl: httpUrl(i.vacancyUrl),
    locationName: text(i.locationName, MAX_NAME) || null,
    salaryFrom: money(i.salaryFrom),
    salaryTo: money(i.salaryTo),
    currency: i.currency && /^[A-Za-z]{3}$/.test(i.currency) ? i.currency.toUpperCase() : null,
    // A date from a page we misread must never land in the future or before the web existed
    appliedAt: Number.isFinite(applied) && applied >= MIN_DATE && applied <= now ? new Date(applied).toISOString() : null,
  };
}

/** Why a send failed as a whole; `retryAfterMin` is set when the server said when to come back. */
export class SyncError extends Error {
  constructor(
    code: string,
    readonly retryAfterMin?: number,
  ) {
    super(code);
  }
}

export type SentOutcome = ImportOutcome | 'rejected';
export type Post = (items: Observed[]) => Promise<Response>;

const ITEM_REJECTED = new Set([400, 413, 422]);

async function send(batch: Observed[], post: Post): Promise<SentOutcome[]> {
  const res = await post(batch);
  if (res.status === 401) throw new SyncError('BAD_TOKEN');
  if (res.status === 429) {
    const wait = Number(res.headers.get('Retry-After'));
    throw new SyncError('RATE_LIMIT', Number.isFinite(wait) && wait > 0 ? Math.ceil(wait / 60) : undefined);
  }
  if (ITEM_REJECTED.has(res.status)) {
    if (batch.length === 1) return ['rejected'];
    // Some item doesn't pass validation: halve the batch until the offender is alone, the rest goes through
    const mid = Math.ceil(batch.length / 2);
    return [...(await send(batch.slice(0, mid), post)), ...(await send(batch.slice(mid), post))];
  }
  if (!res.ok) throw new SyncError(`HTTP_${res.status}`);
  const r = (await res.json()) as ImportResultDto;
  return batch.map((_, idx) => r.items[idx] ?? 'unchanged');
}

/**
 * Sends one batch and returns an outcome per item. Items the server refuses are isolated instead of blocking the rest.
 * If it refuses everything (a wrong address, a proxy in the way), that is a connection problem, not bad items: it throws.
 */
export async function sendBatch(batch: Observed[], post: Post): Promise<SentOutcome[]> {
  const outcomes = await send(batch, post);
  if (batch.length > 1 && outcomes.every((o) => o === 'rejected')) throw new SyncError('REJECTED');
  return outcomes;
}
