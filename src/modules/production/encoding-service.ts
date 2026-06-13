import crypto from 'node:crypto';
import {
  CD_STATUS_NONE,
  CD_STATUS_OUTSTANDING,
  CD_STATUS_SETTLED,
  countsForDirectReferralSource,
  countsForPairingSource,
  type AccountStateInput
} from '../compensation/account-state.js';
import { manilaDateKey, manilaMonthStartIso, manilaWeekStartIso } from '../compensation/cap-windows.js';
import { computeGetYorFiveGroups, type GyfDirect } from '../compensation/get-yor-five.js';
import { rankForIncome, type RankProgress } from '../compensation/rank-ladder.js';
import { packagePolicies, PV_PESO_RATE } from '../compensation/mvp-service.js';
import {
  repeatPurchaseProductCatalog,
  findProductByCodeFamily,
  lifestyleDailyCapByPackage,
  lifestyleMonthlyCapByPackage
} from '../compensation/repurchase-product-catalog.js';
import { createPasswordHashSync } from '../auth/password.js';
import type { MoneyMode, SessionUser } from '../../types/auth.js';
import { buildCanonicalReferralCode, decodeReferralCode, encodeReferralCode } from '../../lib/referral-utils.js';
import { buildRegistrationUrl } from '../../lib/frontend-origin.js';

export type PackageTier = 'Basic' | 'Classic' | 'Standard' | 'Business' | 'VIP';
export type CodeFamily = 'YOR CODES' | 'YOR MAINTENANCE' | 'YOR PERFUME' | 'YOR REFILL' | 'YOR VISION';
export type AccountType = 'PD' | 'FS' | 'CD';
export type ActivationCodeStatus = 'unreleased' | 'available' | 'used' | 'disabled';
export type PaymentStatus = 'unpaid' | 'paid' | 'externally-paid';
export type PlacementSide = 'left' | 'right';
export type RegistrationOrigin = 'referral-link' | 'genealogy-slot';
export type SponsorResolutionMode = 'referral-link' | 'manual-sponsor' | 'signed-in-member';
export type QueueEventType = 'placement-sales';

// Unilevel percentages per sponsor-tree depth (index = depth, index 0 = root earns nothing).
// Unilevel is triggered by monthly product repurchases (NOT registration encoding).
// Sponsor-tree levels map 1:1 to unilevel levels — shadow accounts never appear in the
// sponsor chain so no skipping is needed there. In the binary tree visual, real members
// appear at even depths (0, 2, 4 … 20), which correspond to logical levels 0-10 in the UI.
export const UNILEVEL_PERCENTAGES: readonly number[] = [0, 10, 8, 5, 5, 3, 3, 2, 1, 1, 1];
export const UNILEVEL_MAX_LEVELS = 10;

export type PackageConfig = {
  packageTier: PackageTier;
  accountType: AccountType;
  price: number;
  directReferralBonus: number;
  salesmatchValue: number;
  salesmatchBinaryPoints: number;
  binaryCyclePercent: number;
  getFiveAmount: number;
  binaryPoints: number;
  weeklySalesmatchCap: number;
  monthlySalesmatchCap: number;
};

const PACKAGE_CONFIGS = new Map<string, PackageConfig>(
  packagePolicies.map((policy) => {
    const packageTier = toPackageTier(policy.name);
    return [
      packageTier.toUpperCase(),
      {
        packageTier,
        accountType: packageTier === 'Business' || packageTier === 'VIP' ? 'FS' : 'PD',
        price: policy.price,
        directReferralBonus: policy.directReferralBonus,
        salesmatchValue: policy.salesmatchValue,
        salesmatchBinaryPoints: policy.salesmatchValue / PV_PESO_RATE,
        binaryCyclePercent: policy.binaryCyclePercent ?? 0,
        getFiveAmount: packageTier === 'Basic' ? 0 : policy.price,
        binaryPoints: policy.pv,
        weeklySalesmatchCap: policy.weeklySalesmatchCap,
        monthlySalesmatchCap: policy.monthlySalesmatchCap
      }
    ];
  })
);

export type ProductionAppUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'admin' | 'cashier' | 'bod' | 'superadmin';
  status: 'active' | 'pending' | 'disabled';
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

export type ProductionMemberProfile = {
  userId: string;
  username: string;
  referralCode: string;
  sponsorCode: string | null;
  packageTier: PackageTier;
  accountStatus: 'active' | 'pending' | 'disabled';
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
  normalizedFullName: string;
  createdAt: string;
  payoutMethod?: string;
  payoutDetails?: string;
  // Company/owner accounts (owner sign-off item 8) — excluded from leaderboards
  // even after a username/full-name change, keyed by the immutable row.
  isCompanyAccount?: boolean;
  isLeaderboardExcluded?: boolean;
  companyAccountTag?: string | null;
};

export type ProductionNetworkAccount = {
  userId: string;
  sponsorUserId: string | null;
  directReferrerUserId: string | null;
  placementParentUserId: string | null;
  placementParentShadowSide?: PlacementSide | null;
  placementSide: PlacementSide | null;
  currentAccountTypeCode: number;
  currentAccountType: AccountType;
  packageTier: PackageTier;
  activationCode: string | null;
  registrationStatus: 'pending' | 'active' | 'disabled';
  leftPoints: number;
  rightPoints: number;
  cdStatus: number;
  cdAmount: number;
  cdTotal: number;
  createdAt: string;
};

export type ProductionActivationCode = {
  id: string;
  code: string;
  codeFamily: CodeFamily;
  packageTier: string;
  accountType: AccountType;
  status: ActivationCodeStatus;
  paymentStatus: PaymentStatus;
  assignedUserId: string | null;
  generatedByUserId: string | null;
  generatedAt: string;
  releasedAt: string | null;
  transferredAt: string | null;
  usedAt: string | null;
  usedByUserId: string | null;
  registrationEligible: boolean;
  lockedDirectReferralBonus: number;
  lockedSalesmatchValue: number;
  lockedBinaryPoints: number;
  lockedGetFiveAmount: number;
  processId: string;
  remarks: string;
  settledAt: string | null;
  settledByUserId: string | null;
};

export type ProductionActivationCodeEvent = {
  id: string;
  activationCodeId: string;
  code: string;
  action: 'generated' | 'released' | 'transferred' | 'consumed' | 'settled' | 'revoked' | 'restored';
  actorUserId: string | null;
  actorName: string;
  fromUserId: string | null;
  toUserId: string | null;
  notes: string;
  createdAt: string;
};

export type ProductionPlacementReservation = {
  id: string;
  sponsorUserId: string;
  referralCode: string;
  placementParentUserId: string;
  placementParentUsername: string;
  placementParentShadowSide?: PlacementSide | null;
  placementSide: PlacementSide;
  shareToken: string;
  status: 'active' | 'consumed' | 'expired';
  expiresAt: string;
  createdAt: string;
};

export type ProductionWalletLedgerEntry = {
  id: string;
  userId: string;
  walletType: 'main' | 'lifestyle' | 'product' | 'pending' | 'encashment';
  entryType:
    | 'direct_referral'
    | 'salesmatch'
    | 'binary_cycle'
    | 'get_five'
    | 'lifestyle_rewards'
    | 'unilevel'
    | 'global_bonus'
    | 'encashment'
    | 'encashment_fee'
    | 'withholding_tax'
    | 'system_retainer'
    | 'cd_deduction'
    | 'adjustment';
  sourceReference: string;
  creditAmount: number;
  debitAmount: number;
  balanceAfter: number;
  processId: string;
  notes: string;
  occurredAt: string;
  status: 'posted';
};

export type ProductionSalesmatchBalance = {
  userId: string;
  leftSales: number;
  rightSales: number;
  matchedSales: number;
  leftPoints: number;
  rightPoints: number;
  matchedPoints: number;
  updatedAt: string;
};

export type ProductionEncashmentStatus = 'pending' | 'queued' | 'approved' | 'paid' | 'cancelled' | 'rejected';

export type ProductionEncashment = {
  id: string;
  userId: string;
  processId: string;
  grossAmount: number;
  processingFee: number;
  taxAmount: number;
  systemRetainer: number;
  cdDeduction: number;
  totalDeductions: number;
  netAmount: number;
  status: ProductionEncashmentStatus;
  payoutMethod: string | null;
  payoutDetails: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  remarks: string;
  createdAt: string;
};

export type ProductionPairingSnapshot = {
  id: string;
  userId: string;
  snapshotDate: string;
  matchedSales: number;
  paidSalesmatch: number;
  forfeitedSalesmatch: number;
};

export type ProductionCompensationQueueItem = {
  id: string;
  processId: string;
  eventType: QueueEventType;
  status: 'pending' | 'processed';
  payload: {
    placementParentUserId: string;
    placementParentShadowSide?: PlacementSide | null;
    placementSide: PlacementSide;
    salesmatchValue: number;
    binaryPoints: number;
    createdMemberUserId: string;
    createdMemberUsername: string;
    activationCode: string;
    shadowCode?: string | null;
    binaryCycleEligible?: boolean;
  };
  createdAt: string;
  processedAt: string | null;
};

export type ProductionShadowAccount = {
  id: string;
  ownerUserId: string;
  shadowCode: string;
  state: 'reserved_shadow' | 'activated_shadow' | 'converted_full';
  placement: PlacementSide;
  walletEnabled: boolean;
  unilevelEnabled: boolean;
  binaryCycleEnabled: boolean;
  note: string;
  packageTier: PackageTier | null;
  accountType: AccountType | null;
  activationCode: string | null;
  pvValue: number;
  salesmatchValue: number;
  activatedAt: string | null;
  lastUpgradedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductionRegistrationInput = {
  origin?: RegistrationOrigin;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  activationCode?: string;
  referralCode?: string;
  sponsorReferralCode?: string;
  placementParentUsername?: string;
  placementSide?: PlacementSide;
  placementToken?: string;
  placementReservationId?: string;
  payoutOption?: string;
  payoutDetails?: string;
};

export type ProductionPlacementContext = {
  placementUsername: string;
  placementParentShadowSide?: PlacementSide | null;
  placementSide: PlacementSide;
  note: string;
};

export type ProductionRegistrationPreview = {
  moneyMode: MoneyMode;
  origin: RegistrationOrigin;
  canProceed: boolean;
  sponsorResolutionMode: SponsorResolutionMode | null;
  sponsor: {
    username: string;
    fullName: string;
    referralCode: string;
    packageTier: PackageTier;
  } | null;
  selectedPackage: PackageTier | null;
  placementSide: PlacementSide | null;
  resolvedAccountType: AccountType | null;
  placementReservationId: string | null;
  placementToken: string | null;
  matchingCode: {
    id: string;
    code: string;
    codeFamily: CodeFamily;
    accountType: AccountType;
      packageTier: string;
    assignedTo: string;
    status: ActivationCodeStatus;
    paymentStatus: PaymentStatus;
    generatedAt: string;
    transferredAt: string | null;
    releasedAt: string | null;
    registrationEligible: boolean;
    copyEnabled: boolean;
    transferable: boolean;
    upgradable: boolean;
    visibility: string;
  } | null;
  placement: ProductionPlacementContext | null;
  availableCodes: Array<{
    id: string;
    code: string;
    codeFamily: CodeFamily;
    accountType: AccountType;
      packageTier: string;
    assignedTo: string;
    status: ActivationCodeStatus;
    paymentStatus: PaymentStatus;
    generatedAt: string;
    transferredAt: string | null;
    releasedAt: string | null;
    registrationEligible: boolean;
    copyEnabled: boolean;
    transferable: boolean;
    upgradable: boolean;
    visibility: string;
  }>;
  issues: string[];
  checklist: string[];
};

export type ProductionRegistrationSubmitResponse = {
  moneyMode: MoneyMode;
  action: 'production-registration-submit';
  status: 'completed';
  reason: string;
  detail: string;
  placementReservationId: string | null;
  queuedCompensation: string[];
  createdMember: {
    username: string;
    fullName: string;
    email: string;
    referralCode: string;
    sponsorUsername: string;
    packageTier: PackageTier;
    accountType: AccountType;
    loginEmail: string;
  };
};

type ProductionGenealogyNode = {
  nodeId: string;
  username: string;
  fullName: string;
  referralCode: string;
  packageTier: string;
  placement: 'root' | 'left' | 'right';
  status: string;
  depth: number;
  tracePath: string;
  binaryPoints: number;
  directReferrals: number;
  leftPoints: number;
  rightPoints: number;
  openSlots: {
    left: boolean;
    right: boolean;
  };
  shadowSlots: {
    left: {
      id: string;
      owner: string;
      placement: 'left';
      state: 'reserved_shadow' | 'activated_shadow';
      shadowCode: string;
      label: string;
      activationStatus: 'inactive' | 'activated';
      registrationEnabled: boolean;
      walletEnabled: boolean;
      unilevelEnabled: boolean;
      binaryCycleEnabled: boolean;
      note: string;
      packageTier: PackageTier | null;
      accountType: AccountType | null;
      activationCode: string | null;
      pvValue: number;
      salesmatchValue: number;
      activatedAt: string | null;
      lastUpgradedAt: string | null;
    };
    right: {
      id: string;
      owner: string;
      placement: 'right';
      state: 'reserved_shadow' | 'activated_shadow';
      shadowCode: string;
      label: string;
      activationStatus: 'inactive' | 'activated';
      registrationEnabled: boolean;
      walletEnabled: boolean;
      unilevelEnabled: boolean;
      binaryCycleEnabled: boolean;
      note: string;
      packageTier: PackageTier | null;
      accountType: AccountType | null;
      activationCode: string | null;
      pvValue: number;
      salesmatchValue: number;
      activatedAt: string | null;
      lastUpgradedAt: string | null;
    };
  };
  accountStateLabel: 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid';
  children: ProductionGenealogyNode[];
};

export type ProductionEncodingRepository = {
  getMoneyMode(): MoneyMode;
  now(): string;
  nextActivationCodeSequence(): Promise<number>;
  nextMemberSequence(): Promise<number>;
  findUserById(userId: string): Promise<ProductionAppUser | null>;
  findMemberByUserId(userId: string): Promise<ProductionMemberProfile | null>;
  findMemberByUsername(username: string): Promise<ProductionMemberProfile | null>;
  findMemberByReferralCode(referralCode: string): Promise<ProductionMemberProfile | null>;
  findUserByUsername(username: string): Promise<ProductionAppUser | null>;
  findUserByReferralCode(referralCode: string): Promise<ProductionAppUser | null>;
  findUserByEmail(email: string): Promise<ProductionAppUser | null>;
  countMembersByNormalizedFullName(normalizedFullName: string): Promise<number>;
  listActivationCodes(): Promise<ProductionActivationCode[]>;
  listActivationCodesForUser(userId: string): Promise<ProductionActivationCode[]>;
  saveActivationCodes(rows: ProductionActivationCode[]): Promise<void>;
  appendActivationCodeEvents(events: ProductionActivationCodeEvent[]): Promise<void>;
  listActivationCodeEvents(): Promise<ProductionActivationCodeEvent[]>;
  listMembers(): Promise<ProductionMemberProfile[]>;
  listUsers(): Promise<ProductionAppUser[]>;
  listShadowAccounts(): Promise<ProductionShadowAccount[]>;
  listShadowAccountsForOwner(ownerUserId: string): Promise<ProductionShadowAccount[]>;
  findShadowAccountByCode(shadowCode: string): Promise<ProductionShadowAccount | null>;
  saveShadowAccounts(rows: ProductionShadowAccount[]): Promise<void>;
  listWalletLedgerEntriesForUser(userId: string): Promise<ProductionWalletLedgerEntry[]>;
  appendWalletLedgerEntry(entry: ProductionWalletLedgerEntry): Promise<void>;
  hasWalletLedgerProcess(processId: string): Promise<boolean>;
  saveUser(user: ProductionAppUser): Promise<void>;
  saveMemberProfile(profile: ProductionMemberProfile): Promise<void>;
  saveNetworkAccount(account: ProductionNetworkAccount): Promise<void>;
  findNetworkAccountByUserId(userId: string): Promise<ProductionNetworkAccount | null>;
  findActivationCodeByCode(code: string): Promise<ProductionActivationCode | null>;
  findActivationCodesByCodes(codes: string[]): Promise<ProductionActivationCode[]>;
  listMembersBySponsorCode(sponsorCode: string): Promise<ProductionMemberProfile[]>;
  findUsersByIds(userIds: string[]): Promise<ProductionAppUser[]>;
  listActivationCodeEventsForUser(userId: string, limit: number): Promise<ProductionActivationCodeEvent[]>;
  listRecentActivationCodeEvents(limit: number): Promise<ProductionActivationCodeEvent[]>;
  listNetworkAccounts(): Promise<ProductionNetworkAccount[]>;
  listDirectsBySponsor(sponsorUserId: string): Promise<ProductionNetworkAccount[]>;
  findPlacementChild(parentUserId: string, side: PlacementSide, shadowSide?: PlacementSide | null): Promise<ProductionNetworkAccount | null>;
  saveSalesmatchBalance(balance: ProductionSalesmatchBalance): Promise<void>;
  getSalesmatchBalance(userId: string): Promise<ProductionSalesmatchBalance | null>;
  getPaidSalesmatchSince(userId: string, sinceIso: string): Promise<number>;
  recordPairingSnapshot(input: {
    userId: string;
    snapshotDate: string;
    matchedDelta: number;
    paidDelta: number;
    forfeitedDelta: number;
  }): Promise<void>;
  listPairingSnapshotsForUser(userId: string): Promise<ProductionPairingSnapshot[]>;
  sumLedgerMainBalance(userId: string): Promise<number>;
  createEncashment(row: ProductionEncashment): Promise<void>;
  saveEncashment(row: ProductionEncashment): Promise<void>;
  findEncashmentById(encashmentId: string): Promise<ProductionEncashment | null>;
  listEncashments(filter: { status?: ProductionEncashmentStatus }, limit: number): Promise<ProductionEncashment[]>;
  listEncashmentsForUser(userId: string): Promise<ProductionEncashment[]>;
  enqueueCompensation(item: ProductionCompensationQueueItem): Promise<void>;
  listPendingCompensation(limit: number): Promise<ProductionCompensationQueueItem[]>;
  markCompensationProcessed(queueId: string, processedAt: string): Promise<void>;
  savePlacementReservation(reservation: ProductionPlacementReservation): Promise<void>;
  listPlacementReservationsForSponsor(sponsorUserId: string): Promise<ProductionPlacementReservation[]>;
  findPlacementReservationById(reservationId: string): Promise<ProductionPlacementReservation | null>;
  findPlacementReservationByToken(token: string): Promise<ProductionPlacementReservation | null>;
  listMembersFiltered(query: string, page: number, pageSize: number): Promise<ProductionMemberProfile[]>;
  countMembersFiltered(query: string): Promise<number>;
  listNetworkAccountsByUserIds(userIds: string[]): Promise<ProductionNetworkAccount[]>;
  sumWalletMainBalancesByUserIds(userIds: string[]): Promise<Map<string, number>>;
  countDirectReferralsByUserIds(userIds: string[]): Promise<Map<string, number>>;
  insertRepurchase(row: {
    id: string;
    processKey: string;
    userId: string;
    productCode: string;
    productName: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    pvEarned: number;
    activationCode: string;
    transactionDate: string;
    createdAt: string;
  }): Promise<void>;
  sumLifestyleCreditsForUserToday(userId: string, dayIso: string): Promise<number>;
  sumLifestyleCreditsForUserThisMonth(userId: string, yearMonthPrefix: string): Promise<number>;
};

export function normalizeFullName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ').toUpperCase();
}

