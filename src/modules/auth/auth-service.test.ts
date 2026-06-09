import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findAppUserByUsername,
  authenticateDemoUser,
  verifyPassword,
  isProductionMode
} = vi.hoisted(() => ({
  findAppUserByUsername: vi.fn(),
  authenticateDemoUser: vi.fn(),
  verifyPassword: vi.fn(),
  isProductionMode: vi.fn()
}));

vi.mock('./app-users.js', () => ({
  findAppUserByUsername
}));

vi.mock('./demo-users.js', () => ({
  authenticateDemoUser
}));

vi.mock('./password.js', () => ({
  verifyPassword
}));

vi.mock('../production/runtime.js', () => ({
  isProductionMode
}));

import { authenticateUser } from './auth-service.js';

describe('authenticateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isProductionMode.mockReturnValue(false);
  });

  it('does not fall back to demo users in production mode', async () => {
    findAppUserByUsername.mockResolvedValue(null);
    authenticateDemoUser.mockReturnValue({
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.test',
      role: 'admin'
    });
    isProductionMode.mockReturnValue(true);

    const result = await authenticateUser('yoradmin', '1');

    expect(result).toBeNull();
    expect(authenticateDemoUser).not.toHaveBeenCalled();
  });

  it('still falls back to demo users outside production mode', async () => {
    findAppUserByUsername.mockResolvedValue(null);
    authenticateDemoUser.mockReturnValue({
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.test',
      role: 'admin'
    });

    const result = await authenticateUser('yoradmin', '1');

    expect(result).toEqual({
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.test',
      role: 'admin'
    });
    expect(authenticateDemoUser).toHaveBeenCalledWith('yoradmin', '1');
  });

  it('authenticates persisted users with the stored password hash', async () => {
    findAppUserByUsername.mockResolvedValue({
      id: 'real-user',
      name: 'Yor Admin',
      email: 'yoradmin@example.test',
      role: 'admin',
      status: 'active',
      passwordHash: 'hash',
      passwordSalt: 'salt'
    });
    verifyPassword.mockResolvedValue(true);

    const result = await authenticateUser('yoradmin', '1');

    expect(result).toEqual({
      id: 'real-user',
      name: 'Yor Admin',
      email: 'yoradmin@example.test',
      role: 'admin'
    });
    expect(verifyPassword).toHaveBeenCalledWith('1', 'salt', 'hash');
  });
});
