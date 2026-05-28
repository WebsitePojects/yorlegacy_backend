import { findAdminProfileByUserId } from '../auth/app-users.js';
import type { SessionUser } from '../../types/auth';

export async function buildAdminSummary(user: SessionUser) {
  const profile = await findAdminProfileByUserId(user.id);

  return {
    user,
    modules: [
      'public site control',
      'member access oversight',
      'content management seed parity',
      'security and role verification'
    ],
    status: {
      authentication: 'active',
      protectedRoutes: 'enabled',
      accessScope: profile?.accessScope ?? 'platform',
      officeTitle: profile?.officeTitle ?? 'Operations Admin',
      operationalNote:
        'Financial engines still need full Nogatu-to-Yor backend migration before production payout operations.'
    }
  };
}
