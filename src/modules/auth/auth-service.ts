import { findAppUserByUsername } from './app-users.js';
import { authenticateDemoUser } from './demo-users.js';
import { verifyPassword } from './password.js';
import { isProductionMode } from '../production/runtime.js';
import type { SessionUser } from '../../types/auth';

export async function authenticateUser(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const persistedUser = await findAppUserByUsername(username);

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

  if (isProductionMode()) {
    return null;
  }

  return authenticateDemoUser(username, password);
}
