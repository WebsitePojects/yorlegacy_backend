import { findAdminProfileByUserId } from '../auth/app-users.js';
import { buildOpsOfficeSnapshot } from '../operations/hybrid-operational-data.js';
import type { AdminOfficeData, SessionUser } from '../../types/auth';

export async function buildAdminOffice(user: SessionUser): Promise<AdminOfficeData> {
  const profile = await findAdminProfileByUserId(user.id);
  return buildOpsOfficeSnapshot(user, profile);
}
