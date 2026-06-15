// GATE-VOUCHER-B1T1-20260615: Buy-1-Take-1 voucher inventory types.
export type VoucherStatus = 'available' | 'used' | 'suspended' | 'expired';

export type VoucherRecord = {
  id: string;
  voucherCode: string;
  beneficiaryUserId: string | null;
  beneficiaryUsername: string;
  beneficiaryFullName: string | null;
  packageTier: string;
  quantity: number;
  remaining: number;
  status: VoucherStatus;
  grantedByUserId: string | null;
  grantedByLabel: string | null;
  remarks: string | null;
  issuedAt: string;
  expiresAt: string | null;
  updatedAt: string;
};

export type GrantVoucherInput = {
  beneficiaryUsername: string;
  packageTier: string;
  quantity: number;
  expiresAt?: string | null;
  remarks?: string | null;
};

export type VoucherListFilter = {
  status?: VoucherStatus | 'all';
  search?: string;
};

export type VoucherStats = {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  fullyUsed: number;
};

export type VoucherCenter = {
  stats: VoucherStats;
  vouchers: VoucherRecord[];
};
