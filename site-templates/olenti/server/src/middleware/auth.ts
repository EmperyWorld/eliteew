import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { prisma } from '../index.js';
import { AppError } from './errorHandler.js';

export type AuthRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const [key, ...value] = cookie.trim().split('=');
      return [key, decodeURIComponent(value.join('='))];
    })
  );
}

function getTokenFromCookies(req: Request) {
  const cookies = parseCookies(req.headers.cookie);
  const isAdminRequest = req.path.startsWith('/api/admin');

  if (isAdminRequest) {
    return cookies['admin_auth_token'] || cookies['site_auth_token'] || cookies['auth_token'];
  }

  return cookies['site_auth_token'] || cookies['admin_auth_token'] || cookies['auth_token'];
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = getTokenFromCookies(req);
    }

    if (!token) {
      throw new AppError('Unauthorized', 401);
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Invalid token', 401));
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('Admin access required', 403));
  }
  next();
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = getTokenFromCookies(req);
  }

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      // Не падаем для гостевых запросов, но не доверяем токен без секрета
      console.warn('JWT_SECRET is not configured; skipping optional auth');
      return next();
    }

    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email!,
        role: user.role,
      };
    }
  } catch (error) {
    // Ignore auth errors and proceed as guest
    console.warn(
      'Optional auth failed, proceeding as guest:',
      error instanceof Error ? error.message : error
    );
  }

  next();
}
