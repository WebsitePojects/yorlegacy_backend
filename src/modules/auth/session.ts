import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { SessionPayload, SessionUser } from '../../types/auth';

export const SESSION_COOKIE_NAME = 'yor_session';

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

export function createSessionToken(user: SessionUser, rememberMe?: boolean): string {
  const ttl = rememberMe ? 30 * 24 * 60 * 60 * 1000 : env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + ttl
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

  if (signature !== expected) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

    if (!payload.exp || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string, rememberMe?: boolean): string {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : env.SESSION_TTL_HOURS * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function createExpiredSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
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
