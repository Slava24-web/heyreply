import type { Request } from 'express';

/** Client metadata stored with a session. `req.ip` honours only our trusted proxy hops, so it can't be spoofed via X-Forwarded-For. */
export function clientMeta(req: Request) {
  return {
    userAgent: (req.headers['user-agent'] ?? '').slice(0, 300) || null,
    ip: req.ip ?? null,
  };
}
