import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_SKEW_SECONDS = 300;

/** Same scheme as the Email Worker: HMAC-SHA256(secret, `${timestamp}.${to}.${sha256(raw)}`), hex. */
export function signInbound(secret: string, timestamp: string, to: string, rawBase64: string) {
  const digest = createHash('sha256').update(rawBase64).digest('hex');
  return createHmac('sha256', secret).update(`${timestamp}.${to}.${digest}`).digest('hex');
}

export function verifyInbound(secret: string, timestamp: string | undefined, signature: string | undefined, to: string, rawBase64: string, now = Date.now()) {
  if (!timestamp || !signature || !/^\d{10}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(signInbound(secret, timestamp, to, rawBase64), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
