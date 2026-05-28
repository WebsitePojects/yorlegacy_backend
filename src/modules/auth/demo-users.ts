import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { AppRole, SessionUser } from '../../types/auth';

type DemoUserRecord = SessionUser & {
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

export function getDemoCredentials(): Record<AppRole, { email: string; password: string }> {
  return {
    member: {
      email: env.DEMO_MEMBER_EMAIL,
      password: env.DEMO_MEMBER_PASSWORD
    },
    admin: {
      email: env.DEMO_ADMIN_EMAIL,
      password: env.DEMO_ADMIN_PASSWORD
    }
  };
}
