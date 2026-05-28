import { findMemberProfileByUserId } from '../auth/app-users.js';
import type { SessionUser } from '../../types/auth';

export async function buildMemberSummary(user: SessionUser) {
  const profile = await findMemberProfileByUserId(user.id);

  return {
    user,
    modules: [
      'public pages',
      'member dashboard',
      'package review',
      'earnings overview',
      'account readiness'
    ],
    status: {
      authentication: 'active',
      packageTier: profile?.packageTier ?? 'demo-or-unassigned',
      accountStatus: profile?.accountStatus ?? 'active',
      referralCode: profile?.referralCode ?? 'not-set',
      sponsorCode: profile?.sponsorCode ?? 'not-set',
      walletRulesSource: 'Nogatu parity pending deep port',
      payouts: 'presentation-ready, operational rules staged'
    }
  };
}
