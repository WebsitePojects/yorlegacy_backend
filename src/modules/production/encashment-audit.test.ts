import { describe, expect, it } from 'vitest';

import { buildEncashmentAudit } from './encashment-audit.js';

const entry = (
  id: string,
  entryType: string,
  sourceReference: string,
  creditAmount: number,
  debitAmount: number,
  occurredAt: string
) => ({
  id,
  walletType: 'main',
  entryType,
  sourceReference,
  creditAmount,
  debitAmount,
  status: 'posted',
  occurredAt
});

describe('buildEncashmentAudit', () => {
  it('reconciles income sources and balances at the exact encashment debit', () => {
    const occurredAt = '2026-06-30T08:00:00.000Z';
    const result = buildEncashmentAudit(
      [
        entry('1', 'direct_referral', 'DR-1', 5_000, 0, '2026-06-28T08:00:00.000Z'),
        entry('2', 'salesmatch', 'SM-1', 7_500, 0, occurredAt),
        entry('3', 'encashment', 'ENC-1', 0, 8_000, occurredAt),
        entry('4', 'adjustment', 'REFUND-OLD', 0, 500, occurredAt),
        entry('5', 'adjustment', 'ENC-1', 8_000, 0, '2026-07-01T08:00:00.000Z')
      ],
      { id: 'ENC-1', grossAmount: 8_000 }
    );

    expect(result.incomeSources).toEqual([
      { type: 'direct_referral', amount: 5_000 },
      { type: 'salesmatch', amount: 7_500 }
    ]);
    expect(result.totalIncomeCredits).toBe(12_500);
    expect(result.priorDebits).toBe(0);
    expect(result.balanceBefore).toBe(12_500);
    expect(result.grossDebit).toBe(8_000);
    expect(result.balanceAfter).toBe(4_500);
    expect(result.currentBalance).toBe(12_000);
    expect(result.laterRestorations).toBe(8_000);
    expect(result.reconciliationDifference).toBe(0);
    expect(result.reconciled).toBe(true);
  });

  it('reports an unavailable snapshot when the exact debit is absent', () => {
    const result = buildEncashmentAudit(
      [entry('1', 'direct_referral', 'DR-1', 5_000, 0, '2026-06-28T08:00:00.000Z')],
      { id: 'ENC-MISSING', grossAmount: 800 }
    );

    expect(result.reconciled).toBe(false);
    expect(result.snapshotAvailable).toBe(false);
    expect(result.reconciliationDifference).toBe(-800);
  });
});
