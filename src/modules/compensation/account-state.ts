// Nogatu-parity account-state eligibility (BUSINESSRULE BIN-01/DR-01, owner ruling 2026-06-12).
// FS never participates in pairing or DR sourcing — settlement does not convert FS.
// CD participates only once the Commission Deduction obligation is fully recovered
// (cdStatus settled flag AND recovery total >= obligation), mirroring
// NogatuMLM/Nogatu_Backend/services/accountState.js.
import type { AccountType, PaymentStatus } from '../production/encoding-service.js';

export type AccountStateInput = {
  accountType: AccountType;
  paymentStatus: PaymentStatus;
  cdAmount: number;
  cdTotal: number;
  cdStatus: number;
};

export const CD_STATUS_NONE = 0;
export const CD_STATUS_OUTSTANDING = 1;
export const CD_STATUS_SETTLED = 2;

export function isCdFullyPaid(state: AccountStateInput): boolean {
  if (state.cdStatus !== CD_STATUS_SETTLED) {
    return false;
  }
  if (state.cdAmount <= 0) {
    return true;
  }
  return state.cdTotal >= state.cdAmount;
}

function isEligibleSource(state: AccountStateInput): boolean {
  if (state.accountType === 'FS') {
    return false;
  }
  if (state.accountType === 'CD') {
    return isCdFullyPaid(state);
  }
  // PD: requires settled payment on the originating code.
  return state.paymentStatus !== 'unpaid';
}

export function countsForPairingSource(state: AccountStateInput): boolean {
  return isEligibleSource(state);
}

export function countsForDirectReferralSource(state: AccountStateInput): boolean {
  return isEligibleSource(state);
}

export function accountStateLabel(state: AccountStateInput): 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid' {
  if (state.accountType === 'FS') {
    return 'FS';
  }
  if (state.accountType === 'CD') {
    return isCdFullyPaid(state) ? 'CD - Paid' : 'CD - Unpaid';
  }
  return 'PD';
}
