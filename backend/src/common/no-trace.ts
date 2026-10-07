import type { NextFunction, Request, Response } from 'express';

/** Keep API data out of browser/proxy caches and search engines; force HTTPS clients. */
export function noTraceHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  // Browsers that hit the API over HTTPS must keep using HTTPS.
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  );
  next();
}
