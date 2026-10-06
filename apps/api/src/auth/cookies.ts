import type { CookieOptions, Response } from 'express';
import type { IssuedTokens } from './auth.service';
import { config } from '../config';

const base = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config().cookieSecure,
});

export const REFRESH_PATH = '/api/v1/auth';

export function setAuthCookies(res: Response, t: IssuedTokens) {
  res.cookie('access_token', t.accessToken, { ...base(), path: '/', maxAge: t.accessMaxAgeMs });
  res.cookie('refresh_token', t.refreshToken, { ...base(), path: REFRESH_PATH, maxAge: t.refreshMaxAgeMs });
  // Non-secret marker so the Next.js proxy can tell a signed-in visitor without seeing the refresh token.
  res.cookie('has_session', '1', { ...base(), path: '/', maxAge: t.refreshMaxAgeMs });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { ...base(), path: '/' });
  res.clearCookie('refresh_token', { ...base(), path: REFRESH_PATH });
  res.clearCookie('has_session', { ...base(), path: '/' });
}
