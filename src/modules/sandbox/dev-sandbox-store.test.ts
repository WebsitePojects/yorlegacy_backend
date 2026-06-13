import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateSandboxActivationCodes,
  listSandboxActivationRows,
  resetSandboxState
} from './dev-sandbox-store.js';
import type { SessionUser } from '../../types/auth.js';

const admin: SessionUser = {
  id: 'admin-user',
  name: 'Admin',
  email: 'admin@yor.local',
  role: 'admin'
};

describe('dev sandbox activation-code generation', () => {
  beforeEach(() => {
    resetSandboxState();
  });

  afterEach(() => {
    resetSandboxState();
  });

  it('generates normalized account/package prefixes with six-digit sequences', () => {
    generateSandboxActivationCodes(admin, 2, 'Basic', 'yor01', 'PD');
    generateSandboxActivationCodes(admin, 1, 'VIP', undefined, 'FS');

    const codes = listSandboxActivationRows().map((row) => row.code);

    expect(codes).toContain('PDBA000001');
    expect(codes).toContain('PDBA000002');
    expect(codes).toContain('FSVI000001');
  });
});
