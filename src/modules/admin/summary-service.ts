import { findAdminProfileByUserId } from '../auth/app-users.js';
import { buildOpsOfficeSnapshot } from '../operations/hybrid-operational-data.js';
import { isSandboxMode } from '../sandbox/dev-sandbox-store.js';
import type { SessionUser } from '../../types/auth';

export async function buildAdminSummary(user: SessionUser) {
  const profile = await findAdminProfileByUserId(user.id);
  const office = buildOpsOfficeSnapshot(user, profile);

  return {
    user,
    modules: office.modules.map((module) => module.label),
    status: {
      authentication: 'active',
      protectedRoutes: 'enabled',
      accessScope: office.profile.accessScope,
      officeTitle: office.profile.officeTitle,
      visibleModules: String(office.modules.length),
      moneyActions: isSandboxMode() ? 'branch sandbox writes enabled' : 'playground reports-first',
      operationalSource: 'hybrid legacy parity seed'
    }
  };
}
