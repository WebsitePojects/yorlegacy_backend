import { findMemberProfileByUserId } from '../auth/app-users.js';
import { buildMemberOfficeSnapshot } from '../operations/hybrid-operational-data.js';
import { isSandboxMode } from '../sandbox/dev-sandbox-store.js';
import type { SessionUser } from '../../types/auth';

export async function buildMemberSummary(user: SessionUser) {
  const profile = await findMemberProfileByUserId(user.id);
  const office = buildMemberOfficeSnapshot(user, profile);

  return {
    user,
    modules: office.modules.map((module) => module.label),
    status: {
      authentication: 'active',
      packageTier: office.profile.packageTier,
      accountStatus: office.profile.accountStatus,
      referralCode: office.profile.referralCode,
      sponsorCode: office.profile.sponsorCode,
      visibleModules: String(office.modules.length),
      walletRulesSource: 'legacy parity report-first layer',
      payouts: isSandboxMode()
        ? 'Tuesday encashment / Friday payout, controlled runtime writes'
        : 'Tuesday encashment / Friday payout, review-mode writes'
    }
  };
}
