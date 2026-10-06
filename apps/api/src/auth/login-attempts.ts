import { Injectable } from '@nestjs/common';

interface Bucket {
  count: number;
  first: number;
}

const WINDOW_MS = 15 * 60_000;
/** Per (email, ip): stops a single client brute-forcing an account. */
const PER_CLIENT_LIMIT = 5;
/** Per email across all IPs: bounds distributed brute force without letting one client lock the owner out. */
const PER_ACCOUNT_LIMIT = 30;
const MAX_KEYS = 50_000;

/**
 * In-memory attempt counters. Fine for a single API instance; with several replicas move this to Redis.
 * Keys never include the password and are dropped after the window.
 */
@Injectable()
export class LoginAttempts {
  private readonly buckets = new Map<string, Bucket>();

  private hit(key: string, now: number) {
    const b = this.buckets.get(key);
    if (!b || now - b.first > WINDOW_MS) this.buckets.set(key, { count: 1, first: now });
    else b.count++;
  }

  private over(key: string, limit: number, now: number) {
    const b = this.buckets.get(key);
    return !!b && now - b.first <= WINDOW_MS && b.count >= limit;
  }

  isLocked(email: string, ip: string | null, now = Date.now()) {
    return this.over(`c:${email}|${ip ?? '-'}`, PER_CLIENT_LIMIT, now) || this.over(`a:${email}`, PER_ACCOUNT_LIMIT, now);
  }

  fail(email: string, ip: string | null, now = Date.now()) {
    if (this.buckets.size > MAX_KEYS) this.prune(now);
    this.hit(`c:${email}|${ip ?? '-'}`, now);
    this.hit(`a:${email}`, now);
  }

  success(email: string, ip: string | null) {
    this.buckets.delete(`c:${email}|${ip ?? '-'}`);
  }

  prune(now = Date.now()) {
    for (const [k, b] of this.buckets) if (now - b.first > WINDOW_MS) this.buckets.delete(k);
  }
}
