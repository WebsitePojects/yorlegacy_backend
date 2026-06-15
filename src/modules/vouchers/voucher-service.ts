// GATE-VOUCHER-B1T1-20260615: business logic for Buy-1-Take-1 vouchers.
// Routes stay thin; all voucher rules live here. Admin-only surface for now
// (grant / suspend / list / view); member-side redemption is a separate pass.
import { findAppUserByUsername } from '../auth/app-users.js';
import type { SessionUser } from '../../types/auth.js';
import { voucherRepository } from './voucher-repository.js';
import type {
  GrantVoucherInput,
  VoucherCenter,
  VoucherRecord,
  VoucherStatus
} from './voucher-types.js';

const VALID_PACKAGE_TIERS = new Set(['Basic', 'Classic', 'Standard', 'Business', 'VIP']);
const MAX_QUANTITY = 100;

// A voucher past its expiry is reported as expired regardless of its stored
// status (unless already suspended/used), without needing a background mutation.
function effectiveStatus(voucher: VoucherRecord, now: number): VoucherStatus {
  if (voucher.status === 'suspended' || voucher.status === 'used') {
    return voucher.status;
  }
  if (voucher.remaining <= 0) {
    return 'used';
  }
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < now) {
    return 'expired';
  }
  return 'available';
}

function normalizePackageTier(input: string): string {
  const trimmed = input.trim();
  const match = [...VALID_PACKAGE_TIERS].find((tier) => tier.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

export const voucherService = {
  async getVoucherCenter(): Promise<VoucherCenter> {
    const vouchers = await voucherRepository.list();
    const now = Date.now();
    const withEffective = vouchers.map((voucher) => ({
      ...voucher,
      status: effectiveStatus(voucher, now)
    }));

    const stats = {
      total: withEffective.length,
      active: withEffective.filter((v) => v.status === 'available').length,
      expired: withEffective.filter((v) => v.status === 'expired').length,
      suspended: withEffective.filter((v) => v.status === 'suspended').length,
      fullyUsed: withEffective.filter((v) => v.status === 'used').length
    };

    return { stats, vouchers: withEffective };
  },

  async grantVoucher(actor: SessionUser, input: GrantVoucherInput): Promise<VoucherRecord> {
    const username = input.beneficiaryUsername?.trim();
    if (!username) {
      throw new Error('A beneficiary username is required.');
    }

    const quantity = Math.floor(Number(input.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new Error(`Quantity must be between 1 and ${MAX_QUANTITY}.`);
    }

    const packageTier = normalizePackageTier(input.packageTier ?? '');
    if (!VALID_PACKAGE_TIERS.has(packageTier)) {
      throw new Error('Select a valid package tier (Basic, Classic, Standard, Business, VIP).');
    }

    // A voucher can be granted to any user in the userbase.
    const beneficiary = await findAppUserByUsername(username);
    if (!beneficiary) {
      throw new Error(`No user found with username "${username}".`);
    }

    let expiresAt: string | null = null;
    if (input.expiresAt) {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Expiry date is invalid.');
      }
      if (parsed.getTime() < Date.now()) {
        throw new Error('Expiry date cannot be in the past.');
      }
      expiresAt = parsed.toISOString();
    }

    // Sequential code (VCH-00001…). `count + 1` is not concurrency-safe, so retry on a
    // unique-constraint conflict (re-reading the count each attempt) before giving up.
    let created: VoucherRecord | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const count = await voucherRepository.countAll();
      const voucherCode = `VCH-${String(count + 1 + attempt).padStart(5, '0')}`;
      try {
        created = await voucherRepository.insert({
          voucherCode,
          beneficiaryUserId: beneficiary.id,
          beneficiaryUsername: username,
          beneficiaryFullName: beneficiary.name ?? null,
          packageTier,
          quantity,
          grantedByUserId: actor.id,
          grantedByLabel: actor.name ?? actor.email ?? 'admin',
          remarks: input.remarks?.slice(0, 200) ?? null,
          expiresAt
        });
      } catch (error) {
        // Duplicate voucher_code under concurrency — retry with a fresh count.
        if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    if (!created) {
      throw new Error(
        lastError instanceof Error
          ? 'Could not allocate a unique voucher code, please try again.'
          : 'Voucher service is unavailable because Supabase is not configured.'
      );
    }
    return created;
  },

  async suspendVoucher(_actor: SessionUser, id: string): Promise<VoucherRecord> {
    const voucher = await voucherRepository.findById(id);
    if (!voucher) {
      throw new Error('Voucher not found.');
    }
    if (voucher.status === 'used' || voucher.remaining <= 0) {
      throw new Error('A fully-used voucher cannot be suspended.');
    }
    const updated = await voucherRepository.updateStatus(id, 'suspended');
    if (!updated) {
      throw new Error('Unable to suspend voucher.');
    }
    return updated;
  },

  async reactivateVoucher(_actor: SessionUser, id: string): Promise<VoucherRecord> {
    const voucher = await voucherRepository.findById(id);
    if (!voucher) {
      throw new Error('Voucher not found.');
    }
    if (voucher.status !== 'suspended') {
      throw new Error('Only a suspended voucher can be reactivated.');
    }
    const updated = await voucherRepository.updateStatus(id, 'available');
    if (!updated) {
      throw new Error('Unable to reactivate voucher.');
    }
    return updated;
  },

  async getVoucher(id: string): Promise<VoucherRecord | null> {
    return voucherRepository.findById(id);
  }
};
