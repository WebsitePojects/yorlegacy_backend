import type { NextFunction, Request, Response } from 'express';
import { readCookie, SESSION_COOKIE_NAME, verifySessionToken } from './session.js';
import type { AppRole, SessionUser } from '../../types/auth';

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: SessionUser | null;
  }
}

export function attachAuthUser(req: Request, _res: Response, next: NextFunction): void {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  const payload = token ? verifySessionToken(token) : null;

  req.authUser = payload
    ? {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role
      }
    : null;

  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({
        message: 'Insufficient access'
      });
      return;
    }

    next();
  };
}
