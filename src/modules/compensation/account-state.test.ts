import { describe, expect, it } from 'vitest';
import { accountStateLabel, countsForDirectReferralSource, countsForPairingSource, isCdFullyPaid } from './account-state.js';

const base = { accountType: 'PD' as const, paymentStatus: 'paid' as const, cdAmount: 0, cdTotal: 0, cdStatus: 0 };

describe('countsForPairingSource (owner ruling 2026-06-12 + Nogatu parity)', () => {
  it('PD paid counts', () => {
    expect(countsForPairingSource(base)).toBe(true);
  });

  it('PD externally-paid counts', () => {
    expect(countsForPairingSource({ ...base, paymentStatus: 'externally-paid' })).toBe(true);
  });

  it('PD unpaid does not count', () => {
    expect(countsForPairingSource({ ...base, paymentStatus: 'unpaid' })).toBe(false);
  });

  it('FS never counts, even when paid', () => {
    expect(countsForPairingSource({ ...base, accountType: 'FS', paymentStatus: 'paid' })).toBe(false);
    expect(countsForPairingSource({ ...base, accountType: 'FS', paymentStatus: 'externally-paid' })).toBe(false);
    expect(countsForPairingSource({ ...base, accountType: 'FS', paymentStatus: 'unpaid' })).toBe(false);
  });

  it('CD fully settled counts', () => {
    expect(countsForPairingSource({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 2500, cdStatus: 2 })).toBe(true);
  });

  it('CD settled flag with zero obligation counts', () => {
    expect(countsForPairingSource({ ...base, accountType: 'CD', cdAmount: 0, cdTotal: 0, cdStatus: 2 })).toBe(true);
  });

  it('CD unpaid does not count', () => {
    expect(
      countsForPairingSource({ ...base, accountType: 'CD', paymentStatus: 'unpaid', cdAmount: 2500, cdTotal: 1000, cdStatus: 1 })
    ).toBe(false);
  });

  it('CD with recovery below obligation does not count even when status flag says settled', () => {
    expect(countsForPairingSource({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 1000, cdStatus: 2 })).toBe(false);
  });
});

describe('countsForDirectReferralSource', () => {
  it('mirrors pairing-source eligibility', () => {
    expect(countsForDirectReferralSource(base)).toBe(true);
    expect(countsForDirectReferralSource({ ...base, accountType: 'FS' })).toBe(false);
    expect(countsForDirectReferralSource({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 2500, cdStatus: 2 })).toBe(true);
    expect(
      countsForDirectReferralSource({ ...base, accountType: 'CD', paymentStatus: 'unpaid', cdAmount: 2500, cdTotal: 0, cdStatus: 1 })
    ).toBe(false);
  });
});

describe('isCdFullyPaid', () => {
  it('requires the settled status flag', () => {
    expect(isCdFullyPaid({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 2500, cdStatus: 1 })).toBe(false);
  });

  it('requires recovery to reach the obligation', () => {
    expect(isCdFullyPaid({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 2499, cdStatus: 2 })).toBe(false);
    expect(isCdFullyPaid({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 2500, cdStatus: 2 })).toBe(true);
  });
});

describe('accountStateLabel', () => {
  it('labels match office display states', () => {
    expect(accountStateLabel(base)).toBe('PD');
    expect(accountStateLabel({ ...base, accountType: 'FS' })).toBe('FS');
    expect(accountStateLabel({ ...base, accountType: 'CD', cdAmount: 2500, cdTotal: 2500, cdStatus: 2 })).toBe('CD - Paid');
    expect(accountStateLabel({ ...base, accountType: 'CD', paymentStatus: 'unpaid', cdAmount: 2500, cdTotal: 0, cdStatus: 1 })).toBe(
      'CD - Unpaid'
    );
  });
});
