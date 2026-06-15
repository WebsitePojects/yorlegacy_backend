import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { SessionPayload, SessionUser } from '../../types/auth';

export const SESSION_COOKIE_NAME = 'yor_session';
export const CSRF_COOKIE_NAME = 'yor_csrf';

// Add `Secure` on production (HTTPS) so cookies never transit over plain HTTP.
// Omitted on local sandbox/dev (HTTP) where Secure would block the cookie.
const COOKIE_SECURE = env.YOR_RUNTIME_MODE === 'production' ? '; Secure' : '';

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return crypto
    .createHmac('sha256', env.APP_SESSION_SECRET)
    .update(value)
    .digest('base64url');
}

// Length-safe, constant-time string equality for secrets/tokens.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// In-memory revocation store: userId → ms timestamp when sessions were invalidated.
// Any token with iat < revokedAt[userId] is treated as expired.
const revokedAt = new Map<string, number>();
const REVOCATION_PURGE_MS = 48 * 60 * 60 * 1000; // 48 h — max possible session lifetime

export function revokeUserSessions(userId: string): void {
  revokedAt.set(userId, Date.now());
  const cutoff = Date.now() - REVOCATION_PURGE_MS;
  for (const [uid, ts] of revokedAt) {
    if (ts < cutoff) revokedAt.delete(uid);
  }
}

export function createSessionToken(user: SessionUser, rememberMe?: boolean): string {
  const now = Date.now();
  const ttl = rememberMe ? 30 * 24 * 60 * 60 * 1000 : env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const payload: SessionPayload = {
    ...user,
    iat: now,
    exp: now + ttl
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload);

  // Constant-time compare to avoid leaking the signature via timing.
  if (!timingSafeStringEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

    if (!payload.exp || payload.exp <= Date.now()) {
      return null;
    }

    const revoked = revokedAt.get(payload.id);
    if (revoked && (!payload.iat || payload.iat < revoked)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string, rememberMe?: boolean): string {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : env.SESSION_TTL_HOURS * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${COOKIE_SECURE}; Max-Age=${maxAge}`;
}

export function createExpiredSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${COOKIE_SECURE}; Max-Age=0`;
}

export function createCsrfToken(): string {
  return crypto.randomUUID();
}

export function createCsrfCookie(token: string, rememberMe?: boolean): string {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : env.SESSION_TTL_HOURS * 60 * 60;
  return `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Lax${COOKIE_SECURE}; Max-Age=${maxAge}`;
}

export function createExpiredCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Path=/; SameSite=Lax${COOKIE_SECURE}; Max-Age=0`;
}

export function readCookie(headerValue: string | undefined, name: string): string | null {
  if (!headerValue) {
    return null;
  }

  const parts = headerValue.split(';');

  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) {
      return rest.join('=');
    }
  }

  return null;
}
