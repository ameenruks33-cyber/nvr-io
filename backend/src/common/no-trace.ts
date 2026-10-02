import type { NextFunction, Request, Response } from 'express';

/** Keep API data out of browser/proxy caches and search engines. */
export function noTraceHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
}
