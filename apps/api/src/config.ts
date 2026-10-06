import { z } from 'zod';

const WEAK_SECRETS = ['dev-access-secret-change-me-please-32chars', 'change-me-in-production-at-least-32-chars'];

/** docker compose passes unset optional variables as empty strings */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    PORT: z.coerce.number().int().default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    /** Number of reverse-proxy hops in front of the API whose X-Forwarded-For we trust (Next.js rewrite = 1). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    SWAGGER: z.enum(['true', 'false']).optional(),
    /** E-mail import: domain routed by Cloudflare Email Routing to the Email Worker, e.g. in.heyreply.app */
    INBOUND_EMAIL_DOMAIN: z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/).optional()),
    /** Shared secret the Email Worker signs requests with (HMAC-SHA256) */
    INBOUND_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    /** Only accept board e-mails with a valid DKIM signature of the board's domain (anti-spoofing) */
    INBOUND_REQUIRE_DKIM: z.enum(['true', 'false']).default('true'),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && WEAK_SECRETS.includes(v.JWT_ACCESS_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Default JWT secret must not be used in production' });
    }
    if (v.INBOUND_EMAIL_DOMAIN && !v.INBOUND_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['INBOUND_SECRET'], message: 'INBOUND_SECRET is required when INBOUND_EMAIL_DOMAIN is set' });
    }
  });

export type AppConfig = z.infer<typeof schema> & { cookieSecure: boolean; swagger: boolean; isProd: boolean };

let cached: AppConfig | null = null;

/** Validated once at startup: the API refuses to boot with a missing or weak configuration. */
export function config(): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid configuration:\n  ${msg}`);
  }
  const v = parsed.data;
  const isProd = v.NODE_ENV === 'production';
  cached = {
    ...v,
    isProd,
    // Secure cookies by default in production; explicit COOKIE_SECURE=false only for plain-http local setups
    cookieSecure: v.COOKIE_SECURE ? v.COOKIE_SECURE === 'true' : isProd,
    swagger: v.SWAGGER ? v.SWAGGER === 'true' : !isProd,
  };
  return cached;
}
