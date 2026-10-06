/**
 * Runs the real worker code (bundled) against the running heyreply dev stack (web :3000 → api :4000),
 * with a fake Cloudflare `ForwardableEmailMessage`. Needs INBOUND_* set in apps/api/.env.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const WEB = 'http://localhost:3000';
const env = Object.fromEntries(
  readFileSync('../api/.env', 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!env.INBOUND_SECRET || !env.INBOUND_EMAIL_DOMAIN) throw new Error('Set INBOUND_SECRET and INBOUND_EMAIL_DOMAIN in apps/api/.env');

const out = join(tmpdir(), `heyreply-worker-${Date.now()}.mjs`);
await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'esm', outfile: out, platform: 'neutral', logLevel: 'silent' });
const worker = (await import(pathToFileURL(out).href)).default;

let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? '  ✓' : '  ✗', msg);
  if (!cond) failures++;
};

function message(to, raw, rawSize = Buffer.byteLength(raw)) {
  const m = {
    from: 'user@gmail.com',
    to,
    rawSize,
    raw: new Blob([raw]).stream(),
    headers: new Headers(),
    rejected: null,
    setReject(reason) {
      m.rejected = reason;
    },
  };
  return m;
}
const mail = (subject, from = 'noreply@hh.ru') =>
  [`From: ${from}`, `To: user@gmail.com`, `Subject: ${subject}`, `Message-ID: <${Math.random()}@test>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', 'Приглашение по вакансии https://hh.ru/vacancy/123'].join('\r\n');

// account + forwarding address through the web app's API
let cookie = '';
const call = async (path, init = {}) => {
  const res = await fetch(`${WEB}/api/v1${path}`, { ...init, headers: { 'Content-Type': 'application/json', Origin: WEB, Cookie: cookie } });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  return res.json().catch(() => null);
};
const email = `worker-${Date.now()}@heyreply.test`;
const password = 'testpass123';
await call('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Worker', email, password, acceptTerms: true, acceptPersonalData: true }) });
const { address } = await call('/me/inbound', { method: 'POST' });
console.log('  · address', address);

try {
  const envOk = { HEYREPLY_API_URL: WEB, INBOUND_SECRET: env.INBOUND_SECRET };

  const m1 = message(address.toUpperCase(), mail('Приглашение на вакансию «Dev»'));
  await worker.email(m1, envOk);
  check(m1.rejected === null, 'signed delivery accepted by the API (recipient matched case-insensitively)');
  const o = await call('/me/inbound');
  check(o.recent[0]?.kind === 'unverified' && o.recent[0]?.from === 'noreply@hh.ru', 'unsigned "hh.ru" mail journaled as unverified, nothing imported');

  const m2 = message(`in-doesnotexist@${env.INBOUND_EMAIL_DOMAIN}`, mail('x'));
  await worker.email(m2, envOk);
  check(m2.rejected === 'Unknown recipient', 'unknown address bounced with setReject');

  let threw = false;
  try {
    await worker.email(message(address, mail('y')), { ...envOk, INBOUND_SECRET: 'wrong-secret-wrong-secret-wrong-secret' });
  } catch (e) {
    threw = /401/.test(String(e));
  }
  check(threw, 'wrong secret: API refuses (401), worker throws so it shows in logs');

  const big = message(address, mail('z'), 2_000_000);
  let fetched = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (...a) => ((fetched = true), realFetch(...a));
  await worker.email(big, envOk);
  globalThis.fetch = realFetch;
  check(big.rejected === 'Message too large' && !fetched, 'oversized message rejected without calling the API');
} finally {
  await call('/me', { method: 'DELETE', body: JSON.stringify({ password }) });
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
