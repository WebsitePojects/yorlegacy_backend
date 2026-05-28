import { findMemberProfileByUserId } from '../auth/app-users.js';
import type { MemberOfficeData, SessionUser } from '../../types/auth';

export async function buildMemberOffice(user: SessionUser): Promise<MemberOfficeData> {
  const profile = await findMemberProfileByUserId(user.id);

  return {
    user,
    wallet: {
      availableBalance: 'PHP 0.00',
      pendingBalance: 'PHP 0.00',
      payoutSchedule: 'Tuesday encashment / Friday payout'
    },
    profile: {
      packageTier: profile?.packageTier ?? 'Standard',
      referralCode: profile?.referralCode ?? 'YOR-MEMBER-PLACEHOLDER',
      sponsorCode: profile?.sponsorCode ?? 'YOR-SPONSOR-PLACEHOLDER',
      accountStatus: profile?.accountStatus ?? 'active'
    },
    actions: [
      'Review package and activation status',
      'Track upcoming payout windows',
      'Monitor referral and binary readiness',
      'Prepare compliance-safe member profile details'
    ],
    alerts: [
      'Wallet and payout values are placeholder-backed until the full Nogatu finance engine is ported.',
      'Referral, pairing, and encashment rules must still be verified against the documented credit layer before production use.'
    ]
  };
}
