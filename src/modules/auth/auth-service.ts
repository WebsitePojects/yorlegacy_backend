import { findAppUserByEmail } from './app-users.js';
import { authenticateDemoUser } from './demo-users.js';
import { verifyPassword } from './password.js';
import type { SessionUser } from '../../types/auth';

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const persistedUser = await findAppUserByEmail(email);

  if (persistedUser) {
    if (persistedUser.status !== 'active') {
      return null;
    }

    const matches = await verifyPassword(
      password,
      persistedUser.passwordSalt,
      persistedUser.passwordHash
    );

    if (matches) {
      return {
        id: persistedUser.id,
        name: persistedUser.name,
        email: persistedUser.email,
        role: persistedUser.role
      };
    }

    return null;
  }

  return authenticateDemoUser(email, password);
}
