import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'middleware',
  points: Number(process.env.RATE_LIMIT_POINTS || 10000),
  duration: Number(process.env.RATE_LIMIT_WINDOW || 60),
});

const SKIP_PREFIXES = ['/admin', '/settings'];

export const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  if (SKIP_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }

  rateLimiter
    .consume(req.ip || 'unknown')
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).json({ success: false, message: 'Too Many Requests' });
    });
};
