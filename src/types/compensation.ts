export type MoneyMode = 'playground' | 'sandbox';

export type PackagePolicy = {
  code: 'BASIC' | 'CLASSIC' | 'STANDARD' | 'BUSINESS' | 'VIP';
  name: string;
  price: number;
  pv: number;
  directSellingPrice: number;
  directReferralBonus: number;
  salesmatchValue: number;
  salesmatchBinaryPoints: number;
  weeklySalesmatchCap: number;
  monthlySalesmatchCap: number;
  binaryCyclePercent?: number;
  lifestyleDailyCap?: number;
  lifestyleMonthlyCap?: number;
  lifestyleRepeatPurchase?: number;
};

export type EarningStreamPolicy = {
  id: string;
  label: string;
  source: string;
  basis: string;
  writeStatus: MoneyMode;
  unresolved: string[];
};

export type CompensationPolicy = {
  mode: MoneyMode;
  sourceReferences: string[];
  packages: PackagePolicy[];
  streams: EarningStreamPolicy[];
  unilevelPercentages: number[];
  globalBonusPoolPercent: number;
  walletTypes: string[];
  payoutSchedule: string;
  unresolvedDecisions: string[];
};

export type IncomeSimulationResult = {
  streamId: string;
  label: string;
  writeStatus: MoneyMode;
  simulatedGross: number;
  simulatedNet: number;
  capApplied: boolean;
  statusLabel: string;
  explanation: string;
  calculationTrace: string[];
  requiredEvidence: string[];
};

export type WalletLedgerEntry = {
  id: string;
  walletType: string;
  entryType: string;
  sourceReference: string;
  creditAmount: number;
  debitAmount: number;
  balanceAfter: number;
  status: string;
  processId: string;
};

export type TreeNode = {
  id: string;
  label: string;
  packageTier: string;
  status: string;
  children?: TreeNode[];
};

export type ShadowAccountState = 'reserved_shadow' | 'activated_shadow' | 'converted_full';

export type ShadowAccount = {
  id: string;
  owner: string;
  state: ShadowAccountState;
  placement: 'left' | 'right';
  walletEnabled: boolean;
  unilevelEnabled: boolean;
  binaryCycleEnabled: boolean;
  note: string;
};
