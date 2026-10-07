import type { CookieOptions, Response } from 'express';
import type { IssuedTokens } from './auth.service';
import { config } from '../config';

const base = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config().cookieSecure,
});

export const REFRESH_PATH = '/api/v1/auth';
const ACCESS_MARKER_MARGIN_MS = 15_000;

export function setAuthCookies(res: Response, t: IssuedTokens) {
  res.cookie('access_token', t.accessToken, { ...base(), path: '/', maxAge: t.accessMaxAgeMs });
  res.cookie('refresh_token', t.refreshToken, { ...base(), path: REFRESH_PATH, maxAge: t.refreshMaxAgeMs });
  // Non-secret marker so the Next.js proxy can tell a signed-in visitor without seeing the refresh token.
  res.cookie('has_session', '1', { ...base(), path: '/', maxAge: t.refreshMaxAgeMs });
  // Readable by the web app and gone slightly before the access token expires (the browser drops it on its own clock).
  // Without it every request of a burst would fail with 401 once before the client refreshes; with it the client refreshes first.
  res.cookie('access_ok', '1', { ...base(), httpOnly: false, path: '/', maxAge: Math.max(1000, t.accessMaxAgeMs - ACCESS_MARKER_MARGIN_MS) });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { ...base(), path: '/' });
  res.clearCookie('refresh_token', { ...base(), path: REFRESH_PATH });
  res.clearCookie('has_session', { ...base(), path: '/' });
  res.clearCookie('access_ok', { ...base(), httpOnly: false, path: '/' });
}
