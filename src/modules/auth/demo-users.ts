import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { AppRole, SessionUser } from '../../types/auth';

type DemoUserRecord = SessionUser & {
  password: string;
};

type DemoCredential = {
  email: string;
  password: string;
};

const demoUsers: DemoUserRecord[] = [
  {
    id: 'yor-member-demo',
    role: 'member',
    name: env.DEMO_MEMBER_NAME,
    email: env.DEMO_MEMBER_EMAIL.toLowerCase(),
    password: env.DEMO_MEMBER_PASSWORD
  },
  {
    id: 'yor-admin-demo',
    role: 'admin',
    name: env.DEMO_ADMIN_NAME,
    email: env.DEMO_ADMIN_EMAIL.toLowerCase(),
    password: env.DEMO_ADMIN_PASSWORD
  },
  {
    id: 'yor-cashier-demo',
    role: 'cashier',
    name: env.DEMO_CASHIER_NAME,
    email: env.DEMO_CASHIER_EMAIL.toLowerCase(),
    password: env.DEMO_CASHIER_PASSWORD
  },
  {
    id: 'yor-bod-demo',
    role: 'bod',
    name: env.DEMO_BOD_NAME,
    email: env.DEMO_BOD_EMAIL.toLowerCase(),
    password: env.DEMO_BOD_PASSWORD
  },
  {
    id: 'yor-superadmin-demo',
    role: 'superadmin',
    name: env.DEMO_SUPERADMIN_NAME,
    email: env.DEMO_SUPERADMIN_EMAIL.toLowerCase(),
    password: env.DEMO_SUPERADMIN_PASSWORD
  },
  {
    id: 'yor-member-legacy-demo',
    role: 'member',
    name: 'Yor Member',
    email: 'yormember@gmail.com',
    password: '1'
  },
  {
    id: 'yor-cashier-legacy-demo',
    role: 'cashier',
    name: 'Yor Cashier',
    email: 'yorcashier@gmail.com',
    password: '1'
  },
  {
    id: 'yor-bod-legacy-demo',
    role: 'bod',
    name: 'Yor BOD',
    email: 'yorbod@gmail.com',
    password: '1'
  }
];

function constantTimeMatches(input: string, expected: string): boolean {
  const left = crypto.createHash('sha256').update(input).digest();
  const right = crypto.createHash('sha256').update(expected).digest();

  return crypto.timingSafeEqual(left, right);
}

export function authenticateDemoUser(
  email: string,
  password: string
): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const user = demoUsers.find((entry) => entry.email === normalizedEmail);

  if (!user || !constantTimeMatches(password, user.password)) {
    return null;
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}

export function getDemoCredentials(): Record<AppRole, DemoCredential> {
  return {
    member: {
      email: env.DEMO_MEMBER_EMAIL,
      password: env.DEMO_MEMBER_PASSWORD
    },
    admin: {
      email: env.DEMO_ADMIN_EMAIL,
      password: env.DEMO_ADMIN_PASSWORD
    },
    cashier: {
      email: env.DEMO_CASHIER_EMAIL,
      password: env.DEMO_CASHIER_PASSWORD
    },
    bod: {
      email: env.DEMO_BOD_EMAIL,
      password: env.DEMO_BOD_PASSWORD
    },
    superadmin: {
      email: env.DEMO_SUPERADMIN_EMAIL,
      password: env.DEMO_SUPERADMIN_PASSWORD
    }
  };
}
