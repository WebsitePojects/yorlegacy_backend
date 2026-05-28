import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function applyRequestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');

  next();
}

export function applyCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (origin && origin === env.FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
