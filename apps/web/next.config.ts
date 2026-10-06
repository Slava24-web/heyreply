import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // HSTS only when served over HTTPS (HTTPS_ENABLED=false for plain-http local setups)
  ...(isProd && process.env.HTTPS_ENABLED !== 'false' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Same-origin API: auth cookies are first-party and no CORS is needed in the browser.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
