import { NextFunction, Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { AuthRequest } from './auth.js';

const adminLoginLimiter = new RateLimiterMemory({
  keyPrefix: 'admin_login',
  points: 5,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

const adminUploadLimiter = new RateLimiterMemory({
  keyPrefix: 'admin_upload',
  points: 10,
  duration: 60,
});

const adminBroadcastLimiter = new RateLimiterMemory({
  keyPrefix: 'admin_broadcast',
  points: 1,
  duration: 5 * 60,
});

const adminGeneralLimiter = new RateLimiterMemory({
  keyPrefix: 'admin_general',
  points: 100,
  duration: 60,
});

export const adminLoginRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  try {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.ip || 'unknown';
    await adminLoginLimiter.consume(ip);
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000) || 0;
    res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again in ${remainingTime} seconds.`,
      retryAfter: remainingTime,
    });
  }
};

export const adminUploadRateLimiter = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  try {
    const key = req.user?.id || req.ip || 'unknown';
    await adminUploadLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000) || 0;
    res.status(429).json({
      success: false,
      message: `Upload rate limit exceeded. Please try again in ${remainingTime} seconds.`,
      retryAfter: remainingTime,
    });
  }
};

export const adminBroadcastRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  try {
    const key = req.user?.id || req.ip || 'unknown';
    await adminBroadcastLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000) || 0;
    res.status(429).json({
      success: false,
      message: `Broadcast rate limit exceeded. Please try again in ${remainingTime} seconds.`,
      retryAfter: remainingTime,
    });
  }
};

export const adminGeneralRateLimiter = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  try {
    const key = req.user?.id || req.ip || 'unknown';
    await adminGeneralLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000) || 0;
    res.status(429).json({
      success: false,
      message: `Rate limit exceeded. Please try again in ${remainingTime} seconds.`,
      retryAfter: remainingTime,
    });
  }
};
