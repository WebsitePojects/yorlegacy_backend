import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { AppRole, SessionUser } from '../../types/auth';

type DemoUserRecord = SessionUser & {
  password: string;
};

type DemoCredential = {
  username: string;
  password: string;
};

const demoUsers: (DemoUserRecord & { username: string })[] = [
  {
    id: 'yor-member-demo',
    role: 'member',
    name: env.DEMO_MEMBER_NAME,
    email: env.DEMO_MEMBER_EMAIL.toLowerCase(),
    username: 'YOR0001',
    password: env.DEMO_MEMBER_PASSWORD
  },
  {
    id: 'yor-admin-demo',
    role: 'admin',
    name: env.DEMO_ADMIN_NAME,
    email: env.DEMO_ADMIN_EMAIL.toLowerCase(),
    username: 'yoradmin',
    password: env.DEMO_ADMIN_PASSWORD
  },
  {
    id: 'yor-cashier-demo',
    role: 'cashier',
    name: env.DEMO_CASHIER_NAME,
    email: env.DEMO_CASHIER_EMAIL.toLowerCase(),
    username: 'yorcashier',
    password: env.DEMO_CASHIER_PASSWORD
  },
  {
    id: 'yor-bod-demo',
    role: 'bod',
    name: env.DEMO_BOD_NAME,
    email: env.DEMO_BOD_EMAIL.toLowerCase(),
    username: 'yorbod',
    password: env.DEMO_BOD_PASSWORD
  },
  {
    id: 'yor-superadmin-demo',
    role: 'superadmin',
    name: env.DEMO_SUPERADMIN_NAME,
    email: env.DEMO_SUPERADMIN_EMAIL.toLowerCase(),
    username: 'yorsuperadmin',
    password: env.DEMO_SUPERADMIN_PASSWORD
  },
  {
    id: 'yor-member-legacy-demo',
    role: 'member',
    name: 'Yor Member',
    email: 'yormember@gmail.com',
    username: 'yormember',
    password: '1'
  },
  {
    id: 'yor-cashier-legacy-demo',
    role: 'cashier',
    name: 'Yor Cashier',
    email: 'yorcashier@gmail.com',
    username: 'yorcashier_legacy',
    password: '1'
  },
  {
    id: 'yor-bod-legacy-demo',
    role: 'bod',
    name: 'Yor BOD',
    email: 'yorbod@gmail.com',
    username: 'yorbod_legacy',
    password: '1'
  }
];

function constantTimeMatches(input: string, expected: string): boolean {
  const left = crypto.createHash('sha256').update(input).digest();
  const right = crypto.createHash('sha256').update(expected).digest();

  return crypto.timingSafeEqual(left, right);
}

export function authenticateDemoUser(
  username: string,
  password: string
): SessionUser | null {
  const normalizedUsername = username.trim().toLowerCase();
  const user = demoUsers.find((entry) => entry.username.toLowerCase() === normalizedUsername);

  if (!user || !constantTimeMatches(password, user.password)) {
    return null;
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}

export function getDemoCredentials(): Record<AppRole, DemoCredential> {
  return {
    member: {
      username: 'YOR0001',
      password: env.DEMO_MEMBER_PASSWORD
    },
    admin: {
      username: 'yoradmin',
      password: env.DEMO_ADMIN_PASSWORD
    },
    cashier: {
      username: 'yorcashier',
      password: env.DEMO_CASHIER_PASSWORD
    },
    bod: {
      username: 'yorbod',
      password: env.DEMO_BOD_PASSWORD
    },
    superadmin: {
      username: 'yorsuperadmin',
      password: env.DEMO_SUPERADMIN_PASSWORD
    }
  };
}
