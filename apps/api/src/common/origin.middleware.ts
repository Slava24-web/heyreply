import type { NextFunction, Request, Response } from 'express';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense in depth on top of SameSite=Lax cookies: state-changing requests must come from the web origin.
 * Browsers always send Origin on cross-site POST/PATCH/DELETE; a missing Origin means a non-browser client
 * (which has no ambient cookies to abuse). Sec-Fetch-Site rejects cross-site requests from modern browsers too.
 */
export function originGuard(allowedOrigin: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE.has(req.method)) return next();
    // Token-authenticated calls (browser extension) carry no ambient credentials, so they can't be forged cross-site:
    // a page can't attach an Authorization header without our CORS consent, and cookies are ignored on these routes.
    if (req.path.startsWith('/api/v1/import/') && req.headers.authorization?.startsWith('Bearer otk_')) return next();
    const origin = req.headers.origin;
    const site = req.headers['sec-fetch-site'];
    if ((origin && origin !== allowedOrigin) || site === 'cross-site') {
      res.status(403).json({ statusCode: 403, code: 'BAD_ORIGIN', message: 'Origin not allowed', details: null });
      return;
    }
    next();
  };
}
