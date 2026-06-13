import { findMemberProfileByUserId } from '../auth/app-users.js';
import { buildMemberOfficeSnapshot } from '../operations/hybrid-operational-data.js';
import { getProductionEncodingService, isProductionMode } from '../production/runtime.js';
import type { MemberOfficeData, SessionUser } from '../../types/auth';

const php = (v: number) =>
  `PHP ${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildMemberOffice(user: SessionUser): Promise<MemberOfficeData> {
  const profile = await findMemberProfileByUserId(user.id);
  const snapshot = buildMemberOfficeSnapshot(user, profile);

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const [binary, walletData] = await Promise.all([
          service.getMemberBinaryBalance(user.id),
          service.buildMemberWalletData(user.id, 0)
        ]);
        if (binary) {
          snapshot.metrics = snapshot.metrics.map((m) => {
            if (m.label === 'Left Points') return { ...m, value: String(binary.leftPoints) };
            if (m.label === 'Right Points') return { ...m, value: String(binary.rightPoints) };
            return m;
          });
        }
        snapshot.wallet = {
          availableBalance: php(walletData.summary.availableBalance),
          pendingBalance: php(walletData.summary.pendingBalance),
          payoutSchedule: 'Tuesday encashment / Friday payout'
        };
      } catch {
        // Supabase unavailable — keep demo snapshot rather than crashing login
      }
    }
  }

  return snapshot;
}
