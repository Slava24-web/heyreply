import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18n = createMiddleware(routing);
const PUBLIC = ['/login', '/register', '/forgot-password', '/reset-password'];
const isDev = process.env.NODE_ENV === 'development';
const httpsEnabled = !isDev && process.env.HTTPS_ENABLED !== 'false';

/**
 * Strict CSP: scripts only from our origin or carrying this request's nonce ('strict-dynamic' lets Next's
 * own chunks load). Inline style attributes are needed by charts/animations, so styles allow 'unsafe-inline'.
 */
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(httpsEnabled ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

function withCsp(res: NextResponse, csp: string) {
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

// Optimistic auth check only: the API validates tokens and sessions on every request.
export default function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const { pathname } = request.nextUrl;
  const segments = pathname.split('/');
  const hasLocalePrefix = (routing.locales as readonly string[]).includes(segments[1]);
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const locale = hasLocalePrefix ? segments[1] : cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale) ? cookieLocale : routing.defaultLocale;
  const path = hasLocalePrefix ? '/' + segments.slice(2).join('/') : pathname;
  const signedIn = request.cookies.has('has_session');
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'));

  if (!signedIn && !isPublic) {
    const url = new URL(`/${locale}/login`, request.url);
    if (path !== '/' && path !== '') url.searchParams.set('next', path);
    return withCsp(NextResponse.redirect(url), csp);
  }
  if (signedIn && isPublic && path !== '/reset-password') {
    return withCsp(NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url)), csp);
  }

  // Next.js reads the nonce from the request CSP header while rendering; next-intl forwards request headers.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  return withCsp(handleI18n(new NextRequest(request, { headers })), csp);
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next|_vercel|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
