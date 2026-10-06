/**
 * Donation link (PayPal.me, Ko-fi, ...), set per deployment in DONATE_URL.
 * Server-side only; only https links are accepted, so a mistyped or hostile value can't become a script URL.
 */
export function getDonateUrl(): string | null {
  const raw = process.env.DONATE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
