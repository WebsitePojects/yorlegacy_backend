export type EncashmentAuditEntry = {
  id: string;
  walletType: string;
  entryType: string;
  sourceReference: string;
  creditAmount: number;
  debitAmount: number;
  balanceAfter?: number | null;
  status: string;
  occurredAt: string;
};

export type EncashmentAudit = {
  snapshotAvailable: boolean;
  incomeSources: Array<{ type: string; amount: number }>;
  totalIncomeCredits: number;
  priorDebits: number;
  balanceBefore: number;
  grossDebit: number;
  balanceAfter: number;
  currentBalance: number;
  laterRestorations: number;
  reconciliationDifference: number;
  reconciled: boolean;
};

const money = (value: number) => Number(value.toFixed(2));

export function buildEncashmentAudit(
  entries: EncashmentAuditEntry[],
  encashment: { id: string; grossAmount: number }
): EncashmentAudit {
  const mainEntries = entries.filter((entry) => entry.walletType === 'main' && entry.status === 'posted');
  const debitIndex = mainEntries.findIndex(
    (entry) => entry.entryType === 'encashment' && entry.sourceReference === encashment.id
  );
  const boundaryEntries = debitIndex >= 0 ? mainEntries.slice(0, debitIndex + 1) : mainEntries;
  const beforeEntries = debitIndex >= 0 ? boundaryEntries.slice(0, -1) : boundaryEntries;
  const sourceTotals = new Map<string, number>();

  for (const entry of beforeEntries) {
    if (entry.creditAmount > 0) {
      sourceTotals.set(entry.entryType, money((sourceTotals.get(entry.entryType) ?? 0) + entry.creditAmount));
    }
  }

  const totalIncomeCredits = money(beforeEntries.reduce((sum, entry) => sum + entry.creditAmount, 0));
  const priorDebits = money(beforeEntries.reduce((sum, entry) => sum + entry.debitAmount, 0));
  const calculatedBalanceBefore = money(totalIncomeCredits - priorDebits);
  const debitEntry = debitIndex >= 0 ? mainEntries[debitIndex] : undefined;
  const grossDebit = money(debitEntry?.debitAmount ?? encashment.grossAmount);
  const storedBalanceAfter = debitEntry?.balanceAfter;
  const balanceAfter = Number.isFinite(storedBalanceAfter)
    ? money(Number(storedBalanceAfter))
    : money(calculatedBalanceBefore - grossDebit);
  const balanceBefore = Number.isFinite(storedBalanceAfter)
    ? money(balanceAfter + grossDebit)
    : calculatedBalanceBefore;
  const currentBalance = money(mainEntries.reduce((sum, entry) => sum + entry.creditAmount - entry.debitAmount, 0));
  const laterRestorations = money(
    (debitIndex >= 0 ? mainEntries.slice(debitIndex + 1) : [])
      .filter((entry) => entry.sourceReference === encashment.id && entry.creditAmount > 0)
      .reduce((sum, entry) => sum + entry.creditAmount, 0)
  );
  const reconciliationDifference = money(balanceBefore - grossDebit - balanceAfter);
  const snapshotAvailable = Boolean(debitEntry);

  return {
    snapshotAvailable,
    incomeSources: [...sourceTotals.entries()].map(([type, amount]) => ({ type, amount })),
    totalIncomeCredits,
    priorDebits,
    balanceBefore,
    grossDebit,
    balanceAfter,
    currentBalance,
    laterRestorations,
    reconciliationDifference: snapshotAvailable ? reconciliationDifference : money(-encashment.grossAmount),
    reconciled: snapshotAvailable && Math.abs(reconciliationDifference) < 0.01
  };
}
