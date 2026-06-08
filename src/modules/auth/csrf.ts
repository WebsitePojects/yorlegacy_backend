import type { NextFunction, Request, Response } from 'express';
import { getAllowedFrontendOrigins } from '../../config/env.js';
import { CSRF_COOKIE_NAME, readCookie } from './session.js';

const OFFICE_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const OFFICE_PREFIXES = ['/api/member', '/api/admin'];
const CSRF_HEADER_NAME = 'x-yor-csrf-token';

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

function isAllowedOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  return getAllowedFrontendOrigins().some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalized);
}

function requiresOfficeCsrf(req: Request): boolean {
  return (
    Boolean(req.authUser) &&
    OFFICE_WRITE_METHODS.has(req.method.toUpperCase()) &&
    OFFICE_PREFIXES.some((prefix) => req.path.startsWith(prefix))
  );
}

export function enforceOfficeCsrf(req: Request, res: Response, next: NextFunction): void {
  if (!requiresOfficeCsrf(req)) {
    next();
    return;
  }

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  if (origin && !isAllowedOrigin(origin)) {
    res.status(403).json({ message: 'Office write blocked because the request origin is not allowed.' });
    return;
  }

  const cookieToken = readCookie(req.headers.cookie, CSRF_COOKIE_NAME);
  const headerToken = req.header(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ message: 'Office write blocked because the CSRF token is missing or invalid.' });
    return;
  }

  next();
}
