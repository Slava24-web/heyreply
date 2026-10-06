/**
 * Cloudflare Email Worker: forwards every message sent to the import domain to the heyreply API.
 * It does no parsing itself — the API verifies DKIM, recognizes the board and imports the application.
 * Requests are authenticated with HMAC-SHA256 over `${timestamp}.${to}.${sha256(raw)}`.
 */
export interface Env {
  HEYREPLY_API_URL: string;
  INBOUND_SECRET: string;
}

/** Board notifications are tens of KB; anything this large is not one of them. */
export const MAX_RAW_BYTES = 1_500_000;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function signRequest(secret: string, timestamp: string, to: string, rawBase64: string) {
  const digest = hex(await crypto.subtle.digest('SHA-256', enc.encode(rawBase64)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${to}.${digest}`)));
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    if (message.rawSize > MAX_RAW_BYTES) {
      message.setReject('Message too large');
      return;
    }
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    const rawBase64 = toBase64(raw);
    const to = message.to.trim().toLowerCase();
    const timestamp = String(Math.floor(Date.now() / 1000));

    const res = await fetch(new URL('/api/v1/inbound/email', env.HEYREPLY_API_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Heyreply-Timestamp': timestamp,
        'X-Heyreply-Signature': await signRequest(env.INBOUND_SECRET, timestamp, to, rawBase64),
      },
      body: JSON.stringify({ to, from: message.from, raw: rawBase64 }),
    });

    if (res.status === 404) return message.setReject('Unknown recipient');
    if (res.status === 413) return message.setReject('Message too large');
    // Anything else unexpected (API down, bad secret): fail loudly so it shows up in the Worker's logs
    if (!res.ok) throw new Error(`heyreply API responded ${res.status}`);
  },
};
