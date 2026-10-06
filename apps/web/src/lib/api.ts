export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { path: string; message: string }[] | null = null,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

function toQs(query?: Query) {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

type RefreshResult = 'ok' | 'throttled' | 'failed';
let refreshing: Promise<RefreshResult> | null = null;

/**
 * Single-flight refresh: concurrent 401s in this tab share one rotation request.
 * 409 REFRESH_RACE means another tab rotated the token a moment ago — the browser already holds the new cookie.
 */
function refreshOnce() {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r): RefreshResult => (r.ok || r.status === 409 ? 'ok' : r.status === 429 ? 'throttled' : 'failed'))
    .catch((): RefreshResult => 'throttled')
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

/** Per-device data that must not outlive the session on a shared computer. */
export function clearLocalUserData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('heyreply.')) localStorage.removeItem(k);
  } catch {}
}

async function goToLogin() {
  if (typeof window === 'undefined') return;
  clearLocalUserData();
  // Clear the session marker cookie too, otherwise the proxy would bounce /login back to the app
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  const locale = document.documentElement.lang || 'ru';
  const next = window.location.pathname.replace(/^\/(ru|en)/, '');
  window.location.href = `/${locale}/login${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; query?: Query; raw?: boolean } = {}): Promise<T> {
  const url = `/api/v1${path}${toQs(opts.query)}`;
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };
  let res = await fetch(url, init);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const result = await refreshOnce();
    if (result === 'ok') res = await fetch(url, init);
    else if (result === 'throttled') throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Try again later');
    else {
      await goToLogin();
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code ?? 'HTTP_ERROR', body.message ?? res.statusText, body.details ?? null);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function exportUrl(path: string, query?: Query) {
  return `/api/v1${path}${toQs(query)}`;
}
