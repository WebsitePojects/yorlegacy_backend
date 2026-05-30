import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getAllowedFrontendOrigins } from '../config/env.js';

export function applyRequestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const origin = req.headers.origin ?? 'n/a';

    console.info(
      `[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms) origin=${origin}`
    );
  });

  next();
}

export function applyCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedFrontendOrigins();
  const normalizeOrigin = (value: string) => value.replace(/\/+$/, '');
  const requestedHeaders = req.headers['access-control-request-headers'];

  if (
    origin &&
    allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizeOrigin(origin))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      typeof requestedHeaders === 'string' && requestedHeaders.trim().length > 0
        ? requestedHeaders
        : 'Content-Type, Authorization'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  } else if (origin) {
    console.warn(
      `Blocked CORS request from origin=${origin}. Allowed origins: ${allowedOrigins.join(', ')}`
    );
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