function toPackageTier(value: string): PackageTier {
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'BASIC':
      return 'Basic';
    case 'CLASSIC':
      return 'Classic';
    case 'STANDARD':
      return 'Standard';
    case 'BUSINESS':
      return 'Business';
    case 'VIP':
      return 'VIP';
    default:
      throw new Error(`Unsupported package tier: ${value}`);
  }
}

function getPackageConfig(packageTier: string): PackageConfig {
  const config = PACKAGE_CONFIGS.get(packageTier.trim().toUpperCase());
  if (!config) {
    throw new Error(`Unsupported package tier: ${packageTier}`);
  }
  return config;
}

function normalizeProductionUsernameAlias(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  const match = compact.match(/^YOR0*(\d+)$/);

  if (!match) {
    return null;
  }

  return `YOR${match[1].padStart(4, '0')}`;
}

function resolveActivationCodeTemplate(packageTier: string, codeFamily: CodeFamily): {
  packageTier: string;
  accountType: AccountType;
  directReferralBonus: number;
  salesmatchValue: number;
  salesmatchBinaryPoints: number;
  binaryCyclePercent: number;
  getFiveAmount: number;
  binaryPoints: number;
} {
  if (codeFamily === 'YOR CODES') {
    return getPackageConfig(packageTier);
  }

  const normalizedPackageTier = packageTier.trim().toUpperCase();
  const product = repeatPurchaseProductCatalog.find(
    (item) => item.label.trim().toUpperCase() === normalizedPackageTier || item.sku.trim().toUpperCase() === normalizedPackageTier
  );

  if (!product) {
    throw new Error(`Unsupported product tier: ${packageTier}`);
  }

  return {
    packageTier: product.label,
    accountType: 'PD' as const,
    directReferralBonus: 0,
    salesmatchValue: 0,
    salesmatchBinaryPoints: 0,
    binaryCyclePercent: 0,
    getFiveAmount: 0,
    binaryPoints: 0
  };
}

function buildActivationCodeValue(accountType: AccountType, packageTier: string, codeFamily: CodeFamily, sequence: number): string {
  let pkg: string;
  if (codeFamily === 'YOR CODES') {
    const pkgMap: Record<string, string> = { Basic: 'BA', Classic: 'CL', Standard: 'ST', Business: 'BU', VIP: 'VI' };
    pkg = pkgMap[packageTier] ?? 'XX';
  } else {
    const cfMap: Record<string, string> = {
      'YOR MAINTENANCE': 'YM',
      'YOR PERFUME': 'YP',
      'YOR REFILL': 'YR',
      'YOR VISION': 'YV',
    };
    pkg = cfMap[codeFamily] ?? 'YX';
  }
  return `${accountType}${pkg}${String(sequence).padStart(6, '0')}`;
}

function visibilityForCode(code: ProductionActivationCode, assignedUsername: string | null): string {
  if (code.status === 'used') {
    return 'used';
  }
  if (code.status === 'unreleased') {
    return assignedUsername ? 'reserved-awaiting-release' : 'unreleased-admin-pool';
  }
  if (code.status === 'available' && assignedUsername) {
    return 'released-by-sponsor';
  }
  return 'released-to-network';
}

function mapCodeRow(
  code: ProductionActivationCode,
  assignedUsername: string | null
): ProductionRegistrationPreview['availableCodes'][number] {
  return {
    id: code.id,
    code: code.code,
    codeFamily: code.codeFamily,
    accountType: code.accountType,
    packageTier: code.packageTier,
    assignedTo: assignedUsername ?? 'Unassigned',
    status: code.status,
    paymentStatus: code.paymentStatus,
    generatedAt: code.generatedAt,
    transferredAt: code.transferredAt,
    releasedAt: code.releasedAt,
    registrationEligible: code.registrationEligible,
    copyEnabled: code.registrationEligible && code.status === 'available' && Boolean(assignedUsername),
    transferable: code.status !== 'used' && code.status !== 'disabled',
    upgradable: code.codeFamily === 'YOR CODES' && code.status === 'available',
    visibility: visibilityForCode(code, assignedUsername)
  };
}

function splitFullName(fullName: string): { firstName: string; lastName: string; middleName: string } {
  const parts = fullName.trim().split(/\s+/g).filter(Boolean);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
  return { firstName, lastName, middleName };
}

function parsePlacementParentAddress(username: string): {
  memberUsername: string;
  shadowSide: PlacementSide | null;
  label: string;
} {
  const label = username.trim();
  if (label.endsWith('-L')) {
    return { memberUsername: label.slice(0, -2), shadowSide: 'left', label };
  }
  if (label.endsWith('-R')) {
    return { memberUsername: label.slice(0, -2), shadowSide: 'right', label };
  }
  return { memberUsername: label, shadowSide: null, label };
}

function buildProcessId(scope: string, ...parts: string[]) {
  return [scope, ...parts].join(':');
}

// Serializes money-mutating operations per key. Service instances are created
// per request, so the lock table lives at module scope. This guards the
// single-process PM2 deployment against TOCTOU races (balance check vs debit,
// concurrent status reviews, queue double-processing); a multi-node deployment
// must replace this with a database-level lock.
const moneyLocks = new Map<string, Promise<void>>();

async function withMoneyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = moneyLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  moneyLocks.set(key, current);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (moneyLocks.get(key) === current) {
      moneyLocks.delete(key);
    }
  }
}

function randomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class ProductionEncodingService {
  constructor(private readonly repo: ProductionEncodingRepository) {}

  private buildShadowCode(ownerUsername: string, placement: PlacementSide) {
    return `${ownerUsername}-${placement === 'left' ? 'L' : 'R'}`;
  }

  private buildDefaultShadowNote(placement: PlacementSide, state: ProductionShadowAccount['state']) {
    if (state === 'activated_shadow') {
      return `Activated ${placement} shadow support. Carries PV for Salesmatch only; no wallet, direct referral, unilevel, or binary cycle rights.`;
    }
    return `Reserved ${placement} shadow support. Binary Function Only until a paid code activates this slot.`;
  }

  private createDefaultShadowAccount(owner: ProductionMemberProfile, placement: PlacementSide): ProductionShadowAccount {
    const now = this.repo.now();
    return {
      id: crypto.randomUUID(),
      ownerUserId: owner.userId,
      shadowCode: this.buildShadowCode(owner.username, placement),
      state: 'reserved_shadow',
      placement,
      walletEnabled: false,
      unilevelEnabled: false,
      binaryCycleEnabled: false,
      note: this.buildDefaultShadowNote(placement, 'reserved_shadow'),
      packageTier: null,
      accountType: null,
      activationCode: null,
      pvValue: 0,
      salesmatchValue: 0,
      activatedAt: null,
      lastUpgradedAt: null,
      createdAt: now,
      updatedAt: now
    };
  }

  private async ensureShadowAccountsForMembers(members: ProductionMemberProfile[]) {
    const existing = await this.repo.listShadowAccounts();
    const byOwnerPlacement = new Map<string, ProductionShadowAccount>(existing.map((row) => [`${row.ownerUserId}:${row.placement}`, row]));
    const created: ProductionShadowAccount[] = [];

    for (const member of members) {
      for (const placement of ['left', 'right'] as const) {
        const key = `${member.userId}:${placement}`;
        if (!byOwnerPlacement.has(key)) {
          const row = this.createDefaultShadowAccount(member, placement);
          byOwnerPlacement.set(key, row);
          created.push(row);
        }
      }
    }

    if (created.length > 0) {
      await this.repo.saveShadowAccounts(created);
    }

    return [...existing, ...created];
  }

  private async ensureShadowAccountsForOwner(owner: ProductionMemberProfile) {
    const rows = await this.repo.listShadowAccountsForOwner(owner.userId);
    if (rows.length >= 2 && rows.some((row) => row.placement === 'left') && rows.some((row) => row.placement === 'right')) {
      return rows;
    }
    const missing: ProductionShadowAccount[] = [];
    if (!rows.some((row) => row.placement === 'left')) {
      missing.push(this.createDefaultShadowAccount(owner, 'left'));
    }
    if (!rows.some((row) => row.placement === 'right')) {
      missing.push(this.createDefaultShadowAccount(owner, 'right'));
    }
    if (missing.length > 0) {
      await this.repo.saveShadowAccounts(missing);
    }
    return [...rows, ...missing].sort((a, b) => a.placement.localeCompare(b.placement));
  }

  private toGenealogyShadowSlot(owner: ProductionMemberProfile, row: ProductionShadowAccount) {
    return {
      id: row.id,
      owner: owner.username,
      placement: row.placement,
      state: row.state === 'converted_full' ? 'activated_shadow' : row.state,
      shadowCode: row.shadowCode,
      label: `${owner.username} ${row.placement === 'left' ? 'Left' : 'Right'} Shadow`,
      activationStatus: row.state === 'reserved_shadow' ? 'inactive' as const : 'activated' as const,
      registrationEnabled: false,
      walletEnabled: row.walletEnabled,
      unilevelEnabled: row.unilevelEnabled,
      binaryCycleEnabled: row.binaryCycleEnabled,
      note: row.note,
      packageTier: row.packageTier,
      accountType: row.accountType,
      activationCode: row.activationCode,
      pvValue: row.pvValue,
      salesmatchValue: row.salesmatchValue,
      activatedAt: row.activatedAt,
      lastUpgradedAt: row.lastUpgradedAt
    };
  }

  async buildScopedBinaryGenealogyCenter(user: SessionUser, rootUsername?: string) {
    const signedInMember = await this.requireMemberByUserId(user.id);
    const [members, networks] = await Promise.all([this.repo.listMembers(), this.repo.listNetworkAccounts()]);
    const shadowAccounts = await this.ensureShadowAccountsForMembers(members);
    const membersByUserId = new Map(members.map((member) => [member.userId, member]));
    const networksByUserId = new Map(networks.map((network) => [network.userId, network]));
    const membersByUsername = new Map(members.map((member) => [member.username, member]));
    const shadowByOwnerPlacement = new Map(
      shadowAccounts.map((row) => [`${row.ownerUserId}:${row.placement}`, row] as const)
    );
    const directReferralCounts = new Map<string, number>();

    for (const member of members) {
      if (!member.sponsorCode) {
        continue;
      }
      const sponsor = members.find((candidate) => candidate.referralCode === member.sponsorCode);
      if (!sponsor) {
        continue;
      }
      directReferralCounts.set(sponsor.userId, (directReferralCounts.get(sponsor.userId) ?? 0) + 1);
    }

    const flattenTree = (root: ProductionGenealogyNode) => {
      const nodes: Array<Omit<ProductionGenealogyNode, 'children'> & { parentNodeId: string | null; level: number }> = [];

      const walk = (node: ProductionGenealogyNode, parentNodeId: string | null, level: number) => {
        const { children, ...rest } = node;
        nodes.push({
          ...rest,
          parentNodeId,
          level
        });

        for (const child of children) {
          walk(child, node.nodeId, level + 1);
        }
      };

      walk(root, null, 0);
      return nodes;
    };

    const toAccountStateLabel = (network: ProductionNetworkAccount | null): 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid' => {
      if (!network) return 'PD';
      if (network.currentAccountType === 'FS') return 'FS';
      if (network.currentAccountType === 'CD') {
        return network.cdStatus > 0 ? 'CD - Paid' : 'CD - Unpaid';
      }
      return 'PD';
    };

    const buildTreeNode = (
      member: ProductionMemberProfile,
      placement: 'root' | 'left' | 'right',
      depth: number,
      path: string[]
    ): ProductionGenealogyNode => {
      const network = networksByUserId.get(member.userId) ?? null;
      const tracePath = [...path, member.username];
      const leftShadow = shadowByOwnerPlacement.get(`${member.userId}:left`) ?? this.createDefaultShadowAccount(member, 'left');
      const rightShadow = shadowByOwnerPlacement.get(`${member.userId}:right`) ?? this.createDefaultShadowAccount(member, 'right');

      return {
        nodeId: member.username,
        username: member.username,
        fullName: member.fullName,
        referralCode: member.referralCode,
        packageTier: member.packageTier,
        placement,
        status: member.accountStatus,
        depth,
        tracePath: tracePath.join(' > '),
        binaryPoints: Math.min(network?.leftPoints ?? 0, network?.rightPoints ?? 0),
        directReferrals: directReferralCounts.get(member.userId) ?? 0,
        leftPoints: network?.leftPoints ?? 0,
        rightPoints: network?.rightPoints ?? 0,
        openSlots: {
          left: false,
          right: false
        },
        shadowSlots: {
          left: { ...this.toGenealogyShadowSlot(member, leftShadow), placement: 'left' as const },
          right: { ...this.toGenealogyShadowSlot(member, rightShadow), placement: 'right' as const }
        },
        accountStateLabel: toAccountStateLabel(network),
        children: [
          buildShadowTreeNode(member, 'left', depth + 1, tracePath),
          buildShadowTreeNode(member, 'right', depth + 1, tracePath)
        ]
      };
    };

    const findShadowChildNetwork = (
      parentUserId: string,
      shadowSide: PlacementSide,
      childSide: PlacementSide
    ) =>
      networks.find(
        (candidate) =>
          candidate?.placementParentUserId === parentUserId &&
          candidate.placementSide === childSide &&
          candidate.registrationStatus === 'active' &&
          (candidate.placementParentShadowSide === shadowSide ||
            (!candidate.placementParentShadowSide && candidate.placementSide === shadowSide))
      ) ?? null;

    const buildShadowTreeNode = (
      owner: ProductionMemberProfile,
      placement: PlacementSide,
      depth: number,
      path: string[]
    ): ProductionGenealogyNode => {
      const nodeId = `${owner.username}-${placement === 'left' ? 'L' : 'R'}`;
      const tracePath = [...path, nodeId];
      const leftNetwork = findShadowChildNetwork(owner.userId, placement, 'left');
      const rightNetwork = findShadowChildNetwork(owner.userId, placement, 'right');
      const leftMember = leftNetwork ? membersByUserId.get(leftNetwork.userId) ?? null : null;
      const rightMember = rightNetwork ? membersByUserId.get(rightNetwork.userId) ?? null : null;
      const children: ProductionGenealogyNode[] = [];

      if (leftMember) {
        children.push(buildTreeNode(leftMember, 'left', depth + 1, tracePath));
      }

      if (rightMember) {
        children.push(buildTreeNode(rightMember, 'right', depth + 1, tracePath));
      }

      return {
        nodeId,
        username: nodeId,
        fullName: 'Binary Function Only',
        referralCode: '',
        packageTier: 'Binary Function Only',
        placement,
        status: 'shadow',
        depth,
        tracePath: tracePath.join(' > '),
        binaryPoints: 0,
        directReferrals: 0,
        leftPoints: 0,
        rightPoints: 0,
        openSlots: {
          left: !leftMember,
          right: !rightMember
        },
        shadowSlots: {
          left: null as any,
          right: null as any
        },
        accountStateLabel: 'PD',
        children
      };
    };

    const memberRoot = buildTreeNode(signedInMember, 'root', 0, []);
    const requestedRoot = rootUsername ? membersByUsername.get(rootUsername) ?? null : null;
    const resolvedRoot = requestedRoot ?? signedInMember;
    const root =
      resolvedRoot.username === signedInMember.username ? memberRoot : buildTreeNode(resolvedRoot, 'root', 0, []);

    return {
      moneyMode: this.repo.getMoneyMode(),
      treeType: 'binary-placement',
      root,
      nodes: flattenTree(root),
      notes: [
        'Direct sponsor genealogy and binary placement remain separate so placement and referral logic do not get mixed.',
        resolvedRoot.username === signedInMember.username
          ? 'Tree is centered on the signed-in member root.'
          : `Tree is centered on ${resolvedRoot.username} for placement review.`,
        'Open slots are generated from the live production-backed placement tree.'
      ]
    };
  }

  async buildAdminBinaryGenealogyCenter(rootUsername?: string) {
    const members = await this.repo.listMembers();
    const byUsername = new Map(members.map((m) => [m.username, m]));
    const companyRoot = members.find((m) => m.isCompanyAccount) ?? members[0];
    const rootMember = rootUsername ? (byUsername.get(rootUsername) ?? companyRoot) : companyRoot;
    if (!rootMember) {
      throw new Error('No company root found in production database.');
    }
    const syntheticUser: SessionUser = {
      id: rootMember.userId,
      name: rootMember.fullName,
      email: '',
      role: 'member'
    };
    return this.buildScopedBinaryGenealogyCenter(syntheticUser, rootUsername);
  }

  async buildMemberShadowAccountCenter(user: SessionUser, ownerUsername?: string) {
    const owner = ownerUsername ? await this.requireMemberByUsername(ownerUsername) : await this.requireMemberByUserId(user.id);
    if (user.role === 'member' && owner.userId !== user.id) {
      throw new Error('Members can only view their own shadow accounts.');
    }

    const [shadowAccounts, availableCodes] = await Promise.all([
      this.ensureShadowAccountsForOwner(owner),
      this.repo.listActivationCodesForUser(owner.userId)
    ]);

    return {
      moneyMode: this.repo.getMoneyMode(),
      owner: owner.username,
      accounts: shadowAccounts.map((row) => ({
        id: row.id,
        owner: owner.username,
        shadowCode: row.shadowCode,
        label: `${owner.username} ${row.placement === 'left' ? 'Left' : 'Right'} Shadow`,
        state: row.state,
        activationStatus: row.state === 'reserved_shadow' ? 'inactive' : 'activated',
        placement: row.placement,
        walletEnabled: row.walletEnabled,
        unilevelEnabled: row.unilevelEnabled,
        binaryCycleEnabled: row.binaryCycleEnabled,
        packageTier: row.packageTier,
        accountType: row.accountType,
        activationCode: row.activationCode,
        pvValue: row.pvValue,
        salesmatchValue: row.salesmatchValue,
        activatedAt: row.activatedAt,
        lastUpgradedAt: row.lastUpgradedAt,
        note: row.note,
        canActivate: row.state === 'reserved_shadow',
        canUpgrade: row.state !== 'reserved_shadow'
      })),
      availableCodes: availableCodes
        .filter(
          (item) =>
            item.codeFamily === 'YOR CODES' &&
            item.status === 'available' &&
            item.paymentStatus !== 'unpaid' &&
            item.registrationEligible
        )
        .map((item) => ({
          id: item.id,
          code: item.code,
          codeFamily: item.codeFamily,
          accountType: item.accountType,
          packageTier: item.packageTier,
          assignedTo: owner.username,
          status: item.status,
          paymentStatus: item.paymentStatus,
          generatedAt: item.generatedAt,
          transferredAt: item.transferredAt,
          releasedAt: item.releasedAt,
          registrationEligible: item.registrationEligible,
          copyEnabled: true,
          transferable: false,
          upgradable: true,
          visibility: 'shadow-activation'
        })),
      notes: [
        'Shadow accounts are Binary Function Only until activated.',
        'Activated shadows add Salesmatch PV only. They never generate Direct Referral, Unilevel, or Binary Cycle.'
      ]
    };
  }

  async activateShadowAccount(
    actor: SessionUser,
    payload: { shadowCode: string; code: string }
  ) {
    const shadowCode = payload.shadowCode.trim().toUpperCase();
    const codeValue = payload.code.trim().toUpperCase();
    if (!shadowCode) {
      throw new Error('Select a shadow account first.');
    }
    if (!codeValue) {
      throw new Error('Select an activation code first.');
    }

    return withMoneyLock(`shadow:${shadowCode}`, async () => {
      const shadow = await this.repo.findShadowAccountByCode(shadowCode);
      if (!shadow) {
        throw new Error('Shadow account not found.');
      }
      if (actor.role === 'member' && shadow.ownerUserId !== actor.id) {
        throw new Error('You can only activate your own shadow account.');
      }

      const owner = await this.requireMemberByUserId(shadow.ownerUserId);
      const code = await this.repo.findActivationCodeByCode(codeValue);
      if (!code) {
        throw new Error('Activation code not found.');
      }
      if (code.codeFamily !== 'YOR CODES' || !code.registrationEligible) {
        throw new Error('Only registration activation codes can activate a shadow account.');
      }
      if (code.assignedUserId !== shadow.ownerUserId) {
        throw new Error(`Activation code ${code.code} is not assigned to ${owner.username}.`);
      }
      if (code.status !== 'available') {
        throw new Error(`Activation code ${code.code} is not available.`);
      }
      if (code.paymentStatus === 'unpaid') {
        throw new Error(`Activation code ${code.code} must be settled before it can activate a shadow account.`);
      }

      const previousSalesmatchValue = shadow.salesmatchValue;
      const previousPvValue = shadow.pvValue;
      const nextSalesmatchValue = code.lockedSalesmatchValue;
      const nextPvValue = code.lockedBinaryPoints;

      if (shadow.state !== 'reserved_shadow' && nextSalesmatchValue <= previousSalesmatchValue && nextPvValue <= previousPvValue) {
        throw new Error('Use a higher-value code to upgrade this activated shadow account.');
      }

      const now = this.repo.now();
      shadow.state = 'activated_shadow';
      shadow.walletEnabled = false;
      shadow.unilevelEnabled = false;
      shadow.binaryCycleEnabled = false;
      shadow.note = this.buildDefaultShadowNote(shadow.placement, 'activated_shadow');
      shadow.packageTier = toPackageTier(code.packageTier);
      shadow.accountType = code.accountType;
      shadow.activationCode = code.code;
      shadow.pvValue = nextPvValue;
      shadow.salesmatchValue = nextSalesmatchValue;
      shadow.activatedAt = shadow.activatedAt ?? now;
      shadow.lastUpgradedAt = now;
      shadow.updatedAt = now;

      code.status = 'used';
      code.usedAt = now;
      code.usedByUserId = shadow.ownerUserId;

      await this.repo.saveShadowAccounts([shadow]);
      await this.repo.saveActivationCodes([code]);
      await this.repo.appendActivationCodeEvents([
        {
          id: crypto.randomUUID(),
          activationCodeId: code.id,
          code: code.code,
          action: 'consumed',
          actorUserId: actor.id,
          actorName: actor.name,
          fromUserId: shadow.ownerUserId,
          toUserId: shadow.ownerUserId,
          notes: `Activation code consumed for shadow account ${shadow.shadowCode}.`,
          createdAt: now
        }
      ]);

      const salesmatchDelta = Math.max(0, Number((nextSalesmatchValue - previousSalesmatchValue).toFixed(2)));
      const pvDelta = Math.max(0, Number((nextPvValue - previousPvValue).toFixed(2)));
      if (salesmatchDelta > 0 || pvDelta > 0) {
        await this.repo.enqueueCompensation({
          id: crypto.randomUUID(),
          processId: buildProcessId('shadow-activate', shadow.shadowCode, code.code),
          eventType: 'placement-sales',
          status: 'pending',
          payload: {
            placementParentUserId: shadow.ownerUserId,
            placementParentShadowSide: shadow.placement,
            placementSide: shadow.placement,
            salesmatchValue: salesmatchDelta,
            binaryPoints: pvDelta,
            createdMemberUserId: shadow.ownerUserId,
            createdMemberUsername: shadow.shadowCode,
            activationCode: code.code,
            shadowCode: shadow.shadowCode,
            binaryCycleEligible: false
          },
          createdAt: now,
          processedAt: null
        });
      }

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'member-shadow-account-activate',
        status: 'completed' as const,
        reason:
          previousSalesmatchValue > 0
            ? `Shadow account ${shadow.shadowCode} upgraded to ${shadow.packageTier}.`
            : `Shadow account ${shadow.shadowCode} activated with ${shadow.packageTier}.`,
        detail: `Shadow ${shadow.shadowCode} now carries ${shadow.pvValue} PV and PHP ${shadow.salesmatchValue} Salesmatch value. Binary Cycle, Direct Referral, and Unilevel remain disabled.`,
        shadowAccount: {
          shadowCode: shadow.shadowCode,
          placement: shadow.placement,
          packageTier: shadow.packageTier,
          accountType: shadow.accountType,
          pvValue: shadow.pvValue,
          salesmatchValue: shadow.salesmatchValue
        }
      };
    });
  }

  async getMemberBinaryBalance(userId: string): Promise<{
    leftPoints: number;
    rightPoints: number;
    matchedPoints: number;
    matchedSales: number;
  } | null> {
    const [balance, network] = await Promise.all([
      this.repo.getSalesmatchBalance(userId),
      this.repo.findNetworkAccountByUserId(userId)
    ]);
    if (!balance && !network) return null;
    return {
      leftPoints: network?.leftPoints ?? balance?.leftPoints ?? 0,
      rightPoints: network?.rightPoints ?? balance?.rightPoints ?? 0,
      matchedPoints: balance?.matchedPoints ?? 0,
      matchedSales: Number(balance?.matchedSales ?? 0)
    };
  }

  // Unilevel rank (owner item 8): determined solely by lifetime TOTAL INCOME =
  // gross sum of every wallet credit (no debits/deductions), mapped onto the
  // image-2 rank ladder.
  async getMemberRank(userId: string): Promise<RankProgress & { moneyMode: MoneyMode }> {
    const ledger = await this.repo.listWalletLedgerEntriesForUser(userId);
    const totalIncome = ledger.reduce((sum, entry) => sum + (entry.creditAmount ?? 0), 0);
    return { moneyMode: this.repo.getMoneyMode(), ...rankForIncome(totalIncome) };
  }

  // Income leaderboard (owner item 8). Ranks true members by lifetime total
  // income. Company/owner-tagged accounts are excluded (rename-stable flag);
  // office-role accounts are not members and never appear here.
  async getLeaderboard(limit = 100): Promise<{
    moneyMode: MoneyMode;
    entries: Array<{
      position: number;
      userId: string;
      username: string;
      fullName: string;
      packageTier: string;
      totalIncome: number;
      rankName: string;
      rankLevel: number;
    }>;
  }> {
    const members = await this.repo.listMembers();
    const COMPANY_USERNAMES = new Set(['yor01', 'yor0001', 'yor-company-root']);
    const eligible = members.filter(
      (member) =>
        member.accountStatus === 'active' &&
        !member.isCompanyAccount &&
        !member.isLeaderboardExcluded &&
        !COMPANY_USERNAMES.has(member.username.toLowerCase())
    );
    const ranked = await Promise.all(
      eligible.map(async (member) => {
        const ledger = await this.repo.listWalletLedgerEntriesForUser(member.userId);
        const totalIncome = ledger.reduce((sum, entry) => sum + (entry.creditAmount ?? 0), 0);
        const rank = rankForIncome(totalIncome);
        return {
          userId: member.userId,
          username: member.username,
          fullName: member.fullName,
          packageTier: member.packageTier,
          totalIncome,
          rankName: rank.rankName,
          rankLevel: rank.level
        };
      })
    );
    ranked.sort((a, b) => b.totalIncome - a.totalIncome || a.username.localeCompare(b.username));
    return {
      moneyMode: this.repo.getMoneyMode(),
      entries: ranked.slice(0, limit).map((entry, index) => ({ position: index + 1, ...entry }))
    };
  }

  // Unilevel bonus (owner sign-off item 8). A member's product repurchase credits
  // their SPONSOR bloodline up to 10 levels, amplified per level by
  // UNILEVEL_PERCENTAGES (L1 10% .. L10 1%). Sponsor tree only (network.sponsorUserId),
  // never binary placement. Each level posts at most once per repurchase event via a
  // deterministic process key. Recipient eligibility is intentionally NOT gated here —
  // every sponsor in the bloodline is credited per the owner ruling.
  // GATE-UNI-20260613. (200-PV monthly maintenance gating is recorded as a pending
  // decision and intentionally NOT enforced yet.)
  async applyRepurchaseUnilevel(input: {
    repurchasingUserId: string;
    repurchasePv: number;
    repurchaseRef: string;
    sourceLabel: string;
  }): Promise<{ levelsCredited: number; totalCredited: number }> {
    if (input.repurchasePv <= 0) {
      return { levelsCredited: 0, totalCredited: 0 };
    }
    let current = await this.repo.findNetworkAccountByUserId(input.repurchasingUserId);
    let level = 1;
    let totalCredited = 0;
    let levelsCredited = 0;
    const visited = new Set<string>([input.repurchasingUserId]);

    while (current?.sponsorUserId && level <= UNILEVEL_MAX_LEVELS) {
      const recipientUserId = current.sponsorUserId;
      if (visited.has(recipientUserId)) {
        break; // cycle guard
      }
      visited.add(recipientUserId);

      const percent = UNILEVEL_PERCENTAGES[level] ?? 0;
      if (percent > 0) {
        const credit = Number(((input.repurchasePv * percent) / 100).toFixed(2));
        if (credit > 0) {
          await this.postLedgerIfNeeded({
            userId: recipientUserId,
            entryType: 'unilevel',
            sourceReference: input.sourceLabel,
            creditAmount: credit,
            processId: `${input.repurchaseRef}:unilevel:L${level}:${recipientUserId}`,
            notes: `Unilevel L${level} (${percent}%) from ${input.sourceLabel}.`
          });
          totalCredited += credit;
          levelsCredited += 1;
        }
      }

      current = await this.repo.findNetworkAccountByUserId(recipientUserId);
      level += 1;
    }

    return { levelsCredited, totalCredited: Number(totalCredited.toFixed(2)) };
  }

  // Resolves a repurchase product from the catalog and credits the sponsor
  // bloodline. The repurchase ref makes each posting idempotent per event.
  async creditUnilevelForRepurchase(input: {
    repurchasingUserId: string;
    sku: string;
    repurchaseRef: string;
  }): Promise<{ levelsCredited: number; totalCredited: number; repurchasePv: number }> {
    const product = repeatPurchaseProductCatalog.find((item) => item.sku === input.sku);
    if (!product || !product.unilevelEligible) {
      return { levelsCredited: 0, totalCredited: 0, repurchasePv: 0 };
    }
    const member = await this.repo.findMemberByUserId(input.repurchasingUserId);
    const result = await this.applyRepurchaseUnilevel({
      repurchasingUserId: input.repurchasingUserId,
      repurchasePv: product.repurchasePv,
      repurchaseRef: input.repurchaseRef,
      sourceLabel: member?.username ? `${member.username} · ${product.label}` : product.label
    });
    return { ...result, repurchasePv: product.repurchasePv };
  }

  // GATE-LFR-20260613: Lifestyle Rewards production posting (owner sign-off item 9).
  // Credits the PURCHASING MEMBER's lifestyle wallet (not sponsor bloodline).
  // Caps enforced per package: daily and monthly. Both caps must have room.
  // Process key LFR:<memberUserId>:<repurchaseRef> makes re-credit a no-op.
  async applyRepurchaseLifestyle(input: {
    memberUserId: string;
    sku: string;
    repurchaseRef: string;
    memberPackageTier: PackageTier;
  }): Promise<{ credited: number; cappedOut: boolean; reason: string }> {
    if (input.memberPackageTier === 'Basic') {
      return { credited: 0, cappedOut: false, reason: 'Basic package is not eligible for Lifestyle Rewards.' };
    }
    const product = repeatPurchaseProductCatalog.find((p) => p.sku === input.sku);
    if (!product || !product.lifestyleEligible) {
      return { credited: 0, cappedOut: false, reason: 'Product is not lifestyle-eligible.' };
    }

    const nowIso = this.repo.now();
    const dayIso = nowIso.slice(0, 10);
    const yearMonthPrefix = nowIso.slice(0, 7);

    const tier = input.memberPackageTier as Exclude<PackageTier, 'Basic'>;
    const dailyCap = lifestyleDailyCapByPackage[tier];
    const monthlyCap = lifestyleMonthlyCapByPackage[tier];

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.repo.sumLifestyleCreditsForUserToday(input.memberUserId, dayIso),
      this.repo.sumLifestyleCreditsForUserThisMonth(input.memberUserId, yearMonthPrefix)
    ]);

    if (dailyUsed >= dailyCap) {
      return { credited: 0, cappedOut: true, reason: `Daily lifestyle cap (${dailyCap}) reached.` };
    }
    if (monthlyUsed >= monthlyCap) {
      return { credited: 0, cappedOut: true, reason: `Monthly lifestyle cap (${monthlyCap}) reached.` };
    }

    const credit = product.lifestyleRewardPer;
    await this.postLedgerIfNeeded({
      userId: input.memberUserId,
      walletType: 'lifestyle',
      entryType: 'lifestyle_rewards',
      sourceReference: product.sku,
      creditAmount: credit,
      processId: `LFR:${input.memberUserId}:${input.repurchaseRef}`,
      notes: `Lifestyle Rewards from ${product.label}.`
    });

    return { credited: credit, cappedOut: false, reason: 'Credited.' };
  }

  // Combined repurchase trigger: inserts repurchase record, credits unilevel
  // up the sponsor bloodline, and credits lifestyle to the purchasing member.
  async submitProductRepurchase(input: {
    memberUserId: string;
    activationCodeValue: string;
    sku: string;
    memberPackageTier: PackageTier;
  }): Promise<{
    repurchasePv: number;
    unilevel: { levelsCredited: number; totalCredited: number };
    lifestyle: { credited: number; cappedOut: boolean; reason: string };
  }> {
    const product = repeatPurchaseProductCatalog.find((p) => p.sku === input.sku)
      ?? findProductByCodeFamily(input.sku);
    if (!product) {
      throw new Error(`Unknown repurchase product or code family: ${input.sku}`);
    }

    const repurchaseRef = `repurchase-${input.activationCodeValue}-${this.repo.now()}`;
    const repurchaseId = crypto.randomUUID();

    await this.repo.insertRepurchase({
      id: repurchaseId,
      processKey: repurchaseRef,
      userId: input.memberUserId,
      productCode: product.sku,
      productName: product.label,
      productType: product.codeFamily === 'YOR REFILL' ? 'refill' : 'perfume',
      quantity: 1,
      unitPrice: product.repurchasePrice,
      totalAmount: product.repurchasePrice,
      pvEarned: product.repurchasePv,
      activationCode: input.activationCodeValue,
      transactionDate: this.repo.now(),
      createdAt: this.repo.now()
    });

    const [unilevel, lifestyle] = await Promise.all([
      this.creditUnilevelForRepurchase({
        repurchasingUserId: input.memberUserId,
        sku: product.sku,
        repurchaseRef
      }),
      this.applyRepurchaseLifestyle({
        memberUserId: input.memberUserId,
        sku: product.sku,
        repurchaseRef,
        memberPackageTier: input.memberPackageTier
      })
    ]);

    return { repurchasePv: product.repurchasePv, unilevel, lifestyle };
  }

  async getMemberProfileForUser(userId: string): Promise<ProductionMemberProfile | null> {
    return this.repo.findMemberByUserId(userId);
  }

  // Returns an assigned, released (available) maintenance or refill code owned by userId.
  async findOwnedMaintenanceCode(userId: string, codeValue: string): Promise<ProductionActivationCode | null> {
    const code = await this.repo.findActivationCodeByCode(codeValue);
    if (!code) return null;
    if (code.assignedUserId !== userId) return null;
    if (code.status !== 'available') return null;
    if (code.codeFamily !== 'YOR MAINTENANCE' && code.codeFamily !== 'YOR REFILL' && code.codeFamily !== 'YOR VISION') return null;
    return code;
  }

  // Marks the code used, then fires submitProductRepurchase (lifestyle + unilevel).
  async consumeMaintenanceCode(
    memberUserId: string,
    codeValue: string,
    sku: string,
    memberPackageTier: PackageTier
  ): Promise<{
    repurchasePv: number;
    unilevel: { levelsCredited: number; totalCredited: number };
    lifestyle: { credited: number; cappedOut: boolean; reason: string };
  }> {
    const code = await this.repo.findActivationCodeByCode(codeValue);
    if (!code || code.assignedUserId !== memberUserId || code.status !== 'available') {
      throw new Error('Code is not available for consumption.');
    }

    code.status = 'used';
    await this.repo.saveActivationCodes([code]);

    return this.submitProductRepurchase({
      memberUserId,
      activationCodeValue: codeValue,
      sku,
      memberPackageTier
    });
  }

  // Member unilevel earnings view: total + per-level breakdown + recent entries.
  async getMemberUnilevelData(userId: string): Promise<{
    moneyMode: MoneyMode;
    levelPercentages: number[];
    totalEarned: number;
    byLevel: Array<{ level: number; percent: number; amount: number; count: number }>;
    entries: Array<{ id: string; level: number; sourceReference: string; creditAmount: number; occurredAt: string; status: string }>;
  }> {
    const ledger = await this.repo.listWalletLedgerEntriesForUser(userId);
    const unilevelEntries = ledger.filter((entry) => entry.entryType === 'unilevel');

    const levelOf = (processId: string): number => {
      const match = /:unilevel:L(\d+):/.exec(processId);
      return match ? Number(match[1]) : 0;
    };

    const byLevel = Array.from({ length: UNILEVEL_MAX_LEVELS }, (_, index) => {
      const level = index + 1;
      const levelEntries = unilevelEntries.filter((entry) => levelOf(entry.processId) === level);
      return {
        level,
        percent: UNILEVEL_PERCENTAGES[level] ?? 0,
        amount: Number(levelEntries.reduce((sum, entry) => sum + entry.creditAmount, 0).toFixed(2)),
        count: levelEntries.length
      };
    });

    return {
      moneyMode: this.repo.getMoneyMode(),
      levelPercentages: [...UNILEVEL_PERCENTAGES].slice(1),
      totalEarned: Number(unilevelEntries.reduce((sum, entry) => sum + entry.creditAmount, 0).toFixed(2)),
      byLevel,
      entries: unilevelEntries.map((entry) => ({
        id: entry.id,
        level: levelOf(entry.processId),
        sourceReference: entry.sourceReference,
        creditAmount: entry.creditAmount,
        occurredAt: entry.occurredAt,
        status: entry.status
      }))
    };
  }

  async getMemberGetYorFiveData(userId: string): Promise<{
    moneyMode: MoneyMode;
    memberPackageTier: string;
    tierProgress: Array<{
      tier: string;
      claimValue: number;
      referralCount: number;
      completedGroups: number;
      remainingToNext: number;
      remainingDays: number;
      nextThreshold: number;
    }>;
    voidedGroups: Array<{
      tier: string;
      memberCount: number;
      startDate: string;
      deadline: string;
    }>;
    ledgerEntries: Array<{
      id: string;
      sourceReference: string;
      creditAmount: number;
      balanceAfter: number;
      status: string;
      occurredAt: string;
    }>;
    totalEarned: number;
    completedGroupsTotal: number;
  }> {
    const ELIGIBLE_TIERS = ['Classic', 'Standard', 'Business', 'VIP'] as const;
    const CLAIM_VALUES: Record<string, number> = {
      Classic: 5998,
      Standard: 25998,
      Business: 50998,
      VIP: 159998
    };

    const [member, allLedger] = await Promise.all([
      this.repo.findMemberByUserId(userId),
      this.repo.listWalletLedgerEntriesForUser(userId)
    ]);

    const nowIso = this.repo.now();
    const tierProgress: Array<{
      tier: string;
      claimValue: number;
      referralCount: number;
      completedGroups: number;
      remainingToNext: number;
      remainingDays: number;
      nextThreshold: number;
    }> = [];
    const voidedGroups: Array<{ tier: string; memberCount: number; startDate: string; deadline: string }> = [];

    // GATE-GYF-WINDOW-20260613: progress mirrors the credit engine — same-package
    // qualified directs grouped into 3-month windows. The open group shows the
    // remaining target and remaining days; expired partial groups are listed as
    // void history for monitoring and never credit.
    for (const tier of ELIGIBLE_TIERS) {
      const gyfDirects = await this.listQualifiedSamePackageGyfDirects(userId, tier);
      const groups = computeGetYorFiveGroups(gyfDirects, { asOf: nowIso });
      const completedGroups = groups.filter((g) => g.status === 'complete').length;
      const openGroup = groups.find((g) => g.status === 'open') ?? null;
      for (const voided of groups.filter((g) => g.status === 'void')) {
        voidedGroups.push({
          tier,
          memberCount: voided.memberUserIds.length,
          startDate: voided.startDate,
          deadline: voided.deadline
        });
      }
      tierProgress.push({
        tier,
        claimValue: CLAIM_VALUES[tier] ?? 0,
        referralCount: gyfDirects.length,
        completedGroups,
        remainingToNext: openGroup ? openGroup.remainingNeeded : 5,
        remainingDays: openGroup ? openGroup.remainingDays : 0,
        nextThreshold: (completedGroups + 1) * 5
      });
    }

    const gyfEntries = allLedger
      .filter((e) => e.entryType === 'get_five')
      .map((e) => ({
        id: e.id,
        sourceReference: e.sourceReference,
        creditAmount: e.creditAmount,
        balanceAfter: e.balanceAfter,
        status: e.status,
        occurredAt: e.occurredAt
      }));

    const totalEarned = gyfEntries.reduce((sum, e) => sum + e.creditAmount, 0);
    const completedGroupsTotal = tierProgress.reduce((sum, t) => sum + t.completedGroups, 0);

    return {
      moneyMode: this.repo.getMoneyMode(),
      memberPackageTier: member?.packageTier ?? 'Basic',
      tierProgress,
      voidedGroups,
      ledgerEntries: gyfEntries,
      totalEarned,
      completedGroupsTotal
    };
  }

  async isCompanyRootAccount(user: SessionUser): Promise<boolean> {
    const member = await this.repo.findMemberByUserId(user.id);
    const upper = member?.username?.toUpperCase() ?? '';
    return upper === 'YOR0001' || upper === 'YOR01';
  }

  async listAdminMembersForManagement(input: {
    query: string;
    page: number;
    pageSize: number;
    username?: string;
  }) {
    const pageSize = Math.min(Math.max(input.pageSize, 5), 100);
    const page = Math.max(input.page, 1);
    const query = input.query.trim();

    const [members, total] = await Promise.all([
      this.repo.listMembersFiltered(query, page, pageSize),
      this.repo.countMembersFiltered(query)
    ]);

    const userIds = members.map((m) => m.userId);
    const [networkMap, walletMap, directMap] = await Promise.all([
      this.repo.listNetworkAccountsByUserIds(userIds).then((rows) => new Map(rows.map((r) => [r.userId, r]))),
      this.repo.sumWalletMainBalancesByUserIds(userIds),
      this.repo.countDirectReferralsByUserIds(userIds)
    ]);

    const php = (v: number) =>
      `PHP ${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totalPages = Math.ceil(total / pageSize);

    const rows = members.map((m) => {
      const net = networkMap.get(m.userId);
      const cdBalance = net ? Math.max(0, (net.cdAmount ?? 0) - (net.cdTotal ?? 0)) : 0;
      return {
        username: m.username,
        fullName: m.fullName,
        packageTier: m.packageTier,
        accountStatus: m.accountStatus as import('../../types/auth.js').MemberAccountStatus,
        stockist: false,
        sponsorCode: m.sponsorCode ?? '',
        directReferrals: directMap.get(m.userId) ?? 0,
        walletAvailable: php(walletMap.get(m.userId) ?? 0),
        cdBalance: php(cdBalance),
        lastActivity: net?.createdAt ?? m.createdAt,
        actions: ['view']
      };
    });

    const selectedUsername = input.username?.trim() || (query && members[0]?.username) || '';
    const selectedMember = selectedUsername
      ? members.find((m) => m.username.toUpperCase() === selectedUsername.toUpperCase()) ?? null
      : null;

    const selectedNet = selectedMember ? networkMap.get(selectedMember.userId) : null;
    const selectedCdBalance = selectedNet ? Math.max(0, (selectedNet.cdAmount ?? 0) - (selectedNet.cdTotal ?? 0)) : 0;

    return {
      moneyMode: this.repo.getMoneyMode(),
      query,
      page,
      pageSize,
      total,
      totalPages,
      rows,
      selectedMember: selectedMember
        ? {
            username: selectedMember.username,
            fullName: selectedMember.fullName,
            firstName: selectedMember.firstName,
            lastName: selectedMember.lastName,
            middleName: selectedMember.middleName,
            packageTier: selectedMember.packageTier,
            accountStatus: selectedMember.accountStatus as import('../../types/auth.js').MemberAccountStatus,
            stockist: false,
            referralCode: selectedMember.referralCode,
            sponsorCode: selectedMember.sponsorCode ?? '',
            email: '',
            phone: selectedMember.contactNumber ?? '',
            address: '',
            payoutOption: selectedMember.payoutMethod ?? '',
            payoutDetails: selectedMember.payoutDetails ?? '',
            directReferrals: directMap.get(selectedMember.userId) ?? 0,
            walletAvailable: php(walletMap.get(selectedMember.userId) ?? 0),
            walletPending: php(0),
            cdBalance: php(selectedCdBalance),
            lastActivity: selectedNet?.createdAt ?? selectedMember.createdAt,
            actions: ['view']
          }
        : null,
      actionNotes: [
        'Data is live from Supabase. Search by username, full name, or referral code.',
        'Profile editing is available via the individual member profile endpoints.'
      ]
    };
  }

  async buildMemberActivationCodeCenter(user: SessionUser) {
    const member = await this.requireMemberByUserId(user.id);
    const codes = await this.repo.listActivationCodesForUser(user.id);

    const inventory = codes
      .map((code) => mapCodeRow(code, member.username))
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    const groupedInventory = {
      registrationCodes: inventory.filter((item) => item.codeFamily === 'YOR CODES'),
      maintenanceCodes: inventory.filter((item) => item.codeFamily === 'YOR MAINTENANCE'),
      perfumeCodes: inventory.filter((item) => item.codeFamily === 'YOR PERFUME'),
      visionCodes: inventory.filter((item) => item.codeFamily === 'YOR VISION')
    };

    const recentEvents = await this.repo.listActivationCodeEventsForUser(user.id, 12);
    const counterpartyIds = Array.from(
      new Set(recentEvents.flatMap((event) => [event.toUserId, event.fromUserId]).filter((id): id is string => Boolean(id)))
    );
    const userById = new Map((await this.repo.findUsersByIds(counterpartyIds)).map((item) => [item.id, item]));

    const history = recentEvents.map((event) => ({
      id: event.id,
      code: event.code,
      action: event.action,
      counterparty:
        (event.toUserId ? userById.get(event.toUserId)?.displayName : null) ??
        (event.fromUserId ? userById.get(event.fromUserId)?.displayName : null) ??
        event.actorName,
      occurredAt: event.createdAt,
      status: event.action === 'consumed' ? 'used' : event.action
    }));

    // Transfer recipients resolve through search-first username lookup; the
    // full-member dropdown list is intentionally no longer shipped.
    const transferTargets: Array<{ username: string; fullName: string; packageTier: string }> = [];

    return {
      moneyMode: this.repo.getMoneyMode(),
      member: {
        username: member.username,
        packageTier: member.packageTier
      },
      inventory,
      groupedInventory,
      history,
      transferTargets,
      hints: [
        'Only released YOR CODES are registration-ready and copy-enabled.',
        'Maintenance, perfume, and vision codes stay visible in separate inventory groups and are excluded from registration.'
      ]
    };
  }

  async buildMemberDirectReferrals(userId: string) {
    const directs = await this.repo.listDirectsBySponsor(userId);
    const memberProfiles = await Promise.all(
      directs.map((n) => this.repo.findMemberByUserId(n.userId).catch(() => null))
    );
    return directs.map((network, i) => {
      const profile = memberProfiles[i];
      return {
        username: profile?.username ?? network.userId,
        name: profile?.fullName ?? '—',
        package: network.packageTier ?? '—',
        status: profile?.accountStatus ?? '—',
        placement: network.placementSide ?? '—'
      };
    });
  }

  async buildAdminDashboardMetrics() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [members, networks, encashments] = await Promise.all([
      this.repo.listMembers(),
      this.repo.listNetworkAccounts(),
      this.repo.listEncashments({}, 10000)
    ]);

    const active = members.filter((m) => !m.isCompanyAccount);
    const weeklyActivations = active.filter((m) => m.createdAt >= weekAgo).length;
    const monthlyRegistrations = active.filter((m) => m.createdAt >= monthStart).length;
    const activeCdAccounts = networks.filter((n) => n.cdStatus > 0 || n.cdAmount > 0).length;
    const pendingEncashments = encashments.filter((e) => /pending|queued|requested|verification/i.test(e.status)).length;

    return [
      { label: 'Weekly Activations', value: String(weeklyActivations), detail: 'Last 7 days', tone: 'good' as const },
      { label: 'Monthly Registrations', value: String(monthlyRegistrations), detail: 'This calendar month', tone: 'good' as const },
      { label: 'Active CD Accounts', value: String(activeCdAccounts), detail: 'CD balance active', tone: 'good' as const },
      { label: 'Pending Encashments', value: String(pendingEncashments), detail: 'Awaiting processing', tone: 'warning' as const }
    ];
  }

  async buildAdminActivationCodeCenter(actorRole?: string) {
    const [codes, members] = await Promise.all([this.repo.listActivationCodes(), this.repo.listMembers()]);
    const memberByUserId = new Map(members.map((item) => [item.userId, item]));
    const inventory = codes
      .map((code) => {
        const assigned = code.assignedUserId ? memberByUserId.get(code.assignedUserId)?.username ?? 'Unassigned' : 'Unassigned';
        return {
          ...mapCodeRow(code, assigned === 'Unassigned' ? null : assigned),
          remarks: code.remarks,
          releasable: code.status === 'unreleased'
        };
      })
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    return {
      moneyMode: this.repo.getMoneyMode(),
      inventory,
      groupedInventory: {
        registrationCodes: inventory.filter((item) => item.codeFamily === 'YOR CODES'),
        maintenanceCodes: inventory.filter((item) => item.codeFamily === 'YOR MAINTENANCE'),
        perfumeCodes: inventory.filter((item) => item.codeFamily === 'YOR PERFUME'),
        visionCodes: inventory.filter((item) => item.codeFamily === 'YOR VISION')
      },
      metrics: {
        totalCodes: inventory.length,
        availableCodes: inventory.filter((item) => item.status === 'available').length,
        unreleasedCodes: inventory.filter((item) => item.status === 'unreleased').length,
        usedCodes: inventory.filter((item) => item.status === 'used').length,
        lostCodes: 0,
        paidCodes: inventory.filter((item) => item.paymentStatus === 'paid' || item.paymentStatus === 'externally-paid').length
      },
      auditTrail: (await this.repo.listRecentActivationCodeEvents(20)).map((event) => ({
        actor: event.actorName,
        action: event.action,
        target: event.code,
        occurredAt: event.createdAt
      })),
      // Transfer recipients resolve through search-first username lookup.
      transferTargets: [] as Array<{ username: string; fullName: string; packageTier: string }>,
      hints: [
        'Generate, release, and transfer always append activation-code event history.',
        'Registration eligibility is controlled by the backend code-family and lifecycle flags, not by frontend labels.'
      ]
    };
  }

  async buildMemberRegistrationReadiness(user: SessionUser) {
    const member = await this.requireMemberByUserId(user.id);
    const codes = (await this.repo.listActivationCodesForUser(user.id))
      .filter((code) => code.registrationEligible && code.status === 'available');
    const reservations = await this.repo.listPlacementReservationsForSponsor(user.id);
    const activeReservation = reservations
      .filter((item) => item.status === 'active' && item.expiresAt > this.repo.now())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

    const sponsorLeft = await this.repo.findPlacementChild(user.id, 'left');
    const sponsorRight = await this.repo.findPlacementChild(user.id, 'right');
    const fallbackRecommendation =
      !sponsorLeft
        ? {
            placementUsername: member.username,
            placementSide: 'left',
            note: 'Left slot under the sponsor root is open and ready for reservation.'
          }
        : !sponsorRight
          ? {
              placementUsername: member.username,
              placementSide: 'right',
              note: 'Right slot under the sponsor root is open and ready for reservation.'
            }
          : {
              placementUsername: member.username,
              placementSide: 'left',
              note: 'Choose an open slot from the genealogy page when the sponsor root is already filled on both sides.'
            };

    return {
      moneyMode: this.repo.getMoneyMode(),
      sponsor: {
        username: member.username,
        fullName: member.fullName,
        referralCode: member.referralCode
      },
      placementPolicy: {
        mode: 'slot-reservation',
        recommendation: activeReservation
          ? {
              placementUsername: activeReservation.placementParentUsername,
              placementSide: activeReservation.placementSide,
              note: 'Active slot reservation is already attached to the share link below.'
            }
          : fallbackRecommendation
      },
      activeReservation: activeReservation
        ? {
            id: activeReservation.id,
            placementUsername: activeReservation.placementParentUsername,
            placementSide: activeReservation.placementSide,
            shareToken: activeReservation.shareToken,
            expiresAt: activeReservation.expiresAt,
            shareLink: this.buildShareLink(encodeReferralCode(member.username), activeReservation.shareToken)
          }
        : null,
      referralLink: activeReservation
        ? this.buildShareLink(encodeReferralCode(member.username), activeReservation.shareToken)
        : '',
      availableCodes: codes.map((code) => mapCodeRow(code, member.username)),
      checklist: [
        'Choose the final placement slot before sharing the referral link.',
        'Share one released YOR CODE together with the placement-aware registration link.',
        'Public registration blocks when the slot token is missing, expired, or already occupied.'
      ]
    };
  }

  async createPlacementReservation(
    user: SessionUser,
    input: { placementParentUsername: string; placementSide: PlacementSide; expiresInHours?: number }
  ) {
    const sponsor = await this.requireMemberByUserId(user.id);
    const placementAddress = parsePlacementParentAddress(input.placementParentUsername);
    const placementParent = await this.requireMemberByUsername(placementAddress.memberUsername);
    const parentNetwork = await this.repo.findNetworkAccountByUserId(placementParent.userId);
    if (!parentNetwork || parentNetwork.registrationStatus !== 'active') {
      throw new Error('Placement parent is not available.');
    }
    const occupied = await this.repo.findPlacementChild(placementParent.userId, input.placementSide, placementAddress.shadowSide);
    if (occupied) {
      throw new Error(`Placement side ${input.placementSide.toUpperCase()} is already occupied under ${placementAddress.label}.`);
    }

    const reservation: ProductionPlacementReservation = {
      id: crypto.randomUUID(),
      sponsorUserId: sponsor.userId,
      referralCode: sponsor.referralCode,
      placementParentUserId: placementParent.userId,
      placementParentUsername: placementAddress.label,
      placementParentShadowSide: placementAddress.shadowSide,
      placementSide: input.placementSide,
      shareToken: randomToken(),
      status: 'active',
      expiresAt: new Date(Date.now() + (input.expiresInHours ?? 24) * 60 * 60 * 1000).toISOString(),
      createdAt: this.repo.now()
    };

    await this.repo.savePlacementReservation(reservation);

    return {
      moneyMode: this.repo.getMoneyMode(),
      status: 'completed' as const,
      reservation: {
        id: reservation.id,
        placementUsername: reservation.placementParentUsername,
        placementSide: reservation.placementSide,
        expiresAt: reservation.expiresAt,
        shareToken: reservation.shareToken,
        shareLink: this.buildShareLink(encodeReferralCode(sponsor.username), reservation.shareToken)
      }
    };
  }

  async updateMemberPayoutSettings(user: SessionUser, payload: { payoutOption: string; payoutDetails: string }) {
    const payoutMethod = payload.payoutOption.trim();
    if (!payoutMethod) {
      throw new Error('Select a valid payout method.');
    }
    const member = await this.requireMemberByUserId(user.id);
    member.payoutMethod = payoutMethod;
    member.payoutDetails = payload.payoutDetails.trim();
    await this.repo.saveMemberProfile(member);
    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'member-update-payout',
      status: 'completed' as const,
      reason: 'Payout settings updated.',
      detail: `Payout method set to ${payoutMethod}.`
    };
  }

  async previewRegistration(viewer: SessionUser | null, input: ProductionRegistrationInput): Promise<ProductionRegistrationPreview> {
    const origin: RegistrationOrigin = input.origin === 'genealogy-slot' ? 'genealogy-slot' : 'referral-link';
    const sponsorResolution = await this.resolveSponsor(viewer, input, origin);
    const sponsor = sponsorResolution.member;
    const sponsorCodes = sponsor
      ? (await this.repo.listActivationCodesForUser(sponsor.userId)).filter((code) => code.registrationEligible && code.status === 'available')
      : [];

    const sponsorCodeRows = sponsorCodes.map((code) => mapCodeRow(code, sponsor?.username ?? null));
    const normalizedCode = (input.activationCode ?? '').trim().toUpperCase();
    const matchingCodeRecord = sponsorCodes.find((code) => code.code.toUpperCase() === normalizedCode) ?? null;
    const placement = await this.resolvePlacement(viewer, input, origin, sponsor);
    const fullName = (input.fullName ?? '').trim();
    const normalizedFullName = fullName ? normalizeFullName(fullName) : '';
    const duplicatePeople = normalizedFullName ? await this.repo.countMembersByNormalizedFullName(normalizedFullName) : 0;
    const usernameConflict = input.username?.trim() ? await this.repo.findUserByUsername(input.username.trim()) : null;

    const issues = [
      sponsor ? null : origin === 'genealogy-slot' ? 'Sponsor session was not resolved for genealogy encoding.' : 'Sponsor referral path was not resolved.',
      sponsorCodes.length > 0 ? null : 'Sponsor has no released registration code available.',
      normalizedCode ? null : 'Activation code is required.',
      matchingCodeRecord ? null : normalizedCode ? 'Activation code is not available for this sponsor path.' : null,
      placement.context ? null : placement.issue,
      fullName ? null : 'Full name is required.',
      duplicatePeople >= 3 ? 'This verified name already reached the three-account limit.' : null,
      usernameConflict ? 'Username is already taken.' : null
    ].filter((item): item is string => Boolean(item));

    return {
      moneyMode: this.repo.getMoneyMode(),
      origin,
      canProceed: issues.length === 0,
      sponsorResolutionMode: sponsorResolution.mode,
      sponsor: sponsor
        ? {
            username: sponsor.username,
            fullName: sponsor.fullName,
            referralCode: sponsor.referralCode,
            packageTier: sponsor.packageTier
          }
        : null,
      selectedPackage: matchingCodeRecord ? getPackageConfig(matchingCodeRecord.packageTier).packageTier : null,
      placementSide: placement.context?.placementSide ?? null,
      resolvedAccountType: matchingCodeRecord?.accountType ?? null,
      placementReservationId: placement.reservation?.id ?? input.placementReservationId ?? null,
      placementToken: placement.reservation?.shareToken ?? input.placementToken ?? null,
      matchingCode: matchingCodeRecord ? mapCodeRow(matchingCodeRecord, sponsor?.username ?? null) : null,
      placement: placement.context,
      availableCodes: sponsorCodeRows,
      issues,
      checklist: [
        'Use only sponsor-owned, released, and unused YOR CODES.',
        'Package tier and account type are locked from the consumed activation code.',
        origin === 'referral-link'
          ? 'Placement is auto-balanced to the lighter side under your sponsor. You may share a token link to override placement.'
          : 'The clicked genealogy slot stays locked and is revalidated immediately before final save.'
      ]
    };
  }

  async submitRegistration(viewer: SessionUser | null, input: ProductionRegistrationInput): Promise<ProductionRegistrationSubmitResponse> {
    const preview = await this.previewRegistration(viewer, input);
    if (!preview.canProceed || !preview.sponsor || !preview.matchingCode || !preview.placement) {
      throw new Error(preview.issues.join(' '));
    }

    const previewCode = preview.matchingCode;
    const sponsor = await this.requireMemberByUsername(preview.sponsor.username);
    const placementParent = await this.requireMemberByUsername(preview.placement.placementUsername);
    const selectedPackageTier = getPackageConfig(previewCode.packageTier).packageTier;
    const occupied = await this.repo.findPlacementChild(
      placementParent.userId,
      preview.placement.placementSide,
      preview.placement.placementParentShadowSide ?? null
    );
    if (occupied) {
      const placementLabel = preview.placement.placementParentShadowSide
        ? `${placementParent.username}-${preview.placement.placementParentShadowSide === 'left' ? 'L' : 'R'}`
        : placementParent.username;
      throw new Error(`Placement side ${preview.placement.placementSide.toUpperCase()} is already occupied under ${placementLabel}.`);
    }

    const [matchingCode] = (await this.repo.listActivationCodesForUser(sponsor.userId)).filter((code) => code.code === previewCode.code);
    if (!matchingCode || matchingCode.status !== 'available' || !matchingCode.registrationEligible) {
      throw new Error('Activation code is no longer available for this sponsor path.');
    }

    const finalUsername = (input.username ?? '').trim() || this.buildUsername(await this.repo.nextMemberSequence());
    if (await this.repo.findUserByUsername(finalUsername)) {
      throw new Error('Username is already taken.');
    }

    const loginEmail = (input.email ?? '').trim().toLowerCase() || `${finalUsername.toLowerCase()}@yor.local`;
    if (await this.repo.findUserByEmail(loginEmail)) {
      throw new Error('Email is already registered.');
    }

    const fullName = (input.fullName ?? '').trim();
    if ((await this.repo.countMembersByNormalizedFullName(normalizeFullName(fullName))) >= 3) {
      throw new Error('This verified name already reached the three-account limit.');
    }

    const passwordBundle = createPasswordHashSync(input.password ?? '');
    const createdAt = this.repo.now();
    const referralCode = this.buildReferralCode(await this.repo.nextMemberSequence());
    const userId = crypto.randomUUID();
    const parsedName = splitFullName(fullName);
    const user: ProductionAppUser = {
      id: userId,
      email: loginEmail,
      displayName: fullName,
      role: 'member',
      status: 'active',
      passwordHash: passwordBundle.hash,
      passwordSalt: passwordBundle.salt,
      createdAt
    };
    const profile: ProductionMemberProfile = {
      userId,
      username: finalUsername,
      referralCode,
      sponsorCode: sponsor.referralCode,
      packageTier: selectedPackageTier,
      accountStatus: 'active',
      fullName,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleName: parsedName.middleName,
      contactNumber: (input.phone ?? '').trim(),
      normalizedFullName: normalizeFullName(fullName),
      createdAt,
      payoutMethod: (input.payoutOption ?? '').trim() || undefined,
      payoutDetails: (input.payoutDetails ?? '').trim() || undefined
    };
    // CD obligation tracking (owner ruling 2026-06-12): any non-FS unpaid entry
    // carries a Commission Deduction obligation equal to the package price,
    // recovered at 100% of encashment net until cleared. FS carries no obligation
    // because FS never gains earning rights (it is not a debt state).
    const packagePrice = getPackageConfig(selectedPackageTier).price;
    const entryUnpaid = matchingCode.paymentStatus === 'unpaid';
    const carriesCdObligation = matchingCode.accountType !== 'FS' && entryUnpaid;
    const settledCdEntry = matchingCode.accountType === 'CD' && !entryUnpaid;
    const network: ProductionNetworkAccount = {
      userId,
      sponsorUserId: sponsor.userId,
      directReferrerUserId: sponsor.userId,
      placementParentUserId: placementParent.userId,
      placementParentShadowSide: preview.placement.placementParentShadowSide ?? null,
      placementSide: preview.placement.placementSide,
      currentAccountTypeCode: matchingCode.accountType === 'FS' ? 2 : 1,
      currentAccountType: matchingCode.accountType,
      packageTier: selectedPackageTier,
      activationCode: matchingCode.code,
      registrationStatus: 'active',
      leftPoints: 0,
      rightPoints: 0,
      cdStatus: carriesCdObligation ? CD_STATUS_OUTSTANDING : settledCdEntry ? CD_STATUS_SETTLED : CD_STATUS_NONE,
      cdAmount: carriesCdObligation || settledCdEntry ? packagePrice : 0,
      cdTotal: settledCdEntry ? packagePrice : 0,
      createdAt
    };

    await this.repo.saveUser(user);
    await this.repo.saveMemberProfile(profile);
    await this.repo.saveNetworkAccount(network);

    matchingCode.status = 'used';
    matchingCode.usedAt = createdAt;
    matchingCode.usedByUserId = userId;
    matchingCode.assignedUserId = userId;
    await this.repo.saveActivationCodes([matchingCode]);
    await this.repo.appendActivationCodeEvents([
      {
        id: crypto.randomUUID(),
        activationCodeId: matchingCode.id,
        code: matchingCode.code,
        action: 'consumed',
        actorUserId: userId,
        actorName: fullName,
        fromUserId: sponsor.userId,
        toUserId: userId,
        notes: `Consumed by ${finalUsername} during registration.`,
        createdAt
      }
    ]);

    // GATE-BIN-PV-PDCD-20260612: owner ruling — PD counts immediately, fully
    // settled CD accounts count after recovery, and FS never generates Direct
    // Referral or binary PV even when paid. Deferred DR/PV applies only to CD
    // entries, and the settlement trigger (settleActivationCode) reuses these
    // exact process keys so each posting happens at most once.
    // Reverts GATE-BIN-PV-FS-2026-06-12, which wrongly allowed paid FS entries.
    const entryState = this.codeEntryState(matchingCode, network);
    const drEligible = countsForDirectReferralSource(entryState);
    const pvEligible = countsForPairingSource(entryState);

    if (drEligible) {
      await this.postRegistrationDirectAndGetFive({
        sponsorUserId: sponsor.userId,
        newMemberUserId: userId,
        newMemberUsername: finalUsername,
        code: matchingCode,
        packageTier: selectedPackageTier
      });
    }

    let queuedProcessIds: string[] = [];
    if (pvEligible) {
      const queueItem = this.buildPlacementSalesQueueItem({
        newMemberUserId: userId,
        newMemberUsername: finalUsername,
        code: matchingCode,
        placementParentUserId: placementParent.userId,
        placementParentShadowSide: preview.placement.placementParentShadowSide ?? null,
        placementSide: preview.placement.placementSide,
        createdAt
      });
      await this.repo.enqueueCompensation(queueItem);
      queuedProcessIds = [queueItem.processId];
    }

    if (preview.placementReservationId) {
      const reservation = await this.repo.findPlacementReservationById(preview.placementReservationId);
      if (reservation && reservation.status === 'active') {
        reservation.status = 'consumed';
        await this.repo.savePlacementReservation(reservation);
      }
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'production-registration-submit',
      status: 'completed',
      reason: 'Production registration committed and downstream compensation queued.',
      detail:
        drEligible && pvEligible
          ? `Created ${finalUsername}, consumed ${matchingCode.code}, posted direct referral, and queued placement-based compensation workers.`
          : matchingCode.accountType === 'FS'
            ? `Created ${finalUsername}, consumed ${matchingCode.code}. FS entries never generate direct referral or binary PV.`
            : `Created ${finalUsername}, consumed ${matchingCode.code}. Direct referral and binary PV are deferred until the CD entry is settled.`,
      placementReservationId: preview.placementReservationId,
      queuedCompensation: queuedProcessIds,
      createdMember: {
        username: finalUsername,
        fullName,
        email: loginEmail,
        referralCode,
        sponsorUsername: sponsor.username,
        packageTier: selectedPackageTier,
        accountType: matchingCode.accountType,
        loginEmail
      }
    };
  }

  async processCompensationQueue(limit = 50) {
    // Single-flight: registration submits process the queue inline and the
    // admin route can trigger it too — concurrent runs would double-accumulate
    // leg volume. The lock serializes them in this process.
    return withMoneyLock('compensation-queue', () => this.processCompensationQueueLocked(limit));
  }

  private async processCompensationQueueLocked(limit: number) {
    const pending = await this.repo.listPendingCompensation(limit);
    const processed: string[] = [];

    for (const item of pending) {
      if (item.eventType !== 'placement-sales') {
        continue;
      }

      // At-most-once: mark processed before applying. Leg accumulation is not
      // idempotent, so a crash mid-walk must not replay the item (double pay);
      // an under-credited item is recoverable from this log line, a double
      // payout is not (AUD-01).
      await this.repo.markCompensationProcessed(item.id, this.repo.now());
      try {
        await this.applyPlacementSalesItem(item);
        processed.push(item.processId);
      } catch (error) {
        console.error(
          `COMPENSATION_ITEM_FAILED process_id=${item.processId} payload=${JSON.stringify(item.payload)} — credited partially or not at all; replay manually after review.`,
          error
        );
      }
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      processed
    };
  }

  private async applyPlacementSalesItem(item: ProductionCompensationQueueItem) {
    let currentParentUserId: string | null = item.payload.placementParentUserId;
      let currentSide: PlacementSide = item.payload.placementParentShadowSide ?? item.payload.placementSide;

      while (currentParentUserId) {
        const profile = await this.repo.findMemberByUserId(currentParentUserId);
        const network: ProductionNetworkAccount | null = await this.repo.findNetworkAccountByUserId(currentParentUserId);
        const existingBalance = await this.repo.getSalesmatchBalance(currentParentUserId);

        if (!profile || !network) {
          break;
        }

        const balance: ProductionSalesmatchBalance =
          existingBalance ?? {
            userId: currentParentUserId,
            leftSales: 0,
            rightSales: 0,
            matchedSales: 0,
            leftPoints: 0,
            rightPoints: 0,
            matchedPoints: 0,
            updatedAt: this.repo.now()
          };

        // Legs always accumulate (strong-leg carry, no flush-out)...
        if (currentSide === 'left') {
          balance.leftSales += item.payload.salesmatchValue;
          balance.leftPoints += item.payload.binaryPoints;
          network.leftPoints += item.payload.binaryPoints;
        } else {
          balance.rightSales += item.payload.salesmatchValue;
          balance.rightPoints += item.payload.binaryPoints;
          network.rightPoints += item.payload.binaryPoints;
        }
        balance.updatedAt = this.repo.now();

        // ...but match execution requires an eligible recipient. GATE-BIN-PAIR-20260612
        // (owner ruling): only PD / fully-settled CD accounts pair — FS and unpaid-CD
        // recipients hold volume until eligible (Nogatu instead lets unpaid-CD owners
        // receive; deviation recorded in the pending-decisions log). Nogatu parity:
        // pairing also unlocks only after one personally-sponsored qualified direct
        // is placed inside the recipient's binary subtree — spillover alone never
        // unlocks the first pairing payout (binaryEligibility.js).
        const recipientEligible = countsForPairingSource(this.networkAccountState(network));
        const unlocked = recipientEligible && (await this.hasQualifiedPersonalDirectInSubtree(profile.userId));

        if (!unlocked) {
          await this.repo.saveNetworkAccount(network);
          await this.repo.saveSalesmatchBalance(balance);
        } else {
          const matchedSales = Math.min(balance.leftSales, balance.rightSales);
          const matchedPoints = Math.min(balance.leftPoints, balance.rightPoints);
          const salesmatchDelta = Math.max(0, matchedSales);
          const pointsDelta = Math.max(0, matchedPoints);
          balance.matchedSales += salesmatchDelta;
          balance.matchedPoints += pointsDelta;

          // Reduce both legs by the matched amount — weak leg zeroes out, strong leg carries forward residual.
          if (salesmatchDelta > 0) {
            balance.leftSales -= salesmatchDelta;
            balance.rightSales -= salesmatchDelta;
            balance.leftPoints -= pointsDelta;
            balance.rightPoints -= pointsDelta;
            network.leftPoints = Math.max(0, network.leftPoints - pointsDelta);
            network.rightPoints = Math.max(0, network.rightPoints - pointsDelta);
          }

          await this.repo.saveNetworkAccount(network);
          await this.repo.saveSalesmatchBalance(balance);

          if (salesmatchDelta > 0) {
            // GATE-SMB-CAP-20260612: weekly/monthly package caps apply to the
            // payout, not the match — over-cap matched volume is forfeited per
            // owner ruling (legs are already consumed above).
            const packageConfig = getPackageConfig(profile.packageTier);
            const nowIso = this.repo.now();
            const weekPaid = await this.repo.getPaidSalesmatchSince(profile.userId, manilaWeekStartIso(nowIso));
            const monthPaid = await this.repo.getPaidSalesmatchSince(profile.userId, manilaMonthStartIso(nowIso));
            const payable = Math.min(
              salesmatchDelta,
              Math.max(0, packageConfig.weeklySalesmatchCap - weekPaid),
              Math.max(0, packageConfig.monthlySalesmatchCap - monthPaid)
            );
            const forfeited = Number((salesmatchDelta - payable).toFixed(2));

            if (payable > 0) {
              await this.postLedgerIfNeeded({
                userId: profile.userId,
                entryType: 'salesmatch',
                sourceReference: item.payload.createdMemberUsername,
                creditAmount: payable,
                processId: `${item.processId}:salesmatch:${profile.userId}:${balance.matchedSales}`,
                notes:
                  forfeited > 0
                    ? `Salesmatch delta from ${item.payload.createdMemberUsername} (PHP ${forfeited} forfeited at package cap).`
                    : `Salesmatch delta from ${item.payload.createdMemberUsername}.`
              });
            }

            // GATE-BIN-CYCLE-NOCAP-20260613: owner sign-off item 3 — Binary Cycle
            // has NO weekly/monthly cap. It pays a flat percent of the FULL matched
            // salesmatch movement (salesmatchDelta), independent of the SMB payout
            // cap above, and still posts when the SMB payout is fully forfeited
            // (payable === 0). Overrides BUSINESSRULE BIN-02 "Weekly capping applies".
            // Source eligibility is enforced upstream (only PD / settled-CD entries
            // enqueue PV) and recipient eligibility above.
            if ((item.payload.binaryCycleEligible ?? true) && packageConfig.binaryCyclePercent > 0 && profile.packageTier !== 'Basic') {
              const binaryCredit = Number(((salesmatchDelta * packageConfig.binaryCyclePercent) / 100).toFixed(2));
              if (binaryCredit > 0) {
                await this.postLedgerIfNeeded({
                  userId: profile.userId,
                  entryType: 'binary_cycle',
                  sourceReference: item.payload.createdMemberUsername,
                  creditAmount: binaryCredit,
                  processId: `${item.processId}:binary:${profile.userId}:${balance.matchedPoints}:${pointsDelta}`,
                  notes: `Binary cycle delta from ${item.payload.createdMemberUsername}.`
                });
              }
            }

            await this.repo.recordPairingSnapshot({
              userId: profile.userId,
              snapshotDate: manilaDateKey(nowIso),
              matchedDelta: salesmatchDelta,
              paidDelta: payable,
              forfeitedDelta: forfeited
            });
          }
        }

        currentSide = network.placementParentShadowSide ?? currentSide;
        currentParentUserId = network.placementParentUserId;
      }
  }

  async generateActivationCodes(
    actor: SessionUser,
    input: {
      quantity: number;
      packageTier?: string;
      assignedTo?: string;
      accountType?: AccountType;
      codeFamily?: CodeFamily;
      remarks?: string;
    }
  ) {
    const codeFamily = (input.codeFamily ?? 'YOR CODES') as CodeFamily;
    const packageConfig = resolveActivationCodeTemplate(input.packageTier ?? 'Standard', codeFamily);
    const assignedMember = input.assignedTo ? await this.requireMemberByUsername(input.assignedTo) : null;
    const quantity = Math.max(1, Math.min(100, Math.trunc(input.quantity || 1)));
    const createdAt = this.repo.now();
    const effectiveAccountType = input.accountType ?? packageConfig.accountType;
    const rows: ProductionActivationCode[] = [];
    const events: ProductionActivationCodeEvent[] = [];

    for (let index = 0; index < quantity; index += 1) {
      const seq = await this.repo.nextActivationCodeSequence();
      const code = buildActivationCodeValue(effectiveAccountType, packageConfig.packageTier, codeFamily, seq);
      const row: ProductionActivationCode = {
        id: crypto.randomUUID(),
        code,
        codeFamily,
        packageTier: packageConfig.packageTier,
        accountType: effectiveAccountType,
        status: 'unreleased',
        paymentStatus: effectiveAccountType === 'CD' ? 'unpaid' : 'paid',
        assignedUserId: assignedMember?.userId ?? null,
        generatedByUserId: actor.id,
        generatedAt: createdAt,
        releasedAt: null,
        transferredAt: null,
        usedAt: null,
        usedByUserId: null,
        registrationEligible: (input.codeFamily ?? 'YOR CODES') === 'YOR CODES',
        lockedDirectReferralBonus: packageConfig.directReferralBonus,
        lockedSalesmatchValue: packageConfig.salesmatchValue,
        // GATE-BIN-PV-20260613: generated registration codes lock pairing BP from
        // the resolved salesmatch table (1 BP/PV = PHP 250 SMB), not from any
        // separate package catalog PV scale.
        lockedBinaryPoints: packageConfig.salesmatchBinaryPoints,
        lockedGetFiveAmount: packageConfig.getFiveAmount,
        processId: buildProcessId('code-generate', String(seq)),
        remarks: input.remarks?.trim() || 'Generated for production encoding flow.',
        settledAt: null,
        settledByUserId: null
      };
      rows.push(row);
      events.push({
        id: crypto.randomUUID(),
        activationCodeId: row.id,
        code: row.code,
        action: 'generated',
        actorUserId: actor.id,
        actorName: actor.name,
        fromUserId: null,
        toUserId: row.assignedUserId,
        notes: 'Activation code generated.',
        createdAt
      });
    }

    await this.repo.saveActivationCodes(rows);
    try {
      await this.repo.appendActivationCodeEvents(events);
    } catch {
      // non-fatal: event logging failure does not block code generation
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-generate-activation-codes',
      status: 'completed' as const,
      reason: `Generated ${rows.length} activation code(s).`,
      detail: `Generated ${rows.length} ${packageConfig.packageTier} code(s) in ${codeFamily}.`
    };
  }

  async releaseActivationCodes(actor: SessionUser, codes: string[]) {
    const selected = await this.repo.findActivationCodesByCodes(codes);
    if (selected.length === 0) {
      throw new Error('Select at least one activation code.');
    }
    const createdAt = this.repo.now();
    selected.forEach((row) => {
      if (row.status !== 'unreleased') {
        throw new Error(`${row.code} is not in unreleased status.`);
      }
      row.status = 'available';
      row.releasedAt = createdAt;
    });
    await this.repo.saveActivationCodes(selected);
    await this.repo.appendActivationCodeEvents(
      selected.map((row) => ({
        id: crypto.randomUUID(),
        activationCodeId: row.id,
        code: row.code,
        action: 'released',
        actorUserId: actor.id,
        actorName: actor.name,
        fromUserId: null,
        toUserId: row.assignedUserId,
        notes: 'Activation code released.',
        createdAt
      }))
    );

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-release-activation-code',
      status: 'completed' as const,
      reason: `Released ${selected.length} activation code(s).`
    };
  }

  async transferActivationCodes(actor: SessionUser, targetUsername: string, codes: string[]) {
    const target = await this.requireMemberByUsername(targetUsername);
    const selected = await this.repo.findActivationCodesByCodes(codes);
    if (selected.length === 0) {
      throw new Error('Select at least one activation code.');
    }
    const createdAt = this.repo.now();
    selected.forEach((row) => {
      if (row.status === 'used' || row.status === 'disabled') {
        throw new Error(`${row.code} cannot be transferred.`);
      }
    });
    const previousAssignees = new Map(selected.map((row) => [row.code, row.assignedUserId]));
    selected.forEach((row) => {
      row.assignedUserId = target.userId;
      row.transferredAt = createdAt;
    });
    await this.repo.saveActivationCodes(selected);
    await this.repo.appendActivationCodeEvents(
      selected.map((row) => ({
        id: crypto.randomUUID(),
        activationCodeId: row.id,
        code: row.code,
        action: 'transferred',
        actorUserId: actor.id,
        actorName: actor.name,
        fromUserId: previousAssignees.get(row.code) ?? null,
        toUserId: target.userId,
        notes: `Activation code transferred to ${target.username}.`,
        createdAt
      }))
    );

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-transfer-activation-code',
      status: 'completed' as const,
      reason: `Transferred ${selected.length} activation code(s) to ${target.username}.`
    };
  }

  async settleActivationCode(actor: SessionUser, codeValue: string, mode: 'paid' | 'externally-paid') {
    return withMoneyLock(`settle:${codeValue.trim().toUpperCase()}`, async () => {
      const code = await this.repo.findActivationCodeByCode(codeValue);
      if (!code) {
        throw new Error('Activation code not found.');
      }
      if (code.paymentStatus !== 'unpaid') {
        return {
          moneyMode: this.repo.getMoneyMode(),
          action: 'admin-settle-activation-code',
          status: 'completed' as const,
          reason: `${code.code} is already settled.`
        };
      }

      await this.applyCodeSettlement(code, mode, { actorUserId: actor.id, actorName: actor.name, note: `Payment settled (${mode}).` });

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'admin-settle-activation-code',
        status: 'completed' as const,
        reason: `Settled ${code.code} (${mode}).`
      };
    });
  }

  // Shared settlement effects, used by the admin settle action and by CD
  // recovery completion during encashment. Fires the deferred DR and binary PV
  // for consumed, non-FS entries using the same process keys as registration,
  // so each posting happens at most once regardless of which path runs first.
  private async applyCodeSettlement(
    code: ProductionActivationCode,
    mode: 'paid' | 'externally-paid',
    audit: { actorUserId: string | null; actorName: string; note: string }
  ) {
    const settledAt = this.repo.now();
    code.paymentStatus = mode;
    code.settledAt = settledAt;
    code.settledByUserId = audit.actorUserId;
    await this.repo.saveActivationCodes([code]);
    await this.repo.appendActivationCodeEvents([
      {
        id: crypto.randomUUID(),
        activationCodeId: code.id,
        code: code.code,
        action: 'settled',
        actorUserId: audit.actorUserId,
        actorName: audit.actorName,
        fromUserId: null,
        toUserId: code.usedByUserId ?? code.assignedUserId,
        notes: audit.note,
        createdAt: settledAt
      }
    ]);

    // GATE-BIN-PV-PDCD-20260612: FS stays FS forever — settlement never grants
    // FS entries DR or binary PV rights.
    if (code.status !== 'used' || !code.usedByUserId || code.accountType === 'FS') {
      return;
    }

    const network = await this.repo.findNetworkAccountByUserId(code.usedByUserId);
    const member = await this.repo.findMemberByUserId(code.usedByUserId);
    if (!network || !member) {
      return;
    }

    // Mark the obligation settled before posting so qualified-direct counting
    // sees the new state (settled outside deduction keeps the recovery audit).
    network.cdStatus = CD_STATUS_SETTLED;
    network.cdTotal = Math.max(network.cdTotal, network.cdAmount);
    await this.repo.saveNetworkAccount(network);

    if (network.sponsorUserId) {
      await this.postRegistrationDirectAndGetFive({
        sponsorUserId: network.sponsorUserId,
        newMemberUserId: code.usedByUserId,
        newMemberUsername: member.username,
        code,
        packageTier: network.packageTier
      });
    }

    if (network.placementParentUserId) {
      await this.repo.enqueueCompensation(
        this.buildPlacementSalesQueueItem({
          newMemberUserId: code.usedByUserId,
          newMemberUsername: member.username,
          code,
          placementParentUserId: network.placementParentUserId,
          placementParentShadowSide: network.placementParentShadowSide ?? null,
          placementSide: network.placementSide ?? 'left',
          createdAt: settledAt
        })
      );
    }
  }

  // ENC-01 deduction stack: PHP 50 processing fee, 10% tax, 5% System Retainer,
  // then CD recovery at 100% of the remaining net until the obligation clears.
  // Submit only reserves the funds (gross ledger debit + pending row). CD
  // recovery and its settlement side effects fire at mark-paid, never before —
  // a rejected request must leave no money effect beyond the refunded debit.
  async submitEncashment(actor: SessionUser, requestedAmount: number) {
    return withMoneyLock(`encash:${actor.id}`, async () => {
      const amount = Number(Number(requestedAmount).toFixed(2));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a valid encashment amount.');
      }
      const member = await this.repo.findMemberByUserId(actor.id);
      const network = await this.repo.findNetworkAccountByUserId(actor.id);
      if (!member || !network) {
        throw new Error('Member profile not found.');
      }

      // One open request per member: prevents double-reserving the CD
      // obligation and shrinks the race surface on the balance check.
      const existing = await this.repo.listEncashmentsForUser(actor.id);
      if (existing.some((row) => row.status === 'pending' || row.status === 'queued' || row.status === 'approved')) {
        throw new Error('You already have an encashment request under review. Wait for it to be settled first.');
      }

      const available = await this.repo.sumLedgerMainBalance(actor.id);
      if (amount > available) {
        throw new Error('Requested amount exceeds available balance.');
      }

      const requestId = crypto.randomUUID();
      const processingFee = 50;
      const tax = Number((amount * 0.1).toFixed(2));
      const retainer = Number((amount * 0.05).toFixed(2));
      const postFixedNet = Math.max(0, Number((amount - processingFee - tax - retainer).toFixed(2)));
      const cdOutstanding = Math.max(0, Number((network.cdAmount - network.cdTotal).toFixed(2)));
      const cdDeduction = Math.min(cdOutstanding, postFixedNet);
      const totalDeductions = Number((processingFee + tax + retainer + cdDeduction).toFixed(2));
      const net = Number((amount - totalDeductions).toFixed(2));
      const processId = buildProcessId('encashment-submit', actor.id, requestId);
      const createdAt = this.repo.now();

      await this.repo.createEncashment({
        id: requestId,
        userId: actor.id,
        processId,
        grossAmount: amount,
        processingFee,
        taxAmount: tax,
        systemRetainer: retainer,
        cdDeduction,
        totalDeductions,
        netAmount: net,
        status: 'pending',
        payoutMethod: member.payoutMethod ?? null,
        payoutDetails: member.payoutDetails ?? null,
        reviewedByUserId: null,
        reviewedAt: null,
        paidAt: null,
        remarks: 'Member-submitted encashment request.',
        createdAt
      });
      await this.postLedgerIfNeeded({
        userId: actor.id,
        entryType: 'encashment',
        sourceReference: requestId,
        debitAmount: amount,
        processId: `${processId}:debit`,
        notes: `Encashment request ${requestId} (gross PHP ${amount}).`
      });

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'member-wallet-encash',
        status: 'completed' as const,
        reason: 'Encashment request submitted for review.',
        detail: `Gross PHP ${amount}: fee ${processingFee}, tax ${tax}, retainer ${retainer}, CD recovery ${cdDeduction}, net PHP ${net}.`,
        encashment: {
          id: requestId,
          grossAmount: amount,
          processingFee,
          tax,
          systemRetainer: retainer,
          cdDeduction,
          totalDeductions,
          netReceivable: net,
          status: 'pending' as const,
          payoutSchedule: 'Tuesday encashment / Friday payout'
        }
      };
    });
  }

  async reviewEncashment(
    actor: SessionUser,
    encashmentId: string,
    action: 'approve' | 'reject' | 'mark-paid',
    remarks?: string
  ) {
    // Per-request lock serializes concurrent reviews (approve vs reject race);
    // the status is re-read inside the lock so the first transition wins.
    return withMoneyLock(`encash-review:${encashmentId}`, async () => {
      const row = await this.repo.findEncashmentById(encashmentId);
      if (!row) {
        throw new Error('Encashment request not found.');
      }
      const reviewedAt = this.repo.now();

      if (action === 'approve') {
        if (row.status !== 'pending' && row.status !== 'queued') {
          throw new Error(`Cannot approve an encashment in ${row.status} status.`);
        }
        row.status = 'approved';
      } else if (action === 'reject') {
        if (row.status !== 'pending' && row.status !== 'queued') {
          throw new Error(`Cannot reject an encashment in ${row.status} status.`);
        }
        row.status = 'rejected';
        // Compensating credit restores the gross debit — corrections are new
        // ledger rows, never edits (AUD-01 append-only rule). No CD recovery
        // or settlement was applied at submit, so nothing else to unwind.
        await this.postLedgerIfNeeded({
          userId: row.userId,
          entryType: 'adjustment',
          sourceReference: row.id,
          creditAmount: row.grossAmount,
          processId: `${row.processId}:refund`,
          notes: `Encashment ${row.id} rejected — gross amount restored.`
        });
      } else {
        if (row.status !== 'approved') {
          throw new Error('Only approved encashments can be marked paid.');
        }
        row.status = 'paid';
        row.paidAt = reviewedAt;
        await this.applyEncashmentCdRecovery(row);
      }

      row.reviewedByUserId = actor.id;
      row.reviewedAt = reviewedAt;
      if (remarks?.trim()) {
        row.remarks = remarks.trim();
      }
      await this.repo.saveEncashment(row);

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'admin-review-encashment',
        status: 'completed' as const,
        reason: `Encashment ${row.id} is now ${row.status}.`
      };
    });
  }

  // CD recovery is applied only when the encashment is actually paid out.
  // GATE-CD-SETTLE-20260612: clearing the obligation settles the originating
  // code, which fires the deferred DR and binary PV.
  private async applyEncashmentCdRecovery(row: ProductionEncashment) {
    if (row.cdDeduction <= 0) {
      return;
    }
    const network = await this.repo.findNetworkAccountByUserId(row.userId);
    if (!network) {
      return;
    }
    const outstanding = Math.max(0, Number((network.cdAmount - network.cdTotal).toFixed(2)));
    const recovered = Math.min(row.cdDeduction, outstanding);
    // If the obligation shrank between submit and payout (e.g. an admin
    // settled the code directly), the over-withheld remainder goes back.
    const overWithheld = Number((row.cdDeduction - recovered).toFixed(2));
    if (overWithheld > 0) {
      await this.postLedgerIfNeeded({
        userId: row.userId,
        entryType: 'adjustment',
        sourceReference: row.id,
        creditAmount: overWithheld,
        processId: `${row.processId}:cd-over-recovery-refund`,
        notes: `Encashment ${row.id}: CD obligation was already settled — over-withheld recovery restored.`
      });
    }
    if (recovered <= 0) {
      return;
    }
    network.cdTotal = Number((network.cdTotal + recovered).toFixed(2));
    if (network.cdTotal >= network.cdAmount) {
      network.cdStatus = CD_STATUS_SETTLED;
    }
    await this.repo.saveNetworkAccount(network);

    if (network.cdStatus === CD_STATUS_SETTLED && network.activationCode) {
      const originatingCode = await this.repo.findActivationCodeByCode(network.activationCode);
      if (originatingCode && originatingCode.paymentStatus === 'unpaid') {
        await this.applyCodeSettlement(originatingCode, 'paid', {
          actorUserId: null,
          actorName: 'System — CD recovery',
          note: `CD obligation cleared via paid encashment recovery (${row.id}).`
        });
      }
    }
  }

  async buildAdminEncashmentCenter() {
    const rows = await this.repo.listEncashments({}, 200);
    const memberNames = new Map<string, string>();
    for (const row of rows) {
      if (!memberNames.has(row.userId)) {
        const member = await this.repo.findMemberByUserId(row.userId);
        memberNames.set(row.userId, member ? `${member.fullName} (${member.username})` : row.userId);
      }
    }
    const peso = (value: number) =>
      `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return {
      moneyMode: this.repo.getMoneyMode(),
      encashments: rows.map((row, index) => ({
        id: row.id,
        queueOrder: index + 1,
        member: memberNames.get(row.userId) ?? row.userId,
        gross: peso(row.grossAmount),
        fee: peso(row.processingFee),
        tax: peso(row.taxAmount),
        systemRetainer: peso(row.systemRetainer),
        cdDeduction: peso(row.cdDeduction),
        net: peso(row.netAmount),
        method: row.payoutMethod ?? '—',
        status: row.status,
        remarks: row.remarks
      })),
      totals: {
        gross: rows.reduce((sum, row) => sum + row.grossAmount, 0),
        net: rows.reduce((sum, row) => sum + row.netAmount, 0),
        awaitingReview: rows.filter((row) => row.status === 'pending' || row.status === 'queued').length
      },
      processNotes: [
        'Production encashments are ledger-backed with deterministic process keys.',
        'Approve moves a request to approved; mark-paid finalizes; reject restores the gross amount to the member wallet.'
      ]
    };
  }

  async buildMemberWalletData(userId: string, encashAmount?: number) {
    const [member, ledgerEntries, networkAccount] = await Promise.all([
      this.repo.findMemberByUserId(userId),
      this.repo.listWalletLedgerEntriesForUser(userId),
      this.repo.findNetworkAccountByUserId(userId)
    ]);

    if (!member) {
      throw new Error('Member profile not found.');
    }

    const cdBalance = networkAccount ? Math.max(0, networkAccount.cdAmount - networkAccount.cdTotal) : 0;

    // Sum balances per wallet type
    const mainBalance = ledgerEntries
      .filter(e => e.walletType === 'main')
      .reduce((sum, e) => sum + e.creditAmount - e.debitAmount, 0);
    const lifestyleBalance = ledgerEntries
      .filter(e => e.walletType === 'lifestyle')
      .reduce((sum, e) => sum + e.creditAmount - e.debitAmount, 0);

    // Sum credits per income type
    const incomeTotals = new Map<string, number>();
    for (const entry of ledgerEntries) {
      if (entry.creditAmount > 0) {
        incomeTotals.set(entry.entryType, (incomeTotals.get(entry.entryType) ?? 0) + entry.creditAmount);
      }
    }

    const INCOME_STREAM_META: Array<{ streamId: string; label: string; walletType: string; entryType: string }> = [
      { streamId: 'direct-referral', label: 'Direct Referral', walletType: 'main', entryType: 'direct_referral' },
      { streamId: 'salesmatch', label: 'Salesmatch Bonus', walletType: 'main', entryType: 'salesmatch' },
      { streamId: 'binary-cycle', label: 'Binary Cycle Bonus', walletType: 'main', entryType: 'binary_cycle' },
      { streamId: 'get-five', label: 'Get Yor Five Bonus', walletType: 'main', entryType: 'get_five' },
      { streamId: 'lifestyle-rewards', label: 'Lifestyle Rewards', walletType: 'lifestyle', entryType: 'lifestyle_rewards' },
      { streamId: 'unilevel', label: 'Unilevel Bonus', walletType: 'main', entryType: 'unilevel' },
      { streamId: 'global', label: 'Global Bonus', walletType: 'main', entryType: 'global_bonus' }
    ];

    const incomeBreakdown = INCOME_STREAM_META.map(m => ({
      streamId: m.streamId,
      label: m.label,
      walletType: m.walletType,
      amount: incomeTotals.get(m.entryType) ?? 0
    }));

    const incomeStreams = INCOME_STREAM_META.map(m => {
      const amount = incomeTotals.get(m.entryType) ?? 0;
      return {
        streamId: m.streamId,
        label: m.label,
        writeStatus: 'production' as const,
        simulatedGross: amount,
        simulatedNet: amount,
        capApplied: false,
        statusLabel: amount > 0 ? 'posted' : 'no activity',
        explanation: amount > 0
          ? `Production ledger: PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credited across ${ledgerEntries.filter(e => e.entryType === m.entryType).length} transaction(s).`
          : 'No transactions recorded yet for this income stream.'
      };
    });

    const wallets = [
      { type: 'main', label: 'Main Earnings Wallet', balance: mainBalance, threshold: 500 },
      { type: 'lifestyle', label: 'Lifestyle Rewards Wallet', balance: lifestyleBalance, threshold: 1000 },
      { type: 'product', label: 'Product Wallet / Purchase Credits', balance: 0, threshold: 0 },
      { type: 'pending', label: 'Pending Computed Income', balance: 0, threshold: 0 },
      { type: 'encashment', label: 'Approved Encashment Queue', balance: 0, threshold: 500 }
    ];

    const payoutPreviewAmount = encashAmount !== undefined && encashAmount > 0
      ? Math.min(mainBalance, encashAmount)
      : 0;
    const processingFee = payoutPreviewAmount > 0 ? 50 : 0;
    const maintenanceFee = 0;
    const systemRetainer = payoutPreviewAmount * 0.05;
    const tax = payoutPreviewAmount * 0.10;
    const fee = processingFee + systemRetainer;
    // Mirrors submitEncashment: CD recovery applies to the net after the
    // fixed deductions, not to the gross.
    const previewPostFixedNet = Math.max(0, payoutPreviewAmount - processingFee - tax - systemRetainer);
    const cdDeduction = Math.min(cdBalance, previewPostFixedNet);
    const totalDeductions = fee + tax + cdDeduction;
    const netReceivable = Math.max(0, payoutPreviewAmount - totalDeductions);

    const ENTRY_TYPE_LABELS: Record<string, string> = {
      direct_referral: 'Direct Referral',
      salesmatch: 'Salesmatch Bonus',
      binary_cycle: 'Binary Cycle Bonus',
      get_five: 'Get Yor Five Bonus',
      lifestyle_rewards: 'Lifestyle Rewards',
      unilevel: 'Unilevel Bonus',
      global_bonus: 'Global Bonus'
    };

    const formatPhp = (v: number) =>
      `PHP ${Math.abs(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const transactions = ledgerEntries.map(entry => ({
      id: entry.id,
      date: entry.occurredAt,
      category: entry.entryType,
      label: ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType,
      source: entry.sourceReference,
      gross: entry.creditAmount > 0 ? formatPhp(entry.creditAmount) : `-${formatPhp(entry.debitAmount)}`,
      net: entry.creditAmount > 0 ? formatPhp(entry.creditAmount) : `-${formatPhp(entry.debitAmount)}`,
      status: entry.status,
      type: 'wallet' as const
    }));

    return {
      moneyMode: 'production' as const,
      packageTier: member.packageTier,
      wallets,
      entries: ledgerEntries,
      summary: {
        availableBalance: mainBalance,
        pendingBalance: 0,
        cdBalance,
        // Item 8: no GCash default — surface the member's actual saved payout
        // method + details (null when unset) so Account Details can fetch/display
        // and edit them. The payout method is chosen from a dropdown at
        // registration and on Account Details, never silently defaulted.
        payoutMethod: member.payoutMethod ?? null,
        payoutDetails: member.payoutDetails ?? null,
        payoutSchedule: 'Tuesday encashment / Friday payout'
      },
      incomeBreakdown,
      incomeStreams,
      preview: {
        requestedAmount: payoutPreviewAmount,
        processingFee,
        maintenanceFee,
        systemRetainer,
        tax,
        fee,
        cdDeduction,
        totalDeductions,
        netReceivable,
        sufficientBalance: payoutPreviewAmount <= mainBalance,
        note: 'Preview mirrors the protected encashment breakdown; final submit applies deterministic process keys in the production ledger.'
      },
      ledger: ledgerEntries,
      transactions
    };
  }

  private async resolveSponsor(
    viewer: SessionUser | null,
    input: ProductionRegistrationInput,
    origin: RegistrationOrigin
  ): Promise<{ member: ProductionMemberProfile | null; mode: SponsorResolutionMode | null }> {
    if (origin === 'genealogy-slot') {
      if (!viewer) {
        return { member: null, mode: null };
      }
      return {
        member: await this.repo.findMemberByUserId(viewer.id),
        mode: 'signed-in-member'
      };
    }

    if (input.referralCode?.trim()) {
      return {
        member: await this.findMemberByReferralCodeOrUsername(input.referralCode),
        mode: 'referral-link'
      };
    }

    if (input.sponsorReferralCode?.trim()) {
      return {
        member: await this.findMemberByReferralCodeOrUsername(input.sponsorReferralCode),
        mode: 'manual-sponsor'
      };
    }

    return { member: null, mode: null };
  }

  private async resolvePlacement(
    viewer: SessionUser | null,
    input: ProductionRegistrationInput,
    origin: RegistrationOrigin,
    sponsor: ProductionMemberProfile | null
  ): Promise<{ context: ProductionPlacementContext | null; reservation: ProductionPlacementReservation | null; issue: string | null }> {
    if (origin === 'genealogy-slot') {
      if (!viewer || !input.placementParentUsername || !input.placementSide) {
        return { context: null, reservation: null, issue: 'Placement slot is required for genealogy encoding.' };
      }
      const placementAddress = parsePlacementParentAddress(input.placementParentUsername);
      const parent = await this.repo.findMemberByUsername(placementAddress.memberUsername);
      if (!parent) {
        return { context: null, reservation: null, issue: 'Placement parent was not found.' };
      }
      const occupied = await this.repo.findPlacementChild(parent.userId, input.placementSide, placementAddress.shadowSide);
      if (occupied) {
        return {
          context: null,
          reservation: null,
          issue: `Placement side ${input.placementSide.toUpperCase()} is already occupied under ${placementAddress.label}.`
        };
      }
      return {
        context: {
          placementUsername: parent.username,
          placementParentShadowSide: placementAddress.shadowSide,
          placementSide: input.placementSide,
          note: 'Placement stays locked to the selected genealogy slot.'
        },
        reservation: null,
        issue: null
      };
    }

    const reservation =
      (input.placementReservationId ? await this.repo.findPlacementReservationById(input.placementReservationId) : null) ??
      (input.placementToken ? await this.repo.findPlacementReservationByToken(input.placementToken) : null);

    if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= this.repo.now()) {
      // Auto-balance: when no placement token, place under the sponsor using the lesser-points side.
      if (sponsor) {
        const sponsorNetwork = await this.repo.findNetworkAccountByUserId(sponsor.userId);
        const leftPoints = sponsorNetwork?.leftPoints ?? 0;
        const rightPoints = sponsorNetwork?.rightPoints ?? 0;
        const autoSide: PlacementSide = leftPoints <= rightPoints ? 'left' : 'right';
        const occupied = await this.repo.findPlacementChild(sponsor.userId, autoSide, null);
        if (!occupied) {
          return {
            context: {
              placementUsername: sponsor.username,
              placementParentShadowSide: null,
              placementSide: autoSide,
              note: `Auto-balanced placement: ${autoSide} leg (${autoSide === 'left' ? leftPoints : rightPoints} pts vs ${autoSide === 'left' ? rightPoints : leftPoints} pts).`
            },
            reservation: null,
            issue: null
          };
        }
      }
      return {
        context: null,
        reservation: null,
        issue: 'Placement selection is required before this referral link can be used.'
      };
    }

    if (sponsor && reservation.sponsorUserId !== sponsor.userId) {
      return {
        context: null,
        reservation,
        issue: 'Placement token does not belong to the resolved sponsor.'
      };
    }

    const reservationAddress = parsePlacementParentAddress(reservation.placementParentUsername);
    const occupied = await this.repo.findPlacementChild(
      reservation.placementParentUserId,
      reservation.placementSide,
      reservation.placementParentShadowSide ?? reservationAddress.shadowSide
    );
    if (occupied) {
      return {
        context: null,
        reservation,
        issue: `Placement side ${reservation.placementSide.toUpperCase()} is already occupied under ${reservation.placementParentUsername}.`
      };
    }

    return {
      context: {
        placementUsername: reservationAddress.memberUsername,
        placementParentShadowSide: reservation.placementParentShadowSide ?? reservationAddress.shadowSide,
        placementSide: reservation.placementSide,
        note: 'Placement is locked from the active sponsor-generated share link.'
      },
      reservation,
      issue: null
    };
  }

  // Entry state at registration time, derived from the consumed code plus the
  // freshly built network account (CD obligation fields).
  private codeEntryState(code: ProductionActivationCode, network: ProductionNetworkAccount): AccountStateInput {
    return {
      accountType: code.accountType,
      paymentStatus: code.paymentStatus,
      cdAmount: network.cdAmount,
      cdTotal: network.cdTotal,
      cdStatus: network.cdStatus
    };
  }

  // Effective state of an existing account, derived from its network row. An
  // outstanding CD obligation marks the entry payment as not yet settled.
  private networkAccountState(network: ProductionNetworkAccount): AccountStateInput {
    return {
      accountType: network.currentAccountType,
      paymentStatus: network.cdStatus === CD_STATUS_OUTSTANDING ? 'unpaid' : 'paid',
      cdAmount: network.cdAmount,
      cdTotal: network.cdTotal,
      cdStatus: network.cdStatus
    };
  }

  // Posts the sponsor Direct Referral and, when a same-package group of five
  // completes, the Get Yor Five bonus. Shared by registration (eligible entries)
  // and the settlement trigger (deferred entries) — process keys are identical
  // on both paths so each posting happens at most once.
  private async postRegistrationDirectAndGetFive(input: {
    sponsorUserId: string;
    newMemberUserId: string;
    newMemberUsername: string;
    code: ProductionActivationCode;
    packageTier: PackageTier;
  }) {
    const directProcessId = buildProcessId('registration-direct', input.sponsorUserId, input.newMemberUserId, input.code.code);
    await this.postLedgerIfNeeded({
      userId: input.sponsorUserId,
      entryType: 'direct_referral',
      sourceReference: input.newMemberUsername,
      creditAmount: input.code.lockedDirectReferralBonus,
      processId: directProcessId,
      notes: `Direct referral bonus from ${input.newMemberUsername}.`
    });

    // GATE-GYF-WINDOW-20260613 (owner sign-off item 5): credit only groups of five
    // qualified same-package directs that COMPLETED within their 3-month window.
    // Partial groups whose window has lapsed are voided (never credited). The
    // completed-group index keeps the process key unique and stable so each group
    // pays at most once (postLedgerIfNeeded dedup); re-running is a no-op.
    if (input.code.lockedGetFiveAmount > 0) {
      const gyfDirects = await this.listQualifiedSamePackageGyfDirects(input.sponsorUserId, input.packageTier);
      const groups = computeGetYorFiveGroups(gyfDirects, { asOf: this.repo.now() });
      for (const group of groups) {
        if (group.status !== 'complete' || group.index === null) {
          continue;
        }
        const getFiveProcessId = buildProcessId(
          'registration-get-five',
          input.sponsorUserId,
          input.packageTier.toUpperCase(),
          String(group.index)
        );
        await this.postLedgerIfNeeded({
          userId: input.sponsorUserId,
          entryType: 'get_five',
          sourceReference: `${input.packageTier} package group ${group.index}`,
          creditAmount: input.code.lockedGetFiveAmount,
          processId: getFiveProcessId,
          notes: `Get Yor Five bonus on completed same-package group ${group.index}.`
        });
      }
    }
  }

  // Qualified (PD / fully-settled CD) same-package directs of a sponsor as
  // GyfDirect records for the Get Yor Five 3-month window computation.
  private async listQualifiedSamePackageGyfDirects(
    sponsorUserId: string,
    packageTier: PackageTier
  ): Promise<GyfDirect[]> {
    const directs = await this.repo.listDirectsBySponsor(sponsorUserId);
    return directs
      .filter(
        (network) =>
          network.registrationStatus === 'active' &&
          network.packageTier === packageTier &&
          countsForDirectReferralSource(this.networkAccountState(network))
      )
      .map((network) => ({ memberUserId: network.userId, joinedAt: network.createdAt }));
  }

  private buildPlacementSalesQueueItem(input: {
    newMemberUserId: string;
    newMemberUsername: string;
    code: ProductionActivationCode;
    placementParentUserId: string;
    placementParentShadowSide: PlacementSide | null;
    placementSide: PlacementSide;
    createdAt: string;
  }): ProductionCompensationQueueItem {
    return {
      id: crypto.randomUUID(),
      processId: buildProcessId('registration-placement-sales', input.newMemberUserId, input.code.code),
      eventType: 'placement-sales',
      status: 'pending',
      payload: {
        placementParentUserId: input.placementParentUserId,
        placementParentShadowSide: input.placementParentShadowSide,
        placementSide: input.placementSide,
        salesmatchValue: input.code.lockedSalesmatchValue,
        binaryPoints: input.code.lockedBinaryPoints,
        createdMemberUserId: input.newMemberUserId,
        createdMemberUsername: input.newMemberUsername,
        activationCode: input.code.code,
        binaryCycleEligible: true
      },
      createdAt: input.createdAt,
      processedAt: null
    };
  }

  // Nogatu binaryEligibility parity: the first pairing payout unlocks only when
  // the member has personally sponsored at least one qualified (PD / settled-CD)
  // direct that is placed inside their own binary subtree.
  private async hasQualifiedPersonalDirectInSubtree(ownerUserId: string): Promise<boolean> {
    const directs = await this.repo.listDirectsBySponsor(ownerUserId);
    for (const direct of directs) {
      if (direct.registrationStatus !== 'active') {
        continue;
      }
      if (!countsForPairingSource(this.networkAccountState(direct))) {
        continue;
      }
      if (await this.isPlacedWithinSubtree(direct.userId, ownerUserId)) {
        return true;
      }
    }
    return false;
  }

  private async isPlacedWithinSubtree(nodeUserId: string, ancestorUserId: string): Promise<boolean> {
    const MAX_TREE_DEPTH = 200;
    let current = await this.repo.findNetworkAccountByUserId(nodeUserId);
    let depth = 0;
    while (current?.placementParentUserId && depth < MAX_TREE_DEPTH) {
      if (current.placementParentUserId === ancestorUserId) {
        return true;
      }
      current = await this.repo.findNetworkAccountByUserId(current.placementParentUserId);
      depth += 1;
    }
    return false;
  }

  private async postLedgerIfNeeded(input: {
    userId: string;
    entryType: ProductionWalletLedgerEntry['entryType'];
    sourceReference: string;
    creditAmount?: number;
    debitAmount?: number;
    walletType?: ProductionWalletLedgerEntry['walletType'];
    processId: string;
    notes: string;
  }) {
    if (await this.repo.hasWalletLedgerProcess(input.processId)) {
      return;
    }
    const creditAmount = input.creditAmount ?? 0;
    const debitAmount = input.debitAmount ?? 0;
    const balanceAfter = (await this.repo.sumLedgerMainBalance(input.userId)) + creditAmount - debitAmount;
    await this.repo.appendWalletLedgerEntry({
      id: crypto.randomUUID(),
      userId: input.userId,
      walletType: input.walletType ?? 'main',
      entryType: input.entryType,
      sourceReference: input.sourceReference,
      creditAmount,
      debitAmount,
      balanceAfter,
      processId: input.processId,
      notes: input.notes,
      occurredAt: this.repo.now(),
      status: 'posted'
    });
  }

  private buildShareLink(referralCode: string, placementToken: string) {
    return buildRegistrationUrl({
      ref: referralCode,
      placementToken
    });
  }

  private async findMemberByReferralCodeOrUsername(code: string): Promise<ProductionMemberProfile | null> {
    const trimmed = code.trim();
    let member = await this.repo.findMemberByReferralCode(trimmed);
    if (member) {
      return member;
    }
    member = await this.repo.findMemberByReferralCode(trimmed.toUpperCase());
    if (member) {
      return member;
    }
    try {
      const decodedUsername = decodeReferralCode(trimmed).toUpperCase();
      if (decodedUsername) {
        member = await this.repo.findMemberByUsername(decodedUsername);
      }
    } catch {
      // Ignore decoding errors
    }
    return member;
  }

  private buildUsername(sequence: number) {
    return `YOR${String(sequence).padStart(4, '0')}`;
  }

  private buildReferralCode(sequence: number) {
    return buildCanonicalReferralCode(this.buildUsername(sequence));
  }

  private async requireUserById(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('User was not found.');
    }
    return user;
  }

  private async requireMemberByUserId(userId: string) {
    const member = await this.repo.findMemberByUserId(userId);
    if (!member) {
      throw new Error('Member profile was not found.');
    }
    return member;
  }

  private async requireMemberByUsername(username: string) {
    const trimmed = username.trim();
    let member = await this.repo.findMemberByUsername(trimmed);
    if (!member) {
      const normalizedAlias = normalizeProductionUsernameAlias(trimmed);
      if (normalizedAlias) {
        member = await this.repo.findMemberByUsername(normalizedAlias);
      }
    }
    if (!member) {
      throw new Error(`Member ${username} was not found.`);
    }
    return member;
  }
}

export function createInMemoryProductionEncodingRepository(seed?: {
  users?: ProductionAppUser[];
  members?: ProductionMemberProfile[];
  networkAccounts?: ProductionNetworkAccount[];
  shadowAccounts?: ProductionShadowAccount[];
  activationCodes?: ProductionActivationCode[];
  codeEvents?: ProductionActivationCodeEvent[];
  walletLedger?: ProductionWalletLedgerEntry[];
  salesmatchBalances?: ProductionSalesmatchBalance[];
  queue?: ProductionCompensationQueueItem[];
  reservations?: ProductionPlacementReservation[];
  activationCodeSequence?: number;
  memberSequence?: number;
  now?: string;
}): ProductionEncodingRepository {
  const state = {
    users: [...(seed?.users ?? [])],
    members: [...(seed?.members ?? [])],
    networkAccounts: [...(seed?.networkAccounts ?? [])],
    shadowAccounts: [...(seed?.shadowAccounts ?? [])],
    activationCodes: [...(seed?.activationCodes ?? [])],
    codeEvents: [...(seed?.codeEvents ?? [])],
    walletLedger: [...(seed?.walletLedger ?? [])],
    salesmatchBalances: [...(seed?.salesmatchBalances ?? [])],
    queue: [...(seed?.queue ?? [])],
    reservations: [...(seed?.reservations ?? [])],
    pairingSnapshots: [] as ProductionPairingSnapshot[],
    encashments: [] as ProductionEncashment[],
    activationCodeSequence: seed?.activationCodeSequence ?? 1000,
    memberSequence: seed?.memberSequence ?? 1000,
    now: seed?.now ?? '2026-06-08T09:00:00.000Z'
  };

  return {
    getMoneyMode: () => 'production',
    now: () => state.now,
    nextActivationCodeSequence: async () => {
      state.activationCodeSequence += 1;
      return state.activationCodeSequence;
    },
    nextMemberSequence: async () => {
      state.memberSequence += 1;
      return state.memberSequence;
    },
    findUserById: async (userId) => state.users.find((item) => item.id === userId) ?? null,
    findMemberByUserId: async (userId) => state.members.find((item) => item.userId === userId) ?? null,
    findMemberByUsername: async (username) =>
      state.members.find((item) => item.username.trim().toUpperCase() === username.trim().toUpperCase()) ?? null,
    findMemberByReferralCode: async (referralCode) =>
      state.members.find((item) => item.referralCode.trim().toUpperCase() === referralCode.trim().toUpperCase()) ?? null,
    findUserByUsername: async (username) => {
      const member = state.members.find((item) => item.username.trim().toUpperCase() === username.trim().toUpperCase());
      return member ? state.users.find((item) => item.id === member.userId) ?? null : null;
    },
    findUserByReferralCode: async (referralCode) => {
      const member = state.members.find(
        (item) => item.referralCode.trim().toUpperCase() === referralCode.trim().toUpperCase()
      );
      return member ? state.users.find((item) => item.id === member.userId) ?? null : null;
    },
    findUserByEmail: async (email) => state.users.find((item) => item.email === email) ?? null,
    countMembersByNormalizedFullName: async (normalizedFullName) =>
      state.members.filter((item) => item.normalizedFullName === normalizedFullName).length,
    listActivationCodes: async () => [...state.activationCodes],
    listActivationCodesForUser: async (userId) => state.activationCodes.filter((item) => item.assignedUserId === userId),
    saveActivationCodes: async (rows) => {
      for (const row of rows) {
        const index = state.activationCodes.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          state.activationCodes[index] = { ...row };
        } else {
          state.activationCodes.push({ ...row });
        }
      }
    },
    appendActivationCodeEvents: async (events) => {
      state.codeEvents.push(...events.map((event) => ({ ...event })));
    },
    listActivationCodeEvents: async () => [...state.codeEvents],
    listMembers: async () => [...state.members],
    listUsers: async () => [...state.users],
    listShadowAccounts: async () => [...state.shadowAccounts],
    listShadowAccountsForOwner: async (ownerUserId) =>
      state.shadowAccounts.filter((item) => item.ownerUserId === ownerUserId).sort((a, b) => a.placement.localeCompare(b.placement)),
    findShadowAccountByCode: async (shadowCode) =>
      state.shadowAccounts.find((item) => item.shadowCode.trim().toUpperCase() === shadowCode.trim().toUpperCase()) ?? null,
    saveShadowAccounts: async (rows) => {
      for (const row of rows) {
        const index = state.shadowAccounts.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          state.shadowAccounts[index] = { ...row };
        } else {
          state.shadowAccounts.push({ ...row });
        }
      }
    },
    listWalletLedgerEntriesForUser: async (userId) => state.walletLedger.filter((item) => item.userId === userId),
    appendWalletLedgerEntry: async (entry) => {
      state.walletLedger.push({ ...entry });
    },
    hasWalletLedgerProcess: async (processId) => state.walletLedger.some((item) => item.processId === processId),
    saveUser: async (user) => {
      const index = state.users.findIndex((item) => item.id === user.id);
      if (index >= 0) {
        state.users[index] = { ...user };
      } else {
        state.users.push({ ...user });
      }
    },
    saveMemberProfile: async (profile) => {
      const index = state.members.findIndex((item) => item.userId === profile.userId);
      if (index >= 0) {
        state.members[index] = { ...profile };
      } else {
        state.members.push({ ...profile });
      }
    },
    saveNetworkAccount: async (account) => {
      const index = state.networkAccounts.findIndex((item) => item.userId === account.userId);
      if (index >= 0) {
        state.networkAccounts[index] = { ...account };
      } else {
        state.networkAccounts.push({ ...account });
      }
    },
    findNetworkAccountByUserId: async (userId) => state.networkAccounts.find((item) => item.userId === userId) ?? null,
    findActivationCodeByCode: async (code) =>
      state.activationCodes.find((item) => item.code.trim().toUpperCase() === code.trim().toUpperCase()) ?? null,
    findActivationCodesByCodes: async (codes) => {
      const wanted = new Set(codes.map((code) => code.trim().toUpperCase()));
      return state.activationCodes.filter((item) => wanted.has(item.code.trim().toUpperCase()));
    },
    listMembersBySponsorCode: async (sponsorCode) => state.members.filter((item) => item.sponsorCode === sponsorCode),
    findUsersByIds: async (userIds) => {
      const wanted = new Set(userIds);
      return state.users.filter((item) => wanted.has(item.id));
    },
    listActivationCodeEventsForUser: async (userId, limit) =>
      state.codeEvents
        .filter((event) => event.fromUserId === userId || event.toUserId === userId || event.actorUserId === userId)
        .slice(-limit)
        .reverse(),
    listRecentActivationCodeEvents: async (limit) => [...state.codeEvents].slice(-limit).reverse(),
    listNetworkAccounts: async () => [...state.networkAccounts],
    listDirectsBySponsor: async (sponsorUserId) => state.networkAccounts.filter((item) => item.sponsorUserId === sponsorUserId),
    findPlacementChild: async (parentUserId, side, shadowSide) =>
      state.networkAccounts.find(
        (item) =>
          item.placementParentUserId === parentUserId &&
          item.placementSide === side &&
          item.registrationStatus === 'active' &&
          (shadowSide ? item.placementParentShadowSide === shadowSide : true)
      ) ?? null,
    saveSalesmatchBalance: async (balance) => {
      const index = state.salesmatchBalances.findIndex((item) => item.userId === balance.userId);
      if (index >= 0) {
        state.salesmatchBalances[index] = { ...balance };
      } else {
        state.salesmatchBalances.push({ ...balance });
      }
    },
    getSalesmatchBalance: async (userId) => state.salesmatchBalances.find((item) => item.userId === userId) ?? null,
    getPaidSalesmatchSince: async (userId, sinceIso) =>
      state.walletLedger
        .filter((item) => item.userId === userId && item.entryType === 'salesmatch' && item.occurredAt >= sinceIso)
        .reduce((sum, item) => sum + item.creditAmount, 0),
    recordPairingSnapshot: async (input) => {
      const existing = state.pairingSnapshots.find(
        (item) => item.userId === input.userId && item.snapshotDate === input.snapshotDate
      );
      if (existing) {
        existing.matchedSales += input.matchedDelta;
        existing.paidSalesmatch += input.paidDelta;
        existing.forfeitedSalesmatch += input.forfeitedDelta;
      } else {
        state.pairingSnapshots.push({
          id: crypto.randomUUID(),
          userId: input.userId,
          snapshotDate: input.snapshotDate,
          matchedSales: input.matchedDelta,
          paidSalesmatch: input.paidDelta,
          forfeitedSalesmatch: input.forfeitedDelta
        });
      }
    },
    listPairingSnapshotsForUser: async (userId) => state.pairingSnapshots.filter((item) => item.userId === userId),
    sumLedgerMainBalance: async (userId) =>
      state.walletLedger
        .filter((item) => item.userId === userId && item.walletType === 'main')
        .reduce((sum, item) => sum + item.creditAmount - item.debitAmount, 0),
    createEncashment: async (row) => {
      if (state.encashments.some((item) => item.processId === row.processId)) {
        return;
      }
      state.encashments.push({ ...row });
    },
    saveEncashment: async (row) => {
      const index = state.encashments.findIndex((item) => item.id === row.id);
      if (index >= 0) {
        state.encashments[index] = { ...row };
      } else {
        state.encashments.push({ ...row });
      }
    },
    findEncashmentById: async (encashmentId) => state.encashments.find((item) => item.id === encashmentId) ?? null,
    listEncashments: async (filter, limit) =>
      state.encashments.filter((item) => (filter.status ? item.status === filter.status : true)).slice(0, limit),
    listEncashmentsForUser: async (userId) => state.encashments.filter((item) => item.userId === userId),
    enqueueCompensation: async (item) => {
      if (!state.queue.some((row) => row.processId === item.processId)) {
        state.queue.push({ ...item });
      }
    },
    listPendingCompensation: async (limit) => state.queue.filter((item) => item.status === 'pending').slice(0, limit),
    markCompensationProcessed: async (queueId, processedAt) => {
      const item = state.queue.find((row) => row.id === queueId);
      if (item) {
        item.status = 'processed';
        item.processedAt = processedAt;
      }
    },
    savePlacementReservation: async (reservation) => {
      const index = state.reservations.findIndex((item) => item.id === reservation.id);
      if (index >= 0) {
        state.reservations[index] = { ...reservation };
      } else {
        state.reservations.push({ ...reservation });
      }
    },
    listPlacementReservationsForSponsor: async (sponsorUserId) => state.reservations.filter((item) => item.sponsorUserId === sponsorUserId),
    findPlacementReservationById: async (reservationId) => state.reservations.find((item) => item.id === reservationId) ?? null,
    findPlacementReservationByToken: async (token) => state.reservations.find((item) => item.shareToken === token) ?? null,
    listMembersFiltered: async (query, page, pageSize) => {
      const upper = query.toUpperCase();
      const filtered = query
        ? state.members.filter(
            (m) => m.username.toUpperCase().includes(upper) || m.fullName.toUpperCase().includes(upper) || m.referralCode.toUpperCase().includes(upper)
          )
        : state.members;
      const offset = (page - 1) * pageSize;
      return filtered.slice(offset, offset + pageSize);
    },
    countMembersFiltered: async (query) => {
      if (!query) return state.members.length;
      const upper = query.toUpperCase();
      return state.members.filter(
        (m) => m.username.toUpperCase().includes(upper) || m.fullName.toUpperCase().includes(upper) || m.referralCode.toUpperCase().includes(upper)
      ).length;
    },
    listNetworkAccountsByUserIds: async (userIds) => state.networkAccounts.filter((n) => userIds.includes(n.userId)),
    sumWalletMainBalancesByUserIds: async (userIds) => {
      const result = new Map<string, number>();
      for (const entry of state.walletLedger.filter((e) => userIds.includes(e.userId) && e.walletType === 'main')) {
        result.set(entry.userId, (result.get(entry.userId) ?? 0) + (entry.creditAmount ?? 0) - (entry.debitAmount ?? 0));
      }
      return result;
    },
    countDirectReferralsByUserIds: async (userIds) => {
      const result = new Map<string, number>();
      for (const n of state.networkAccounts.filter((n) => n.sponsorUserId && userIds.includes(n.sponsorUserId) && n.registrationStatus === 'active')) {
        if (n.sponsorUserId) {
          result.set(n.sponsorUserId, (result.get(n.sponsorUserId) ?? 0) + 1);
        }
      }
      return result;
    },

    insertRepurchase: async (_row) => {
      // In-memory stub: repurchase records are not stored in-memory tests;
      // idempotency is handled by the wallet ledger process key check.
    },

    sumLifestyleCreditsForUserToday: async (userId, dayIso) => {
      const day = dayIso.slice(0, 10);
      return state.walletLedger
        .filter(
          (e) =>
            e.userId === userId &&
            e.walletType === 'lifestyle' &&
            e.entryType === 'lifestyle_rewards' &&
            e.occurredAt.slice(0, 10) === day
        )
        .reduce((sum, e) => sum + (e.creditAmount ?? 0), 0);
    },

    sumLifestyleCreditsForUserThisMonth: async (userId, yearMonthPrefix) => {
      return state.walletLedger
        .filter(
          (e) =>
            e.userId === userId &&
            e.walletType === 'lifestyle' &&
            e.entryType === 'lifestyle_rewards' &&
            e.occurredAt.startsWith(yearMonthPrefix)
        )
        .reduce((sum, e) => sum + (e.creditAmount ?? 0), 0);
    }
  };
}
