import { findAdminProfileByUserId } from '../auth/app-users.js';
import type { AdminOfficeData, SessionUser } from '../../types/auth';

export async function buildAdminOffice(user: SessionUser): Promise<AdminOfficeData> {
  const profile = await findAdminProfileByUserId(user.id);

  return {
    user,
    metrics: [
      {
        label: 'Protected Modules',
        value: '4'
      },
      {
        label: 'Role Scope',
        value: profile?.accessScope ?? 'platform'
      },
      {
        label: 'Office Title',
        value: profile?.officeTitle ?? 'Operations Admin'
      }
    ],
    queues: [
      'Pending member verification queue',
      'Protected route audit queue',
      'Content and package parity review queue'
    ],
    controls: [
      'Review member access state',
      'Inspect public-content parity',
      'Prepare finance-module rollout checkpoints'
    ],
    notices: [
      'Admin office data is placeholder-backed until real member/admin operations are ported.',
      'No live money-moving action should be treated as production-safe until wallet, ledger, and encashment services are fully migrated.'
    ]
  };
}
