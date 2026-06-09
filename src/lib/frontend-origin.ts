import { getAllowedFrontendOrigins } from '../config/env.js';

const LOCAL_FRONTEND_HOSTS = new Set(['localhost', '127.0.0.1']);

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function getPreferredFrontendOrigin(): string {
  const origins = getAllowedFrontendOrigins().map(normalizeOrigin).filter(Boolean);
  const localhostOrigin = origins.find((origin) => {
    try {
      return LOCAL_FRONTEND_HOSTS.has(new URL(origin).hostname);
    } catch {
      return false;
    }
  });

  if (localhostOrigin) {
    return localhostOrigin;
  }

  const publicOrigin = origins.find((origin) => {
    try {
      return new URL(origin).hostname === 'www.yorinternational.net';
    } catch {
      return false;
    }
  });

  if (publicOrigin) {
    return publicOrigin;
  }

  return origins[0] ?? 'https://www.yorinternational.net';
}

export function buildRegistrationUrl(params: URLSearchParams | Record<string, string | undefined | null>): string {
  const searchParams =
    params instanceof URLSearchParams
      ? params
      : Object.entries(params).reduce((acc, [key, value]) => {
          if (value != null && value !== '') {
            acc.set(key, value);
          }
          return acc;
        }, new URLSearchParams());

  const query = searchParams.toString();
  return `${getPreferredFrontendOrigin()}/register${query ? `?${query}` : ''}`;
}
